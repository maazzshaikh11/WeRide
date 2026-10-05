#!/usr/bin/env node
/**
 * Creates (or refreshes) the teamDSY demo account in a Firebase project:
 *   - Auth user  teamdsy@weride.app / teamDSY@123  (display name "teamDSY")
 *   - groups/    the next ride, a group teamDSY joined, and four past rides
 *   - hazards/   a few clusters on the next ride's route
 * Safe to run again: it updates in place (deterministic ids), never duplicates.
 *
 *   # a real project: a service-account key with Auth + Firestore access
 *   GOOGLE_APPLICATION_CREDENTIALS=./key.json node seed-teamdsy.js --project my-weride-project
 *   # the local emulators (nothing is written to a real project)
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *     node seed-teamdsy.js --project demo-weride
 *   node seed-teamdsy.js --remove   # delete the user and everything this script created
 */
const admin = require('firebase-admin');
const { EMAIL, PASSWORD, DISPLAY_NAME, JOIN_CODE_RE, groups, hazards, groupDocId } = require('./teamdsy-data');

function parseArgs(argv) {
  const out = { remove: false, project: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--remove') out.remove = true;
    else if (argv[i] === '--project') out.project = argv[++i];
    else if (argv[i] === '-h' || argv[i] === '--help') out.help = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return out;
}

async function ensureUser(auth) {
  try {
    const u = await auth.getUserByEmail(EMAIL);
    return auth.updateUser(u.uid, { password: PASSWORD, displayName: DISPLAY_NAME, emailVerified: true, disabled: false });
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    return auth.createUser({ email: EMAIL, password: PASSWORD, displayName: DISPLAY_NAME, emailVerified: true });
  }
}

/** A join code not used by a DIFFERENT group (the app resolves codes by querying them). */
async function freeCode(db, wanted, ownId) {
  const taken = await db.collection('groups').where('join_code', '==', wanted).get();
  if (taken.docs.every((d) => d.id === ownId)) return wanted;
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  for (let n = 0; n < 20; n++) {
    let c = '';
    for (let i = 0; i < 6; i++) c += alphabet[Math.floor(Math.random() * alphabet.length)];
    const hit = await db.collection('groups').where('join_code', '==', c).get();
    if (hit.empty && JOIN_CODE_RE.test(c)) return c;
  }
  throw new Error('Could not find a free join code');
}

async function seed(db, auth) {
  const user = await ensureUser(auth);
  const now = Date.now();
  const defs = groups(user.uid, now);
  for (const g of defs) {
    const id = groupDocId(g.key);
    const code = await freeCode(db, g.code, id);
    await db.collection('groups').doc(id).set({
      name: g.name,
      created_by: g.created_by,
      member_ids: g.member_ids,
      created_at: admin.firestore.Timestamp.fromMillis(g.created_ms),
      active_ride_id: null,
      join_code: code,
      ride_type: g.ride_type,
      start_time_ms: g.start_time_ms,
      ride_plan: g.ride_plan,
    });
  }
  const nextId = groupDocId(defs[0].key);
  const batch = db.batch();
  for (const h of hazards(nextId, now)) batch.set(db.collection('hazards').doc(h.cluster_id), h);
  await batch.commit();
  return { uid: user.uid, groups: defs.length, hazards: hazards(nextId, now).length };
}

async function remove(db, auth) {
  let uid = null;
  try { uid = (await auth.getUserByEmail(EMAIL)).uid; } catch (e) { if (e.code !== 'auth/user-not-found') throw e; }
  const defs = groups(uid || 'none');
  for (const g of defs) await db.collection('groups').doc(groupDocId(g.key)).delete();
  const hs = await db.collection('hazards').where('group_id', '==', groupDocId(defs[0].key)).get();
  await Promise.all(hs.docs.map((d) => d.ref.delete()));
  if (uid) await auth.deleteUser(uid);
  return { uid };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return console.log(require('fs').readFileSync(__filename, 'utf8').split('*/')[0].replace(/^[#/* ]*\n?/gm, ''));
  const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST;
  if (!args.project) throw new Error('Pass --project <firebase-project-id> (or set GOOGLE_CLOUD_PROJECT).');
  if (!emulator && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('No credentials: set GOOGLE_APPLICATION_CREDENTIALS to a service-account key for the project, or point at the emulators.');
  }
  admin.initializeApp({ projectId: args.project });
  const db = admin.firestore();
  const auth = admin.auth();
  const where = emulator ? `emulator (${args.project})` : `project ${args.project}`;
  if (args.remove) {
    const r = await remove(db, auth);
    return console.log(`Removed teamDSY from ${where}${r.uid ? ` (uid ${r.uid})` : ' (user did not exist)'}.`);
  }
  const r = await seed(db, auth);
  console.log(`Seeded ${where}:\n  login   ${EMAIL} / ${PASSWORD}\n  uid     ${r.uid}\n  groups  ${r.groups}  (1 next ride, 1 joined, 4 past)\n  hazards ${r.hazards}`);
}

if (require.main === module) {
  main().then(() => process.exit(0), (e) => { console.error(`seed failed: ${e.message}`); process.exit(1); });
}
module.exports = { seed, remove, ensureUser, parseArgs };
