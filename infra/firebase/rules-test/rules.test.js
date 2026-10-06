/**
 * Positive paths: every legitimate flow of the app must keep working under the hardened rules.
 * (attack.test.js holds the denials.)
 *   cd infra/firebase && npx firebase-tools@13.35.1 emulators:exec --only firestore --project demo-weride \
 *     "npm --prefix rules-test test"
 */
const test = require('node:test');
const { assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { fb, harness, world, CODE, CODE2, crewDoc, groupDoc, hazardDoc, sosDoc, reportDoc, locDoc } = require('./helpers');
const { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, getDocs, query, where, arrayUnion, arrayRemove, writeBatch, serverTimestamp, deleteField, documentId } = fb;

const h = harness(test);
const { as, anon, seed } = h;
const proof = (code, uid) => `${code}:${uid}`;

// --------------------------------------------------------------------------------------------- users

test('profile: signed-in riders read it, only the owner writes it, anonymous reads nothing', async () => {
  await assertSucceeds(setDoc(doc(as('a'), 'users/a'), { name: 'A', bike: 'Duke 390', style: 'Steady', created_ms: 1 }));
  await assertSucceeds(getDoc(doc(as('b'), 'users/a')));
  await assertFails(setDoc(doc(as('b'), 'users/a'), { name: 'hacked' }));
  await assertFails(getDoc(doc(anon(), 'users/a')));
});

test('profile: the app\'s own writes (saveProfile merge, bumpStats increments) are accepted', async () => {
  await assertSucceeds(setDoc(doc(as('a'), 'users/a'), { name: 'Rider', bike: '', style: 'Relaxed', created_ms: 5 }, { merge: true }));
  await assertSucceeds(setDoc(doc(as('a'), 'users/a'), { stats: { km: fb.increment(12.5), rides: fb.increment(1), together_sum: fb.increment(80) } }, { merge: true }));
  await assertSucceeds(setDoc(doc(as('a'), 'users/a'), { stats: { km: fb.increment(3), rides: fb.increment(1), together_sum: fb.increment(100) } }, { merge: true }));
  const s = (await getDoc(doc(as('a'), 'users/a'))).data().stats;
  if (s.km !== 15.5 || s.rides !== 2) throw new Error(`stats ${JSON.stringify(s)}`);
});

test('profiles of several riders can be fetched with an `in` documentId query (getProfiles)', async () => {
  await seed(async (db) => { await setDoc(doc(db, 'users/a'), { name: 'A' }); await setDoc(doc(db, 'users/b'), { name: 'B' }); });
  const snap = await assertSucceeds(getDocs(query(collection(as('z'), 'users'), where(documentId(), 'in', ['a', 'b']))));
  if (snap.size !== 2) throw new Error('expected 2 profiles');
});

test('private settings (prefs, contacts, push token) and ride logs are owner-only', async () => {
  await assertSucceeds(setDoc(doc(as('a'), 'users/a/private/settings'), { contacts: [{ id: 'c1', name: 'Mom', number: '+919800000000' }] }, { merge: true }));
  await assertSucceeds(getDoc(doc(as('a'), 'users/a/private/settings')));
  await assertSucceeds(setDoc(doc(as('a'), 'users/a/ride_logs/r1'), { km: 10 }));
  await assertSucceeds(getDocs(query(collection(as('a'), 'users/a/ride_logs'))));
  await assertFails(getDoc(doc(as('b'), 'users/a/private/settings')));
  await assertFails(getDoc(doc(as('b'), 'users/a/ride_logs/r1')));
});

// --------------------------------------------------------------------------------------------- crews

test('crew: create (with its join_codes doc in the same batch), look up the code, join, list mine, leave', async () => {
  await world(h);
  // allocate: the code is free (get on a missing doc is allowed)
  const free = await assertSucceeds(getDoc(doc(as('n'), 'join_codes/NEWC22')));
  if (free.exists()) throw new Error('should be free');

  const nDb = as('n');
  const b = writeBatch(nDb);
  b.set(doc(nDb, 'crews/cn'), { name: 'New Crew', created_by: 'n', member_ids: ['n'], roles: { n: 'lead' }, join_code: 'NEWC22', created_at: serverTimestamp() });
  b.set(doc(nDb, 'join_codes/NEWC22'), { kind: 'crew', target_id: 'cn' });
  await assertSucceeds(b.commit());

  // another rider resolves the code, joins with the proof, then can read the crew
  const found = await assertSucceeds(getDoc(doc(as('m'), 'join_codes/NEWC22')));
  if (found.data().kind !== 'crew' || found.data().target_id !== 'cn') throw new Error('code lookup failed');
  await assertSucceeds(updateDoc(doc(as('m'), 'crews/cn'), { member_ids: arrayUnion('m'), join_proof: proof('NEWC22', 'm') }));
  const c = await assertSucceeds(getDoc(doc(as('m'), 'crews/cn')));
  if (!c.data().member_ids.includes('m')) throw new Error('not joined');

  // a third rider can join too (the stored proof of m does not get in the way)
  await assertSucceeds(updateDoc(doc(as('o'), 'crews/cn'), { member_ids: arrayUnion('o'), join_proof: proof('NEWC22', 'o') }));

  // my crews (the app's subscribeMyCrews query)
  const mine = await assertSucceeds(getDocs(query(collection(as('m'), 'crews'), where('member_ids', 'array-contains', 'm'))));
  if (mine.size !== 1) throw new Error('my crews');

  // leave: remove yourself and your role
  await assertSucceeds(updateDoc(doc(as('m'), 'crews/cn'), { member_ids: arrayRemove('m'), ['roles.m']: deleteField() }));
  await assertFails(getDoc(doc(as('m'), 'crews/cn')));
});

test('crew: a rider who is already a member can leave and, with the code, rejoin', async () => {
  await world(h);
  await assertSucceeds(updateDoc(doc(as('b'), 'crews/c1'), { member_ids: arrayRemove('b'), ['roles.b']: deleteField() }));
  await assertSucceeds(updateDoc(doc(as('b'), 'crews/c1'), { member_ids: arrayUnion('b'), join_proof: proof(CODE, 'b') }));
});

test('crew: the creator renames the crew and manages roles; join code docs can be removed by the creator only', async () => {
  await world(h);
  await assertSucceeds(updateDoc(doc(as('a'), 'crews/c1'), { name: 'Ghost Riders' }));
  await assertSucceeds(updateDoc(doc(as('a'), 'crews/c1'), { roles: { a: 'lead', b: 'sweep' } }));
  await assertSucceeds(deleteDoc(doc(as('a'), `join_codes/${CODE}`)));
});

// --------------------------------------------------------------------------------------------- rides

test('ride: create a solo ride + its join code in one batch, then another rider joins with the code', async () => {
  await world(h);
  const nDb = as('n');
  const b = writeBatch(nDb);
  b.set(doc(nDb, 'groups/gn'), {
    name: 'Lonavala Run', created_by: 'n', member_ids: ['n'], created_at: serverTimestamp(), active_ride_id: null, join_code: 'RYDE22', status: 'planned',
    start_time_ms: 1800000000000, invited_ids: [], meetup: { label: 'Bandra', lat: 19, lng: 72.8 }, pace: 'Steady', ride_type: 'Touring',
    ride_plan: { start: { label: 'Bandra', lat: 19, lng: 72.8 }, destination: { label: 'L', lat: 18, lng: 73 }, stops: [{ id: 's', label: 'Shell', lat: 1, lng: 2, icon: 'x' }], route: { distance_km: 84, eta_minutes: 125, safety_score: 0.9, path: [19, 72.8, 18, 73] } },
  });
  b.set(doc(nDb, 'join_codes/RYDE22'), { kind: 'ride', target_id: 'gn' });
  await assertSucceeds(b.commit());
  const hit = await assertSucceeds(getDoc(doc(as('m'), 'join_codes/RYDE22')));
  if (hit.data().kind !== 'ride') throw new Error('kind');
  await assertSucceeds(updateDoc(doc(as('m'), 'groups/gn'), { member_ids: arrayUnion('m'), join_proof: proof('RYDE22', 'm') }));
  await assertSucceeds(getDoc(doc(as('m'), 'groups/gn')));
});

test('ride: the legacy GroupService group (no status/crew) is created and joined the same way', async () => {
  await world(h);
  const nDb = as('n');
  const b = writeBatch(nDb);
  b.set(doc(nDb, 'groups/gl'), { name: 'Ride 1', created_by: 'n', member_ids: ['n'], created_at: serverTimestamp(), active_ride_id: null, join_code: 'GGCY22' });
  b.set(doc(nDb, 'join_codes/GGCY22'), { kind: 'ride', target_id: 'gl' });
  await assertSucceeds(b.commit());
  await assertSucceeds(updateDoc(doc(as('m'), 'groups/gl'), { member_ids: arrayUnion('m'), join_proof: proof('GGCY22', 'm') }));
});

test('ride: a crew ride can be created with invitees who are members of that crew', async () => {
  await world(h);
  // a is in c1 with b; b is also in the crew
  const aDb = as('a');
  const b = writeBatch(aDb);
  b.set(doc(aDb, 'groups/gc'), { name: 'Crew run', created_by: 'a', member_ids: ['a', 'b'], invited_ids: ['b'], crew_id: 'c1', created_at: serverTimestamp(), join_code: 'CREW22', status: 'planned' });
  b.set(doc(aDb, 'join_codes/CREW22'), { kind: 'ride', target_id: 'gc' });
  await assertSucceeds(b.commit());
  await assertSucceeds(getDoc(doc(as('b'), 'groups/gc')));
});

test('ride: members of the crew can read the crew\'s rides (next-ride query) without being in the ride; strangers cannot', async () => {
  await world(h);
  await seed((db) => setDoc(doc(db, 'crews/c1'), crewDoc({ member_ids: ['a', 'b', 'k'] })));
  const snap = await assertSucceeds(getDocs(query(collection(as('k'), 'groups'), where('crew_id', '==', 'c1'))));
  if (snap.size !== 1) throw new Error('crew ride query');
  await assertFails(getDocs(query(collection(as('z'), 'groups'), where('crew_id', '==', 'c1'))));
});

test('ride: my rides (array-contains) and a single ride are readable by members', async () => {
  await world(h);
  const mine = await assertSucceeds(getDocs(query(collection(as('b'), 'groups'), where('member_ids', 'array-contains', 'b'))));
  if (mine.size !== 1) throw new Error('my rides');
  await assertSucceeds(getDoc(doc(as('b'), 'groups/g1')));
});

test('ride: leave', async () => {
  await world(h);
  await assertSucceeds(updateDoc(doc(as('b'), 'groups/g1'), { member_ids: arrayRemove('b') }));
});

test('ride: the creator edits the plan', async () => {
  await world(h);
  await assertSucceeds(updateDoc(doc(as('a'), 'groups/g1'), { name: 'Renamed', pace: 'Relaxed', start_time_ms: 5 }));
});

test('ride status: any member steps planned -> meetup -> live -> finished (roll-call flow), stamping the times', async () => {
  await world(h);
  await assertSucceeds(updateDoc(doc(as('b'), 'groups/g1'), { status: 'meetup' }));
  await assertSucceeds(updateDoc(doc(as('a'), 'groups/g1'), { status: 'live', started_ms: 100 }));
  await assertSucceeds(updateDoc(doc(as('b'), 'groups/g1'), { status: 'finished', finished_ms: 200 }));
});

test('ride status: a legacy ride without a status field starts at planned', async () => {
  await world(h);
  await seed((db) => setDoc(doc(db, 'groups/g1'), (() => { const { status, ...rest } = groupDoc({ crew_id: 'c1' }); return rest; })()));
  await assertSucceeds(updateDoc(doc(as('b'), 'groups/g1'), { status: 'meetup' }));
});

for (const [sub, data] of [['rsvp', { status: 'going', updated_ms: 1 }], ['roll_call', { state: 'ready', updated_ms: 1 }], ['presence', { state: 'arrived', updated_ms: 1 }]]) {
  test(`${sub}: members read the whole list, a rider writes only their own doc`, async () => {
    await world(h);
    await assertSucceeds(setDoc(doc(as('b'), `groups/g1/${sub}/b`), data));
    await assertSucceeds(setDoc(doc(as('b'), `groups/g1/${sub}/b`), data)); // idempotent re-write
    await assertSucceeds(getDocs(collection(as('a'), `groups/g1/${sub}`)));
    await assertFails(getDocs(collection(as('z'), `groups/g1/${sub}`)));
  });
}

test('locations: members publish their own position and read everyone\'s', async () => {
  await world(h);
  await assertSucceeds(setDoc(doc(as('b'), 'groups/g1/locations/b'), locDoc({ rider_id: 'b' })));
  const snap = await assertSucceeds(getDocs(collection(as('a'), 'groups/g1/locations')));
  if (snap.size !== 2) throw new Error('locations');
  await assertSucceeds(getDoc(doc(as('b'), 'groups/g1/locations/a')));
});

// --------------------------------------------------------------------------------------------- hazards

test('hazard reports: a member files a report, re-sends it idempotently (offline sync retry), and reads the group\'s reports', async () => {
  await world(h);
  await assertSucceeds(setDoc(doc(as('b'), 'groups/g1/reports/rb'), reportDoc({ report_id: 'rb', rider_id: 'b' })));
  await assertSucceeds(setDoc(doc(as('b'), 'groups/g1/reports/rb'), reportDoc({ report_id: 'rb', rider_id: 'b' })));
  const snap = await assertSucceeds(getDocs(collection(as('a'), 'groups/g1/reports')));
  if (snap.size !== 2) throw new Error('reports');
});

test('hazard clusters: members cluster, query "active by group", vote gone and resolve', async () => {
  await world(h);
  // triggerClustering: batch.set of cluster docs
  const aDb = as('a');
  const b = writeBatch(aDb);
  b.set(doc(aDb, 'hazards/h2'), hazardDoc({ cluster_id: 'h2', polygon_points: [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }] }));
  await assertSucceeds(b.commit());
  // re-cluster over an existing cluster (set replaces the doc)
  await assertSucceeds(setDoc(doc(as('b'), 'hazards/h2'), hazardDoc({ cluster_id: 'h2', report_count: 3 })));
  // subscribeToHazardClusters query
  const active = await assertSucceeds(getDocs(query(collection(as('b'), 'hazards'), where('group_id', '==', 'g1'), where('status', '==', 'active'))));
  if (active.size !== 2) throw new Error('active hazards');
  // "Gone" votes by two different riders, then resolve
  await assertSucceeds(updateDoc(doc(as('a'), 'hazards/h1'), { gone_votes: arrayUnion('a') }));
  await assertSucceeds(updateDoc(doc(as('b'), 'hazards/h1'), { gone_votes: arrayUnion('b') }));
  await assertSucceeds(updateDoc(doc(as('b'), 'hazards/h1'), { status: 'resolved' }));
  await assertSucceeds(getDoc(doc(as('a'), 'hazards/h1')));
});

test('hazard clusters: a re-clustering batch of many clusters stays inside the rules\' lookup budget', async () => {
  await world(h);
  const db = as('a');
  const b = writeBatch(db);
  for (let i = 0; i < 25; i++) b.set(doc(db, `hazards/bulk${i}`), hazardDoc({ cluster_id: `bulk${i}` }));
  await assertSucceeds(b.commit());
});

// --------------------------------------------------------------------------------------------- SOS

test('SOS: a member raises one, the group queries it, the sender resolves it (and a sync retry is idempotent)', async () => {
  await world(h);
  await assertSucceeds(setDoc(doc(as('b'), 'sos_events/sb'), sosDoc({ sos_id: 'sb', rider_id: 'b' })));
  await assertSucceeds(setDoc(doc(as('b'), 'sos_events/sb'), sosDoc({ sos_id: 'sb', rider_id: 'b' }))); // queued create replayed
  const snap = await assertSucceeds(getDocs(query(collection(as('a'), 'sos_events'), where('group_id', '==', 'g1'))));
  if (snap.size !== 2) throw new Error('sos query');
  await assertSucceeds(getDoc(doc(as('a'), 'sos_events/sb')));
  await assertSucceeds(updateDoc(doc(as('b'), 'sos_events/sb'), { resolved: true, resolved_at_hlc: '2:0' }));
});

test('SOS responders: ride members read, a rider writes only their own', async () => {
  await world(h);
  await assertSucceeds(setDoc(doc(as('b'), 'sos_events/s1/responders/b'), { state: 'arrived', updated_ms: 2 }, { merge: true }));
  await assertSucceeds(getDocs(collection(as('a'), 'sos_events/s1/responders')));
});

// --------------------------------------------------------------------------------------------- join_codes

test('join_codes: any signed-in rider can `get` a code (and gets "missing" for a free one); nobody can list', async () => {
  await world(h);
  await assertSucceeds(getDoc(doc(as('z'), `join_codes/${CODE}`)));
  await assertSucceeds(getDoc(doc(as('z'), 'join_codes/NOPE22')));
  await assertFails(getDocs(collection(as('a'), 'join_codes')));
});

test('server-owned collections: fl_rounds readable, routes readable by the ride\'s members only', async () => {
  await seed(async (db) => { await setDoc(doc(db, 'fl_rounds/1'), { round: 1 }); await setDoc(doc(db, 'routes/r'), { group_id: 'g1' }); await setDoc(doc(db, 'groups/g1'), groupDoc()); });
  await assertSucceeds(getDoc(doc(as('z'), 'fl_rounds/1')));
  await assertSucceeds(getDoc(doc(as('a'), 'routes/r')));
});
