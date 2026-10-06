#!/usr/bin/env node
/**
 * Creates (or refreshes) the teamDSY demo account in a Firebase project:
 *   - Auth user  teamdsy@weride.app / teamDSY@123  (display name "teamDSY")
 *   - users/     teamDSY's profile + private settings (onboarded), public profiles for the crew ids
 *   - crews/     three crews;  groups/  the next ride, a joined ride and four finished rides (RSVPs, presence)
 *   - users/<uid>/ride_logs  synthetic recorded logs for the finished rides;  hazards/  clusters on the next route
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
const {
  EMAIL, PASSWORD, DISPLAY_NAME, JOIN_CODE_RE, hazards, groupDocId, crews, crewDocId, crewProfiles, rides, rsvps, logs, myProfile, mySettings,
} = require('./teamdsy-data');

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
async function freeCode(db, collection, wanted, ownId) {
  const taken = await db.collection(collection).where('join_code', '==', wanted).get();
  if (taken.docs.every((d) => d.id === ownId)) return wanted;
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  for (let n = 0; n < 20; n++) {
    let c = '';
    for (let i = 0; i < 6; i++) c += alphabet[Math.floor(Math.random() * alphabet.length)];
    const hit = await db.collection(collection).where('join_code', '==', c).get();
    if (hit.empty && JOIN_CODE_RE.test(c)) return c;
  }
  throw new Error('Could not find a free join code');
}

async function seed(db, auth) {
  const user = await ensureUser(auth);
  const me = user.uid;
  const now = Date.now();
  const TS = (ms) => admin.firestore.Timestamp.fromMillis(ms);

  // people: my public profile + private settings, and public profiles for the (non-account) crew ids
  await db.doc(`users/${me}`).set(myProfile(me, now), { merge: true });
  await db.doc(`users/${me}/private/settings`).set(mySettings(), { merge: true });
  for (const c of crewProfiles(now)) await db.doc(`users/${c.uid}`).set(c.doc);

  // crews
  const crewDefs = crews(me, now);
  for (const c of crewDefs) {
    const id = crewDocId(c.key);
    const code = await freeCode(db, 'crews', c.code, id);
    await db.doc(`crews/${id}`).set({
      name: c.name, created_by: c.created_by, member_ids: c.member_ids, roles: c.roles, join_code: code, created_at: TS(c.created_ms),
    });
  }

  // rides (groups) + RSVPs
  const rideDefs = rides(me, now);
  const rsvpByKey = rsvps(me, now);
  for (const g of rideDefs) {
    const id = groupDocId(g.key);
    const code = await freeCode(db, 'groups', g.code, id);
    const doc = {
      name: g.name, created_by: g.created_by, member_ids: g.member_ids, created_at: TS(g.created_ms), active_ride_id: null,
      join_code: code, ride_type: g.ride_type, start_time_ms: g.start_time_ms, ride_plan: g.ride_plan,
      crew_id: crewDocId(g.crew_key), pace: g.pace, status: g.status, meetup: g.meetup, invited_ids: g.invited_ids,
      ...(g.started_ms ? { started_ms: g.started_ms } : {}), ...(g.finished_ms ? { finished_ms: g.finished_ms } : {}),
    };
    await db.doc(`groups/${id}`).set(doc);
    for (const r of rsvpByKey[g.key] ?? []) await db.doc(`groups/${id}/rsvp/${r.uid}`).set({ status: r.status, updated_ms: r.updated_ms });
    if (g.status === 'finished') {
      for (const uid of g.member_ids) await db.doc(`groups/${id}/presence/${uid}`).set({ state: 'arrived', updated_ms: g.finished_ms });
    }
  }

  // my recorded logs (synthetic demo data)
  const logDefs = logs(me, now);
  for (const l of logDefs) await db.doc(`users/${me}/ride_logs/${l.ride_id}`).set(l);

  // hazards on the next ride's route
  const nextId = groupDocId(rideDefs[0].key);
  const hz = hazards(nextId, now);
  const batch = db.batch();
  for (const h of hz) batch.set(db.collection('hazards').doc(h.cluster_id), h);
  await batch.commit();
  return { uid: me, crews: crewDefs.length, groups: rideDefs.length, logs: logDefs.length, hazards: hz.length };
}

async function remove(db, auth) {
  let uid = null;
  try { uid = (await auth.getUserByEmail(EMAIL)).uid; } catch (e) { if (e.code !== 'auth/user-not-found') throw e; }
  const rideDefs = rides(uid || 'none');
  for (const g of rideDefs) {
    const ref = db.doc(`groups/${groupDocId(g.key)}`);
    for (const sub of ['rsvp', 'roll_call', 'presence']) {
      const docs = await ref.collection(sub).get();
      await Promise.all(docs.docs.map((d) => d.ref.delete()));
    }
    await ref.delete();
  }
  for (const c of crews(uid || 'none')) await db.doc(`crews/${crewDocId(c.key)}`).delete();
  for (const c of crewProfiles()) await db.doc(`users/${c.uid}`).delete();
  const hs = await db.collection('hazards').where('group_id', '==', groupDocId(rideDefs[0].key)).get();
  await Promise.all(hs.docs.map((d) => d.ref.delete()));
  if (uid) {
    const lg = await db.collection(`users/${uid}/ride_logs`).get();
    await Promise.all(lg.docs.map((d) => d.ref.delete()));
    await db.doc(`users/${uid}/private/settings`).delete();
    await db.doc(`users/${uid}`).delete();
    await auth.deleteUser(uid);
  }
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
  console.log(`Seeded ${where}:\n  login   ${EMAIL} / ${PASSWORD}\n  uid     ${r.uid}\n  crews   ${r.crews}\n  rides   ${r.groups}  (2 upcoming, 4 finished)\n  logs    ${r.logs}  (synthetic recorded rides)\n  hazards ${r.hazards}`);
}

if (require.main === module) {
  main().then(() => process.exit(0), (e) => { console.error(`seed failed: ${e.message}`); process.exit(1); });
}
module.exports = { seed, remove, ensureUser, parseArgs };
