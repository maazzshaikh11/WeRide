/**
 * Integration test against the Firebase emulators (Auth + Firestore, WITH the real
 * firestore.rules). Skipped unless the emulators are running, e.g.
 *   cd infra/firebase && npx firebase-tools emulators:exec --only auth,firestore \
 *     --project demo-weride "npm --prefix seed test"
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const admin = require('firebase-admin');

const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const FS = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = process.env.GCLOUD_PROJECT || 'demo-weride';
const skip = !(AUTH && FS) && 'emulators not running';

const { seed, remove } = require('../seed-teamdsy');
const { EMAIL, PASSWORD } = require('../teamdsy-data');

async function signIn(email, password) {
  const r = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  return { status: r.status, body: await r.json() };
}

/** The Rides screen's own query, as the signed-in user, so security rules apply. */
async function myGroups(idToken, uid) {
  const r = await fetch(`http://${FS}/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: 'groups' }],
      where: { fieldFilter: { field: { fieldPath: 'member_ids' }, op: 'ARRAY_CONTAINS', value: { stringValue: uid } } },
    } }),
  });
  const rows = await r.json();
  assert.equal(r.status, 200, JSON.stringify(rows));
  return rows.filter((x) => x.document).map((x) => x.document);
}

test('seeds the account and its rides, and the app can sign in and read them', { skip }, async () => {
  admin.initializeApp({ projectId: PROJECT });
  const db = admin.firestore();
  const auth = admin.auth();
  await remove(db, auth); // clean slate
  const out = await seed(db, auth);
  assert.equal(out.groups, 6);
  assert.equal(out.crews, 3);
  assert.equal(out.logs, 4);

  const si = await signIn(EMAIL, PASSWORD);
  assert.equal(si.status, 200, JSON.stringify(si.body));
  assert.equal(si.body.localId, out.uid);

  const bad = await signIn(EMAIL, 'wrong-password');
  assert.notEqual(bad.status, 200);
  // the user typing the username instead of the email must not work either
  assert.notEqual((await signIn('teamDSY', PASSWORD)).status, 200);

  const docs = await myGroups(si.body.idToken, out.uid);
  assert.equal(docs.length, 6);
  const f = (d, k) => d.fields[k];
  const now = Date.now();
  const startMs = (d) => Number(f(d, 'start_time_ms').integerValue);
  assert.equal(docs.filter((d) => startMs(d) > now).length, 2);
  assert.equal(docs.filter((d) => startMs(d) <= now).length, 4);
  for (const d of docs) {
    assert.match(f(d, 'join_code').stringValue, /^[A-Z2-9]{6}$/);
    assert.ok(f(d, 'ride_plan').mapValue.fields.destination);
    assert.ok(f(d, 'created_at').timestampValue);
  }

  // joining by code works exactly like the app: resolve the code, find the doc
  const code = f(docs.find((d) => f(d, 'name').stringValue === 'Sunday Ghat Run'), 'join_code').stringValue;
  const byCode = await db.collection('groups').where('join_code', '==', code).get();
  assert.equal(byCode.size, 1);
});

test('the signed-in rider reads everything the new screens need, under the real rules', async () => {
  const si = await signIn(EMAIL, PASSWORD);
  const uid = si.body.localId;
  const H = { 'content-type': 'application/json', authorization: `Bearer ${si.body.idToken}` };
  const base = `http://${FS}/v1/projects/${PROJECT}/databases/(default)/documents`;
  const get = async (p) => { const r = await fetch(`${base}/${p}`, { headers: H }); return { status: r.status, body: await r.json() }; };
  const query = async (collectionId, field, op, value, parent = '') => {
    const r = await fetch(`${base}${parent}:runQuery`, { method: 'POST', headers: H, body: JSON.stringify({ structuredQuery: { from: [{ collectionId }], where: { fieldFilter: { field: { fieldPath: field }, op, value } } } }) });
    return (await r.json()).filter((x) => x.document);
  };

  // my profile + private settings (onboarded) + ride logs
  const me = await get(`users/${uid}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.fields.name.stringValue, 'teamDSY');
  const st = await get(`users/${uid}/private/settings`);
  assert.equal(st.status, 200);
  assert.equal(st.body.fields.onboarded.booleanValue, true);
  const lg = await fetch(`${base}/users/${uid}/ride_logs`, { headers: H }).then((r) => r.json());
  assert.equal(lg.documents.length, 4);
  // someone else's private data is NOT readable
  assert.equal((await get('users/seed-meera/private/settings')).status, 403);
  assert.equal((await get('users/seed-meera/ride_logs/x')).status, 403);
  // crew members' public profiles ARE readable (names, bikes)
  const meera = await get('users/seed-meera');
  assert.equal(meera.status, 200);
  assert.equal(meera.body.fields.name.stringValue, 'Meera');

  // crews the rider is in, and a crew resolved by its code
  const crews = await query('crews', 'member_ids', 'ARRAY_CONTAINS', { stringValue: uid });
  assert.equal(crews.length, 3);
  const byCode = await query('crews', 'join_code', 'EQUAL', { stringValue: 'GH7S2K' });
  assert.equal(byCode.length, 1);
  assert.equal(byCode[0].document.fields.name.stringValue, 'Ghat Ghosts');

  // the next ride: RSVPs readable by a member, status planned, crew linked
  const next = (await query('groups', 'join_code', 'EQUAL', { stringValue: 'K7M2QX' }))[0].document;
  assert.equal(next.fields.status.stringValue, 'planned');
  assert.ok(next.fields.crew_id.stringValue.includes('crew-ghosts'));
  const rs = await fetch(`${base}/${next.name.split('/documents/')[1]}/rsvp`, { headers: H }).then((r) => r.json());
  assert.equal(rs.documents.length, 6);
});

test('hazards are readable as the app reads them (active, by group)', { skip }, async () => {
  const db = admin.firestore();
  const next = await db.collection('groups').where('name', '==', 'Sunday Ghat Run').get();
  const gid = next.docs[0].id;
  const active = await db.collection('hazards').where('group_id', '==', gid).where('status', '==', 'active').get();
  assert.equal(active.size, 2);
});

test('running the seed again is idempotent (no duplicates, same ids)', { skip }, async () => {
  const db = admin.firestore();
  const auth = admin.auth();
  const before = (await db.collection('groups').get()).size;
  const a = await seed(db, auth);
  const b = await seed(db, auth);
  assert.equal(a.uid, b.uid);
  assert.equal((await db.collection('groups').get()).size, before);
  assert.equal((await db.collection('hazards').get()).size, 3);
  assert.equal((await db.collection('crews').get()).size, 3);
  assert.equal((await db.collection(`users/${a.uid}/ride_logs`).get()).size, 4);
});

test('--remove deletes the account and everything seeded', { skip }, async () => {
  const db = admin.firestore();
  const auth = admin.auth();
  await remove(db, auth);
  assert.equal((await db.collection('groups').get()).size, 0);
  assert.equal((await db.collection('hazards').get()).size, 0);
  assert.equal((await db.collection('crews').get()).size, 0);
  assert.equal((await db.collection('users').get()).size, 0);
  await assert.rejects(auth.getUserByEmail(EMAIL));
});
