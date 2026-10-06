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

  // joining by code works exactly like the app: resolve the code through join_codes/{CODE}, then the target
  const ghat = docs.find((d) => f(d, 'name').stringValue === 'Sunday Ghat Run');
  const code = f(ghat, 'join_code').stringValue;
  const codeDoc = await db.doc(`join_codes/${code}`).get();
  assert.equal(codeDoc.data().kind, 'ride');
  assert.equal(ghat.name.endsWith(`/groups/${codeDoc.data().target_id}`), true);
});

test('every seeded crew and ride has its join_codes doc, and each code matches its target', { skip }, async () => {
  const db = admin.firestore();
  const codes = await db.collection('join_codes').get();
  assert.equal(codes.size, 9); // 3 crews + 6 rides
  for (const kind of ['crew', 'ride']) {
    const coll = kind === 'crew' ? 'crews' : 'groups';
    for (const t of (await db.collection(coll).get()).docs) {
      const c = await db.doc(`join_codes/${t.data().join_code}`).get();
      assert.equal(c.exists, true, `${coll}/${t.id} has no code doc`);
      assert.deepEqual(c.data(), { kind, target_id: t.id });
    }
  }
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

  // crews the rider is in, and a crew resolved by its code (join_codes/{CODE} -> crews/{id}, readable as a member)
  const crews = await query('crews', 'member_ids', 'ARRAY_CONTAINS', { stringValue: uid });
  assert.equal(crews.length, 3);
  const code = await get('join_codes/GH7S2K');
  assert.equal(code.status, 200);
  assert.equal(code.body.fields.kind.stringValue, 'crew');
  const crew = await get(`crews/${code.body.fields.target_id.stringValue}`);
  assert.equal(crew.status, 200);
  assert.equal(crew.body.fields.name.stringValue, 'Ghat Ghosts');
  // ... but crews and join codes can NOT be queried / listed (that is the whole point of join_codes)
  assert.equal((await fetch(`${base}:runQuery`, { method: 'POST', headers: H, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'crews' }], where: { fieldFilter: { field: { fieldPath: 'join_code' }, op: 'EQUAL', value: { stringValue: 'GH7S2K' } } } } }) })).status, 403);
  assert.equal((await fetch(`${base}/join_codes`, { headers: H })).status, 403);
  assert.equal((await fetch(`${base}/crews`, { headers: H })).status, 403);

  // the next ride: RSVPs readable by a member, status planned, crew linked
  const nextCode = await get('join_codes/K7M2QX');
  assert.equal(nextCode.body.fields.kind.stringValue, 'ride');
  const next = (await get(`groups/${nextCode.body.fields.target_id.stringValue}`)).body;
  assert.equal(next.fields.status.stringValue, 'planned');
  assert.ok(next.fields.crew_id.stringValue.includes('crew-ghosts'));
  const rs = await fetch(`${base}/${next.name.split('/documents/')[1]}/rsvp`, { headers: H }).then((r) => r.json());
  assert.equal(rs.documents.length, 6);
});

test('the seeded rides satisfy the rules\' schema: the creator edits one, a member steps its status, a hazard vote works', { skip }, async () => {
  const si = await signIn(EMAIL, PASSWORD);
  const uid = si.body.localId;
  const H = { 'content-type': 'application/json', authorization: `Bearer ${si.body.idToken}` };
  const base = `http://${FS}/v1/projects/${PROJECT}/databases/(default)/documents`;
  const db = admin.firestore();
  const gid = (await db.collection('groups').where('name', '==', 'Sunday Ghat Run').get()).docs[0].id;
  const patch = async (path, fields, body) => (await fetch(`${base}/${path}?${fields.map((f) => `updateMask.fieldPaths=${f}`).join('&')}&currentDocument.exists=true`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields: body }) })).status;
  // teamDSY created Sunday Ghat Run: renaming it validates the WHOLE seeded document against the schema
  assert.equal(await patch(`groups/${gid}`, ['name'], { name: { stringValue: 'Sunday Ghat Run' } }), 200);
  // a member steps planned -> meetup
  assert.equal(await patch(`groups/${gid}`, ['status'], { status: { stringValue: 'meetup' } }), 200);
  // ... and cannot skip ahead to finished
  assert.equal(await patch(`groups/${gid}`, ['status', 'finished_ms'], { status: { stringValue: 'finished' }, finished_ms: { integerValue: '5' } }), 403);
  // a "gone" vote on a seeded hazard cluster of the ride (re-writes the full cluster, so it validates its schema)
  const hz = (await db.collection('hazards').where('group_id', '==', gid).where('status', '==', 'active').get()).docs[0];
  assert.equal(await patch(`hazards/${hz.id}`, ['gone_votes'], { gone_votes: { arrayValue: { values: [{ stringValue: uid }] } } }), 200);
});

test('a second, unrelated signed-in rider sees none of it: no crews, rides, locations, SOS, hazards; and cannot enumerate codes', { skip }, async () => {
  const su = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'stranger@example.com', password: 'stranger-pass-1', returnSecureToken: true }),
  }).then((r) => r.json());
  const H = { 'content-type': 'application/json', authorization: `Bearer ${su.idToken}` };
  const base = `http://${FS}/v1/projects/${PROJECT}/databases/(default)/documents`;
  const db = admin.firestore();
  const gid = (await db.collection('groups').where('name', '==', 'Sunday Ghat Run').get()).docs[0].id;
  const cid = (await db.collection('crews').get()).docs[0].id;
  const status = async (p) => (await fetch(`${base}/${p}`, { headers: H })).status;
  assert.equal(await status(`groups/${gid}`), 403);
  assert.equal(await status(`crews/${cid}`), 403);
  assert.equal(await status('groups'), 403);
  assert.equal(await status('crews'), 403);
  assert.equal(await status('join_codes'), 403);
  assert.equal(await status(`groups/${gid}/locations`), 403);
  assert.equal(await status(`groups/${gid}/rsvp`), 403);
  assert.equal(await status('hazards'), 403);
  assert.equal(await status('sos_events'), 403);
  const hz = await fetch(`${base}:runQuery`, { method: 'POST', headers: H, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'hazards' }], where: { compositeFilter: { op: 'AND', filters: [
    { fieldFilter: { field: { fieldPath: 'group_id' }, op: 'EQUAL', value: { stringValue: gid } } },
    { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'active' } } }] } } } }) });
  assert.equal(hz.status, 403);
  // a code is usable only if known: this one-document get works for any signed-in rider
  assert.equal(await status('join_codes/K7M2QX'), 200);
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
  assert.equal((await db.collection('join_codes').get()).size, 9);
  assert.equal((await db.collection(`users/${a.uid}/ride_logs`).get()).size, 4);
});

test('--remove deletes the account and everything seeded', { skip }, async () => {
  const db = admin.firestore();
  const auth = admin.auth();
  await remove(db, auth);
  assert.equal((await db.collection('groups').get()).size, 0);
  assert.equal((await db.collection('hazards').get()).size, 0);
  assert.equal((await db.collection('crews').get()).size, 0);
  assert.equal((await db.collection('join_codes').get()).size, 0);
  assert.equal((await db.collection('users').get()).size, 0);
  await assert.rejects(auth.getUserByEmail(EMAIL));
});
