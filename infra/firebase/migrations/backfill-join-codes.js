#!/usr/bin/env node
/**
 * One-off migration for the hardened Firestore rules (docs/security/firestore.md).
 *
 * The new rules resolve a join code through `join_codes/{CODE} = { kind: 'crew' | 'ride', target_id }` instead of querying
 * `crews` / `groups` by `join_code` (which is no longer allowed). This script writes that document for every existing
 * crew and ride. Run it BEFORE `firebase deploy --only firestore:rules`, otherwise existing codes stop working the moment
 * the rules go live.
 *
 *   # preview (writes nothing)
 *   GOOGLE_APPLICATION_CREDENTIALS=./key.json node backfill-join-codes.js --project my-weride-project --dry-run
 *   # for real
 *   GOOGLE_APPLICATION_CREDENTIALS=./key.json node backfill-join-codes.js --project my-weride-project
 *   # the local emulator
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node backfill-join-codes.js --project demo-weride
 *
 * Idempotent: a code doc that already points at its target is left alone, so it is safe to run again (and to run again
 * right before the rules deploy to catch crews / rides created in between). It never overwrites an existing code doc.
 *
 * Edge cases (all reported in the summary):
 *   - codes were unique per COLLECTION, so a crew and a ride could share one (the Join screen tried the crew first):
 *     crews are processed first and keep the code; the ride gets a fresh code (its `join_code` field is updated);
 *   - two targets of the same kind with the same code (a race the old read-then-write allowed): the first keeps it;
 *   - a crew / ride with no valid `join_code` (rides from before codes existed, or a malformed value) gets a fresh one,
 *     because joining by raw group id is gone and it would otherwise be impossible to join;
 *   - codes are upper-cased (the app always compared upper-case).
 * Also warns (does not change) about documents that the new schema limits would reject on a creator edit.
 */
const crypto = require('node:crypto');
const admin = require('firebase-admin');

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
const PAGE = 300;

function parseArgs(argv) {
  const out = { dryRun: false, project: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--project') out.project = argv[++i];
    else if (a === '-h' || a === '--help') out.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

/** Join codes are what lets a stranger in: use the CSPRNG (the `random` parameter exists for deterministic tests only). */
function randomCode(random) {
  let c = '';
  for (let i = 0; i < 6; i++) c += ALPHABET[random ? Math.floor(random() * ALPHABET.length) : crypto.randomInt(ALPHABET.length)];
  return c;
}

/** Every doc of a collection, in id order, one page at a time (no big single read). */
async function* eachDoc(db, collection) {
  let last = null;
  for (;;) {
    let q = db.collection(collection).orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) return;
    for (const d of snap.docs) yield d;
    last = snap.docs[snap.docs.length - 1].id;
    if (snap.size < PAGE) return;
  }
}

/** Schema limits of the new rules that existing data might exceed (reported only). */
function schemaWarnings(kind, data) {
  const w = [];
  if (typeof data.name !== 'string' || data.name.length < 1 || data.name.length > 60) w.push('name is not 1..60 characters');
  if (!Array.isArray(data.member_ids) || data.member_ids.length > 100) w.push('member_ids is not a list of at most 100');
  if (kind === 'ride' && Array.isArray(data.invited_ids) && data.invited_ids.length > 100) w.push('invited_ids has more than 100');
  const stops = data.ride_plan && data.ride_plan.stops;
  if (kind === 'ride' && Array.isArray(stops) && stops.length > 30) w.push('ride_plan.stops has more than 30');
  return w;
}

/**
 * @returns {Promise<{crews:number, rides:number, written:number, alreadyOk:number, recoded:Array, assigned:Array, warnings:Array, dryRun:boolean}>}
 */
async function backfill(db, { dryRun = false, random, log = () => {} } = {}) {
  const res = { crews: 0, rides: 0, written: 0, alreadyOk: 0, recoded: [], assigned: [], warnings: [], dryRun };
  // codes claimed during this run (a dry run must predict conflicts without writing)
  const claimed = new Map(); // code -> `${kind}:${id}`

  async function owner(code) {
    if (claimed.has(code)) return claimed.get(code);
    const snap = await db.doc(`join_codes/${code}`).get();
    return snap.exists ? `${snap.data().kind}:${snap.data().target_id}` : null;
  }

  async function freshCode() {
    for (let i = 0; i < 50; i++) {
      const c = randomCode(random);
      if (!(await owner(c))) return c;
    }
    throw new Error('could not find a free join code');
  }

  async function handle(kind, coll, doc) {
    const id = doc.id;
    const me = `${kind}:${id}`;
    const data = doc.data() || {};
    for (const msg of schemaWarnings(kind, data)) res.warnings.push(`${coll}/${id}: ${msg}`);

    let code = typeof data.join_code === 'string' ? data.join_code.trim().toUpperCase() : '';
    let reason = null;
    if (!CODE_RE.test(code)) {
      reason = 'missing-or-invalid';
      code = '';
    } else {
      const holder = await owner(code);
      if (holder && holder !== me) reason = `taken-by-${holder}`;
    }

    if (reason) {
      const fresh = await freshCode();
      const entry = { target: `${coll}/${id}`, old: data.join_code ?? null, new: fresh, reason };
      (reason === 'missing-or-invalid' ? res.assigned : res.recoded).push(entry);
      log(`${dryRun ? '[dry-run] ' : ''}${coll}/${id}: join_code ${data.join_code ?? '(none)'} -> ${fresh} (${reason})`);
      claimed.set(fresh, me);
      if (!dryRun) {
        // claim the code first (create() fails if somebody took it meanwhile), then point the target at it
        await db.doc(`join_codes/${fresh}`).create({ kind, target_id: id });
        await doc.ref.update({ join_code: fresh });
      }
      res.written++;
      return;
    }

    claimed.set(code, me);
    const ref = db.doc(`join_codes/${code}`);
    const snap = await ref.get();
    if (snap.exists && snap.data().kind === kind && snap.data().target_id === id) {
      res.alreadyOk++;
      // keep the stored field upper-case too
      if (!dryRun && data.join_code !== code) await doc.ref.update({ join_code: code });
      return;
    }
    log(`${dryRun ? '[dry-run] ' : ''}join_codes/${code} -> ${kind} ${id}`);
    if (!dryRun) {
      await ref.create({ kind, target_id: id });
      if (data.join_code !== code) await doc.ref.update({ join_code: code });
    }
    res.written++;
  }

  // crews first: the Join screen resolved a crew code before a ride code, so a crew keeps a shared code
  for await (const d of eachDoc(db, 'crews')) {
    res.crews++;
    await handle('crew', 'crews', d);
  }
  for await (const d of eachDoc(db, 'groups')) {
    res.rides++;
    await handle('ride', 'groups', d);
  }
  return res;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return console.log(require('fs').readFileSync(__filename, 'utf8').split('*/')[0].replace(/^[#/* ]*\n?/gm, ''));
  const emulator = process.env.FIRESTORE_EMULATOR_HOST;
  if (!args.project) throw new Error('Pass --project <firebase-project-id> (or set GOOGLE_CLOUD_PROJECT).');
  if (!emulator && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('No credentials: set GOOGLE_APPLICATION_CREDENTIALS to a service-account key for the project, or point FIRESTORE_EMULATOR_HOST at the emulator.');
  }
  admin.initializeApp({ projectId: args.project });
  const where = emulator ? `emulator (${args.project})` : `project ${args.project}`;
  console.log(`${args.dryRun ? 'DRY RUN against' : 'Backfilling'} ${where}`);
  const r = await backfill(admin.firestore(), { dryRun: args.dryRun, log: (m) => console.log(`  ${m}`) });
  console.log(`\n${r.dryRun ? 'Would write' : 'Wrote'} ${r.written} join_codes doc(s); ${r.alreadyOk} already in place.`);
  console.log(`crews scanned ${r.crews}, rides scanned ${r.rides}`);
  if (r.recoded.length) console.log(`re-coded ${r.recoded.length} target(s) whose code was already taken by another (the creator should re-share the new code):\n${r.recoded.map((e) => `  ${e.target}: ${e.old} -> ${e.new} (${e.reason})`).join('\n')}`);
  if (r.assigned.length) console.log(`assigned a code to ${r.assigned.length} target(s) that had none / an invalid one:\n${r.assigned.map((e) => `  ${e.target}: ${e.old ?? '(none)'} -> ${e.new}`).join('\n')}`);
  if (r.warnings.length) console.log(`schema warnings (${r.warnings.length}; these docs would be refused on a creator edit, nothing was changed):\n${r.warnings.map((m) => `  ${m}`).join('\n')}`);
}

if (require.main === module) {
  main().then(() => process.exit(0), (e) => { console.error(`backfill failed: ${e.message}`); process.exit(1); });
}
module.exports = { backfill, parseArgs, randomCode, schemaWarnings };
