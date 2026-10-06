/**
 * ATTACK suite: every test is named `attack: ...` and asserts that the rules DENY it. Each is the smallest variant of a
 * write/read that a legitimate flow does (rules.test.js proves the legitimate flow works), so a denial here is
 * for the right reason. Run against the old rules with `npm run test:old` to see which of these used to succeed.
 *
 *   cd infra/firebase && npx firebase-tools@13.35.1 emulators:exec --only firestore --project demo-weride \
 *     "npm --prefix rules-test test"
 */
const test = require('node:test');
const { assertFails } = require('@firebase/rules-unit-testing');
const { fb, harness, world, CODE, CODE2, crewDoc, groupDoc, hazardDoc, sosDoc, reportDoc, locDoc } = require('./helpers');
const { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, getDocs, query, where, arrayUnion, arrayRemove, writeBatch, serverTimestamp, deleteField } = fb;

const h = harness(test);
const { as, anon, seed } = h;
test.beforeEach(async () => world(h));

const proof = (code, uid) => `${code}:${uid}`;

// ===================================================================== enumeration / reads by strangers

test('attack: a stranger reads a crew (name, members, join code)', async () => {
  await assertFails(getDoc(doc(as('z'), 'crews/c1')));
});
test('attack: a stranger lists every crew', async () => {
  await assertFails(getDocs(collection(as('z'), 'crews')));
});
test('attack: a stranger resolves a crew join code by querying crews', async () => {
  await assertFails(getDocs(query(collection(as('z'), 'crews'), where('join_code', '==', CODE))));
});
test('attack: a stranger reads a ride (plan, members, join code)', async () => {
  await assertFails(getDoc(doc(as('z'), 'groups/g1')));
});
test('attack: a stranger lists every ride', async () => {
  await assertFails(getDocs(collection(as('z'), 'groups')));
});
test('attack: a stranger resolves a ride join code by querying groups', async () => {
  await assertFails(getDocs(query(collection(as('z'), 'groups'), where('join_code', '==', CODE2))));
});
test('attack: a stranger claims to be a member via array-contains on someone else\'s uid', async () => {
  await assertFails(getDocs(query(collection(as('z'), 'groups'), where('member_ids', 'array-contains', 'a'))));
  await assertFails(getDocs(query(collection(as('z'), 'crews'), where('member_ids', 'array-contains', 'a'))));
});
test('attack: a stranger reads live rider locations (one doc and the whole list)', async () => {
  await assertFails(getDoc(doc(as('z'), 'groups/g1/locations/a')));
  await assertFails(getDocs(collection(as('z'), 'groups/g1/locations')));
});
test('attack: a member of ANOTHER ride reads this ride\'s locations, roll call, presence, rsvp, reports', async () => {
  for (const sub of ['locations', 'roll_call', 'presence', 'rsvp', 'reports']) {
    await assertFails(getDocs(collection(as('x'), `groups/g1/${sub}`)));
  }
});
test('attack: a stranger reads SOS events (by id and by group query) and their responders', async () => {
  await assertFails(getDoc(doc(as('z'), 'sos_events/s1')));
  await assertFails(getDocs(query(collection(as('z'), 'sos_events'), where('group_id', '==', 'g1'))));
  await assertFails(getDocs(collection(as('z'), 'sos_events')));
  await assertFails(getDocs(collection(as('z'), 'sos_events/s1/responders')));
});
test('attack: a member of another ride reads this ride\'s SOS', async () => {
  await assertFails(getDocs(query(collection(as('x'), 'sos_events'), where('group_id', '==', 'g1'))));
});
test('attack: a stranger reads hazards (by id, by group query, whole collection)', async () => {
  await assertFails(getDoc(doc(as('z'), 'hazards/h1')));
  await assertFails(getDocs(query(collection(as('z'), 'hazards'), where('group_id', '==', 'g1'), where('status', '==', 'active'))));
  await assertFails(getDocs(collection(as('z'), 'hazards')));
});
test('attack: reading the legacy top-level hazard_reports', async () => {
  await seed((db) => setDoc(doc(db, 'hazard_reports/x'), { rider_id: 'a', lat: 1, lng: 2 }));
  await assertFails(getDoc(doc(as('z'), 'hazard_reports/x')));
});
test('attack: anyone signed in dumps the join_codes collection or queries it', async () => {
  await assertFails(getDocs(collection(as('z'), 'join_codes')));
  await assertFails(getDocs(query(collection(as('z'), 'join_codes'), where('kind', '==', 'crew'))));
  await assertFails(getDocs(query(collection(as('a'), 'join_codes'), where('target_id', '==', 'c1'))));
});
test('attack: an anonymous (signed-out) client reads a join code, a crew, a ride', async () => {
  await assertFails(getDoc(doc(anon(), `join_codes/${CODE}`)));
  await assertFails(getDoc(doc(anon(), 'crews/c1')));
  await assertFails(getDoc(doc(anon(), 'groups/g1')));
});
test('attack: reading another rider\'s private settings and ride logs', async () => {
  await assertFails(getDoc(doc(as('z'), 'users/a/private/settings')));
  await assertFails(getDocs(collection(as('z'), 'users/a/ride_logs')));
  await assertFails(getDoc(doc(as('z'), 'users/a/ride_logs/r1')));
});
test('attack: writing another rider\'s private settings and ride logs', async () => {
  await assertFails(setDoc(doc(as('z'), 'users/a/private/settings'), { contacts: [] }));
  await assertFails(setDoc(doc(as('z'), 'users/a/ride_logs/r9'), { km: 999 }));
  await assertFails(deleteDoc(doc(as('z'), 'users/a/ride_logs/r1')));
});
test('attack: reading a route that belongs to someone else\'s ride', async () => {
  await seed((db) => setDoc(doc(db, 'routes/rt1'), { group_id: 'g1', path: [1, 2] }));
  await assertFails(getDoc(doc(as('z'), 'routes/rt1')));
});

// ===================================================================== joining a crew / ride

for (const [kind, coll, id, code] of [['crew', 'crews', 'c1', CODE], ['ride', 'groups', 'g1', CODE2]]) {
  test(`attack: a stranger adds themselves to a ${kind} without the code (no join_proof)`, async () => {
    await assertFails(updateDoc(doc(as('z'), `${coll}/${id}`), { member_ids: arrayUnion('z') }));
  });
  test(`attack: a stranger joins a ${kind} with a wrong code`, async () => {
    await assertFails(updateDoc(doc(as('z'), `${coll}/${id}`), { member_ids: arrayUnion('z'), join_proof: proof('ZZZZZZ', 'z') }));
    await assertFails(updateDoc(doc(as('z'), `${coll}/${id}`), { member_ids: arrayUnion('z'), join_proof: 'x' }));
  });
  test(`attack: a stranger joins a ${kind} with the bare code instead of the per-rider proof`, async () => {
    await assertFails(updateDoc(doc(as('z'), `${coll}/${id}`), { member_ids: arrayUnion('z'), join_proof: code }));
  });
  test(`attack: a stranger joins a ${kind} using ANOTHER rider's proof`, async () => {
    await assertFails(updateDoc(doc(as('z'), `${coll}/${id}`), { member_ids: arrayUnion('z'), join_proof: proof(code, 'someone-else') }));
  });
  test(`attack: a stranger re-uses the proof an earlier joiner left in the ${kind} (no proof of their own)`, async () => {
    await updateDoc(doc(as('c'), `${coll}/${id}`), { member_ids: arrayUnion('c'), join_proof: proof(code, 'c') }).catch(() => {});
    // whatever happened to c, z sends no proof at all: the stored field must not count
    await assertFails(updateDoc(doc(as('z'), `${coll}/${id}`), { member_ids: arrayUnion('z') }));
  });
  test(`attack: a stranger adds someone else (not themselves) to a ${kind} with a valid proof`, async () => {
    await assertFails(updateDoc(doc(as('z'), `${coll}/${id}`), { member_ids: arrayUnion('victim'), join_proof: proof(code, 'z') }));
  });
  test(`attack: a stranger adds themselves AND a friend to a ${kind}`, async () => {
    await assertFails(updateDoc(doc(as('z'), `${coll}/${id}`), { member_ids: arrayUnion('z', 'friend'), join_proof: proof(code, 'z') }));
  });
  test(`attack: a stranger joins a ${kind} and in the same write changes its name`, async () => {
    await assertFails(updateDoc(doc(as('z'), `${coll}/${id}`), { member_ids: arrayUnion('z'), join_proof: proof(code, 'z'), name: 'pwned' }));
  });
  test(`attack: a stranger joins a ${kind} and in the same write takes over created_by`, async () => {
    await assertFails(updateDoc(doc(as('z'), `${coll}/${id}`), { member_ids: arrayUnion('z'), join_proof: proof(code, 'z'), created_by: 'z' }));
  });
  test(`attack: a stranger joins a ${kind} and in the same write rotates the join code`, async () => {
    await assertFails(updateDoc(doc(as('z'), `${coll}/${id}`), { member_ids: arrayUnion('z'), join_proof: proof(code, 'z'), join_code: 'ZZZZZ2' }));
  });
  test(`attack: a stranger joins a ${kind} and in the same write makes themselves a lead / alters roles`, async () => {
    await assertFails(updateDoc(doc(as('z'), `${coll}/${id}`), { member_ids: arrayUnion('z'), join_proof: proof(code, 'z'), roles: { a: 'lead', z: 'lead' } }));
  });
  test(`attack: a stranger joins a ${kind} and in the same write kicks the existing members`, async () => {
    await assertFails(updateDoc(doc(as('z'), `${coll}/${id}`), { member_ids: ['z'], join_proof: proof(code, 'z') }));
  });
  test(`attack: a stranger rewrites a ${kind} (no join at all): rename, takeover, kick`, async () => {
    await assertFails(updateDoc(doc(as('z'), `${coll}/${id}`), { name: 'pwned' }));
    await assertFails(updateDoc(doc(as('z'), `${coll}/${id}`), { created_by: 'z' }));
    await assertFails(updateDoc(doc(as('z'), `${coll}/${id}`), { member_ids: ['z'] }));
  });
}
test('attack: a stranger joins a ride and in the same write advances the ride status', async () => {
  await assertFails(updateDoc(doc(as('z'), 'groups/g1'), { member_ids: arrayUnion('z'), join_proof: proof(CODE2, 'z'), status: 'finished' }));
});
test('attack: a stranger joins a ride and in the same write swaps its ride_plan', async () => {
  await assertFails(updateDoc(doc(as('z'), 'groups/g1'), { member_ids: arrayUnion('z'), join_proof: proof(CODE2, 'z'), ride_plan: { destination: { label: 'evil', lat: 0, lng: 0 } } }));
});
test('attack: joining a crew with the code of a DIFFERENT crew/ride', async () => {
  await assertFails(updateDoc(doc(as('z'), 'crews/c1'), { member_ids: arrayUnion('z'), join_proof: proof(CODE2, 'z') }));
  await assertFails(updateDoc(doc(as('z'), 'groups/g1'), { member_ids: arrayUnion('z'), join_proof: proof(CODE, 'z') }));
});
test('attack: a former member rejoins with a proof stored before the code was rotated', async () => {
  // c joined with the old code, left; the creator rotates the code; the stale proof must no longer work
  await seed(async (db) => {
    await setDoc(doc(db, 'crews/c1'), crewDoc({ member_ids: ['a', 'b'], join_proof: proof(CODE, 'c'), join_code: 'NEWC02' }));
  });
  await assertFails(updateDoc(doc(as('c'), 'crews/c1'), { member_ids: arrayUnion('c') }));
});

// ===================================================================== what members may NOT do

test('attack: a crew member promotes themselves to lead', async () => {
  await assertFails(updateDoc(doc(as('b'), 'crews/c1'), { roles: { a: 'lead', b: 'lead' } }));
  await assertFails(updateDoc(doc(as('b'), 'crews/c1'), { 'roles.b': 'lead' }));
});
test('attack: a non-creator crew member takes over created_by / renames / changes the join code', async () => {
  await assertFails(updateDoc(doc(as('b'), 'crews/c1'), { created_by: 'b' }));
  await assertFails(updateDoc(doc(as('b'), 'crews/c1'), { name: 'mine now' }));
  await assertFails(updateDoc(doc(as('b'), 'crews/c1'), { join_code: 'ZZZZZ2' }));
});
test('attack: a crew member adds a friend to member_ids without the friend going through the code', async () => {
  await assertFails(updateDoc(doc(as('b'), 'crews/c1'), { member_ids: arrayUnion('friend') }));
  await assertFails(updateDoc(doc(as('b'), 'groups/g1'), { member_ids: arrayUnion('friend') }));
});
test('attack: a member removes ANOTHER member (leaving "as someone else")', async () => {
  await assertFails(updateDoc(doc(as('b'), 'crews/c1'), { member_ids: arrayRemove('a') }));
  await assertFails(updateDoc(doc(as('b'), 'groups/g1'), { member_ids: arrayRemove('a') }));
});
test('attack: a member "leaves" but smuggles another change into the same write', async () => {
  await assertFails(updateDoc(doc(as('b'), 'crews/c1'), { member_ids: arrayRemove('b'), name: 'x' }));
  await assertFails(updateDoc(doc(as('b'), 'groups/g1'), { member_ids: arrayRemove('b'), created_by: 'b' }));
  await assertFails(updateDoc(doc(as('b'), 'crews/c1'), { member_ids: arrayRemove('b'), 'roles.b': 'lead' }));
});
test('attack: even the creator cannot hand the crew to someone else or edit its member list directly', async () => {
  await assertFails(updateDoc(doc(as('a'), 'crews/c1'), { created_by: 'b' }));
  await assertFails(updateDoc(doc(as('a'), 'crews/c1'), { member_ids: ['a', 'b', 'friend'] }));
  await assertFails(updateDoc(doc(as('a'), 'groups/g1'), { created_by: 'b' }));
  await assertFails(updateDoc(doc(as('a'), 'groups/g1'), { crew_id: 'other' }));
});
test('attack: a ride member (not the creator) rewrites the ride plan, name, join code or crew', async () => {
  await assertFails(updateDoc(doc(as('b'), 'groups/g1'), { ride_plan: { destination: { label: 'evil', lat: 0, lng: 0 } } }));
  await assertFails(updateDoc(doc(as('b'), 'groups/g1'), { name: 'hijacked' }));
  await assertFails(updateDoc(doc(as('b'), 'groups/g1'), { join_code: 'ZZZZZ2' }));
  await assertFails(updateDoc(doc(as('b'), 'groups/g1'), { crew_id: 'c9' }));
  await assertFails(updateDoc(doc(as('b'), 'groups/g1'), { created_by: 'b' }));
});
test('attack: deleting a crew or a ride', async () => {
  await assertFails(deleteDoc(doc(as('a'), 'crews/c1')));
  await assertFails(deleteDoc(doc(as('a'), 'groups/g1')));
});

// ===================================================================== ride status

test('attack: a stranger advances a ride\'s status', async () => {
  await assertFails(updateDoc(doc(as('z'), 'groups/g1'), { status: 'meetup' }));
  await assertFails(updateDoc(doc(as('z'), 'groups/g1'), { status: 'finished', finished_ms: 5 }));
});
test('attack: status skips planned -> finished (and planned -> live) even for a member', async () => {
  await assertFails(updateDoc(doc(as('b'), 'groups/g1'), { status: 'finished', finished_ms: 5 }));
  await assertFails(updateDoc(doc(as('b'), 'groups/g1'), { status: 'live', started_ms: 5 }));
});
test('attack: status goes backwards (live -> meetup / planned, finished -> live)', async () => {
  await seed((db) => updateDoc(doc(db, 'groups/g1'), { status: 'live', started_ms: 1 }));
  await assertFails(updateDoc(doc(as('b'), 'groups/g1'), { status: 'meetup' }));
  await assertFails(updateDoc(doc(as('b'), 'groups/g1'), { status: 'planned' }));
  await seed((db) => updateDoc(doc(db, 'groups/g1'), { status: 'finished', finished_ms: 2 }));
  await assertFails(updateDoc(doc(as('b'), 'groups/g1'), { status: 'live', started_ms: 9 }));
  await assertFails(updateDoc(doc(as('b'), 'groups/g1'), { status: 'finished', finished_ms: 99 }));
});
test('attack: a status step that also changes other fields', async () => {
  await assertFails(updateDoc(doc(as('b'), 'groups/g1'), { status: 'meetup', name: 'x' }));
  await assertFails(updateDoc(doc(as('b'), 'groups/g1'), { status: 'meetup', created_by: 'b' }));
  await assertFails(updateDoc(doc(as('b'), 'groups/g1'), { status: 'meetup', member_ids: ['b'] }));
});
test('attack: stamping started_ms / finished_ms on a step that is not live / finished', async () => {
  await assertFails(updateDoc(doc(as('b'), 'groups/g1'), { status: 'meetup', finished_ms: 5 }));
  await assertFails(updateDoc(doc(as('b'), 'groups/g1'), { status: 'meetup', started_ms: 5 }));
});
test('attack: an unknown status value', async () => {
  await assertFails(updateDoc(doc(as('b'), 'groups/g1'), { status: 'cancelled' }));
});

// ===================================================================== per-rider subcollections

for (const [sub, data] of [['rsvp', { status: 'going', updated_ms: 1 }], ['roll_call', { state: 'ready', updated_ms: 1 }], ['presence', { state: 'riding', updated_ms: 1 }], ['locations', locDoc({ rider_id: 'b' })]]) {
  test(`attack: writing another rider's ${sub} doc`, async () => {
    await assertFails(setDoc(doc(as('b'), `groups/g1/${sub}/a`), data));
    await assertFails(deleteDoc(doc(as('b'), `groups/g1/${sub}/a`)));
  });
  test(`attack: a non-member writes their own ${sub} doc into a ride they are not in`, async () => {
    await assertFails(setDoc(doc(as('z'), `groups/g1/${sub}/z`), { ...data, rider_id: 'z' }));
  });
  test(`attack: a member who LEFT keeps writing ${sub}`, async () => {
    await updateDoc(doc(as('b'), 'groups/g1'), { member_ids: arrayRemove('b') });
    await assertFails(setDoc(doc(as('b'), `groups/g1/${sub}/b`), { ...data, rider_id: 'b' }));
    await assertFails(getDocs(collection(as('b'), `groups/g1/${sub}`)));
  });
}
test('attack: a roll-call / presence / rsvp doc with a junk state or extra fields', async () => {
  await assertFails(setDoc(doc(as('b'), 'groups/g1/roll_call/b'), { state: 'god-mode', updated_ms: 1 }));
  await assertFails(setDoc(doc(as('b'), 'groups/g1/presence/b'), { state: 'riding', updated_ms: 1, payload: 'x'.repeat(1000) }));
  await assertFails(setDoc(doc(as('b'), 'groups/g1/rsvp/b'), { status: 'definitely', updated_ms: 1 }));
});
test('attack: a location doc forged for another rider, another group or with impossible coordinates', async () => {
  await assertFails(setDoc(doc(as('b'), 'groups/g1/locations/b'), locDoc({ rider_id: 'a' })));
  await assertFails(setDoc(doc(as('b'), 'groups/g1/locations/b'), locDoc({ rider_id: 'b', group_id: 'g2' })));
  await assertFails(setDoc(doc(as('b'), 'groups/g1/locations/b'), locDoc({ rider_id: 'b', lat: 999 })));
});

// ===================================================================== hazard reports / clusters

test('attack: forging rider_id on a hazard report', async () => {
  await assertFails(setDoc(doc(as('b'), 'groups/g1/reports/rx'), reportDoc({ report_id: 'rx', rider_id: 'a' })));
});
test('attack: a hazard report stamped for a different group than its path', async () => {
  await assertFails(setDoc(doc(as('b'), 'groups/g1/reports/rx'), reportDoc({ report_id: 'rx', rider_id: 'b', group_id: 'g2' })));
});
test('attack: a non-member files a hazard report into a ride', async () => {
  await assertFails(setDoc(doc(as('z'), 'groups/g1/reports/rz'), reportDoc({ report_id: 'rz', rider_id: 'z' })));
});
test('attack: a member overwrites or re-attributes someone else\'s hazard report', async () => {
  await assertFails(setDoc(doc(as('b'), 'groups/g1/reports/r1'), reportDoc({ rider_id: 'b', lat: 1 })));
  await assertFails(updateDoc(doc(as('b'), 'groups/g1/reports/r1'), { lat: 1 }));
  await assertFails(updateDoc(doc(as('a'), 'groups/g1/reports/r1'), { rider_id: 'b' }));
  await assertFails(deleteDoc(doc(as('a'), 'groups/g1/reports/r1')));
});
test('attack: writing the legacy top-level hazard_reports', async () => {
  await assertFails(setDoc(doc(as('z'), 'hazard_reports/spam'), { rider_id: 'z', blob: 'x'.repeat(10000) }));
});
test('attack: a stranger creates / edits / votes on hazard clusters of a ride they are not in', async () => {
  await assertFails(setDoc(doc(as('z'), 'hazards/hz'), hazardDoc({ cluster_id: 'hz' })));
  await assertFails(updateDoc(doc(as('z'), 'hazards/h1'), { gone_votes: arrayUnion('z') }));
  await assertFails(updateDoc(doc(as('z'), 'hazards/h1'), { status: 'resolved' }));
});
test('attack: a member of another ride plants a hazard cluster in this ride', async () => {
  await assertFails(setDoc(doc(as('x'), 'hazards/hz'), hazardDoc({ cluster_id: 'hz', group_id: 'g1' })));
});
test('attack: moving a hazard cluster to another group', async () => {
  await assertFails(updateDoc(doc(as('a'), 'hazards/h1'), { group_id: 'g2' }));
});
test('attack: casting a "gone" vote in someone else\'s name', async () => {
  await assertFails(updateDoc(doc(as('b'), 'hazards/h1'), { gone_votes: arrayUnion('a') }));
  await assertFails(updateDoc(doc(as('b'), 'hazards/h1'), { gone_votes: arrayUnion('b', 'c') }));
});
test('attack: hazard cluster with junk type / huge arrays / unknown fields', async () => {
  await assertFails(setDoc(doc(as('a'), 'hazards/hz'), hazardDoc({ cluster_id: 'hz', hazard_type: 'banana' })));
  await assertFails(setDoc(doc(as('a'), 'hazards/hz'), hazardDoc({ cluster_id: 'hz', polygon_points: Array.from({ length: 500 }, () => ({ lat: 1, lng: 2 })) })));
  await assertFails(setDoc(doc(as('a'), 'hazards/hz'), hazardDoc({ cluster_id: 'hz', gone_votes: Array.from({ length: 500 }, (_, i) => `u${i}`) })));
  await assertFails(setDoc(doc(as('a'), 'hazards/hz'), hazardDoc({ cluster_id: 'hz', evil: 'x' })));
});

// ===================================================================== SOS

test('attack: forging rider_id on an SOS event', async () => {
  await assertFails(setDoc(doc(as('b'), 'sos_events/sx'), sosDoc({ sos_id: 'sx', rider_id: 'a' })));
});
test('attack: raising an SOS into a ride you are not in', async () => {
  await assertFails(setDoc(doc(as('z'), 'sos_events/sz'), sosDoc({ sos_id: 'sz', rider_id: 'z' })));
});
test('attack: creating an SOS that is already resolved, or with a malformed position', async () => {
  await assertFails(setDoc(doc(as('a'), 'sos_events/sx'), sosDoc({ sos_id: 'sx', resolved: true })));
  await assertFails(setDoc(doc(as('a'), 'sos_events/sx'), sosDoc({ sos_id: 'sx', lat: 'north' })));
});
test('attack: resolving (cancelling) someone else\'s SOS', async () => {
  await assertFails(updateDoc(doc(as('b'), 'sos_events/s1'), { resolved: true, resolved_at_hlc: '2:0' }));
  await assertFails(updateDoc(doc(as('z'), 'sos_events/s1'), { resolved: true, resolved_at_hlc: '2:0' }));
});
test('attack: the sender "resolves" an SOS but also rewrites its position / owner', async () => {
  await assertFails(updateDoc(doc(as('a'), 'sos_events/s1'), { resolved: true, lat: 0, lng: 0 }));
  await assertFails(updateDoc(doc(as('a'), 'sos_events/s1'), { resolved: true, rider_id: 'b' }));
  await assertFails(updateDoc(doc(as('a'), 'sos_events/s1'), { resolved: true, group_id: 'g2' }));
});
test('attack: deleting an SOS event', async () => {
  await assertFails(deleteDoc(doc(as('a'), 'sos_events/s1')));
});
test('attack: writing another rider\'s SOS responder doc, or one as a stranger', async () => {
  await assertFails(setDoc(doc(as('b'), 'sos_events/s1/responders/a'), { state: 'going', updated_ms: 1 }));
  await assertFails(setDoc(doc(as('z'), 'sos_events/s1/responders/z'), { state: 'going', updated_ms: 1 }));
  await assertFails(setDoc(doc(as('b'), 'sos_events/s1/responders/b'), { state: 'teleporting', updated_ms: 1 }));
});

// ===================================================================== oversized / malformed documents

test('attack: crew with an oversized name, member list or roles map', async () => {
  await assertFails(setDoc(doc(as('z'), 'crews/cz'), { name: 'x'.repeat(10000), created_by: 'z', member_ids: ['z'], roles: { z: 'lead' }, join_code: 'ABCDE2' }));
  await assertFails(setDoc(doc(as('z'), 'crews/cz'), { name: 'ok', created_by: 'z', member_ids: ['z', ...Array.from({ length: 5000 }, (_, i) => `u${i}`)], roles: { z: 'lead' }, join_code: 'ABCDE2' }));
  await assertFails(setDoc(doc(as('z'), 'crews/cz'), { name: 'ok', created_by: 'z', member_ids: ['z'], roles: { z: 'lead' }, join_code: 'ABCDE2', blob: 'x'.repeat(5000) }));
});
test('attack: crew created with other people already in it, or in someone else\'s name', async () => {
  await assertFails(setDoc(doc(as('z'), 'crews/cz'), { name: 'ok', created_by: 'z', member_ids: ['z', 'victim'], roles: { z: 'lead' }, join_code: 'ABCDE2' }));
  await assertFails(setDoc(doc(as('z'), 'crews/cz'), { name: 'ok', created_by: 'victim', member_ids: ['z'], roles: { z: 'lead' }, join_code: 'ABCDE2' }));
  await assertFails(setDoc(doc(as('z'), 'crews/cz'), { name: 'ok', created_by: 'z', member_ids: ['victim'], roles: {}, join_code: 'ABCDE2' }));
});
test('attack: ride with an oversized name, member list, plan or arbitrary fields', async () => {
  const base = { created_by: 'z', member_ids: ['z'], join_code: 'ABCDE2', status: 'planned' };
  await assertFails(setDoc(doc(as('z'), 'groups/gz'), { ...base, name: 'x'.repeat(100000) }));
  await assertFails(setDoc(doc(as('z'), 'groups/gz'), { ...base, name: 'ok', member_ids: ['z', ...Array.from({ length: 5000 }, (_, i) => `u${i}`)] }));
  await assertFails(setDoc(doc(as('z'), 'groups/gz'), { ...base, name: 'ok', ride_plan: { stops: Array.from({ length: 2000 }, (_, i) => ({ id: `${i}`, label: 'x', lat: 1, lng: 2, icon: 'x' })) } }));
  await assertFails(setDoc(doc(as('z'), 'groups/gz'), { ...base, name: 'ok', is_admin: true, blob: 'x'.repeat(20000) }));
});
test('attack: ride created pre-populated with strangers, or already live / with a forged join_proof', async () => {
  const base = { name: 'ok', created_by: 'z', join_code: 'ABCDE2' };
  await assertFails(setDoc(doc(as('z'), 'groups/gz'), { ...base, member_ids: ['z', 'victim'], status: 'planned' }));
  await assertFails(setDoc(doc(as('z'), 'groups/gz'), { ...base, member_ids: ['z'], status: 'finished' }));
  await assertFails(setDoc(doc(as('z'), 'groups/gz'), { ...base, member_ids: ['z'], status: 'planned', join_proof: 'x' }));
  await assertFails(setDoc(doc(as('z'), 'groups/gz'), { ...base, created_by: 'victim', member_ids: ['z'], status: 'planned' }));
});
test('attack: a ride that claims membership of a crew the creator is not in, to invite that crew\'s members', async () => {
  await assertFails(setDoc(doc(as('z'), 'groups/gz'), { name: 'ok', created_by: 'z', member_ids: ['z', 'a'], join_code: 'ABCDE2', status: 'planned', crew_id: 'c1' }));
  await assertFails(setDoc(doc(as('z'), 'groups/gz'), { name: 'ok', created_by: 'z', member_ids: ['z'], join_code: 'ABCDE2', status: 'planned', crew_id: 'c1' }));
});
test('attack: a crew member invites people who are NOT in the crew into a ride', async () => {
  await assertFails(setDoc(doc(as('b'), 'groups/gz'), { name: 'ok', created_by: 'b', member_ids: ['b', 'outsider'], join_code: 'ABCDE2', status: 'planned', crew_id: 'c1' }));
});
test('attack: public profile with giant strings, a bogus style, negative / non-numeric stats or extra fields', async () => {
  await assertFails(setDoc(doc(as('z'), 'users/z'), { name: 'x'.repeat(100000), bike: 'b', style: 'Steady' }));
  await assertFails(setDoc(doc(as('z'), 'users/z'), { name: 'Z', bike: 'b'.repeat(5000), style: 'Steady' }));
  await assertFails(setDoc(doc(as('z'), 'users/z'), { name: 'Z', bike: 'b', style: 'Reckless' }));
  await assertFails(setDoc(doc(as('z'), 'users/z'), { name: 'Z', bike: 'b', style: 'Steady', stats: { km: -5, rides: 1, together_sum: 1 } }));
  await assertFails(setDoc(doc(as('z'), 'users/z'), { name: 'Z', bike: 'b', style: 'Steady', stats: { km: 'lots', rides: 1, together_sum: 1 } }));
  await assertFails(setDoc(doc(as('z'), 'users/z'), { name: 'Z', bike: 'b', style: 'Steady', stats: { km: 9e15, rides: 1, together_sum: 1 } }));
  await assertFails(setDoc(doc(as('z'), 'users/z'), { name: 'Z', bike: 'b', style: 'Steady', isAdmin: true }));
});
test('attack: writing another rider\'s public profile', async () => {
  await assertFails(setDoc(doc(as('z'), 'users/a'), { name: 'hacked' }));
  await assertFails(updateDoc(doc(as('z'), 'users/a'), { name: 'hacked' }));
});

// ===================================================================== join_codes documents

test('attack: hijacking another crew\'s code doc (overwrite, update, delete)', async () => {
  await assertFails(setDoc(doc(as('z'), `join_codes/${CODE}`), { kind: 'crew', target_id: 'zcrew' }));
  await assertFails(updateDoc(doc(as('z'), `join_codes/${CODE}`), { target_id: 'zcrew' }));
  await assertFails(deleteDoc(doc(as('z'), `join_codes/${CODE}`)));
});
test('attack: a plain member (not the creator) edits or deletes the code doc', async () => {
  await assertFails(updateDoc(doc(as('b'), `join_codes/${CODE}`), { target_id: 'other' }));
  await assertFails(deleteDoc(doc(as('b'), `join_codes/${CODE}`)));
  await assertFails(deleteDoc(doc(as('b'), `join_codes/${CODE2}`)));
});
test('attack: even the creator cannot repoint a code at a different target', async () => {
  await assertFails(updateDoc(doc(as('a'), `join_codes/${CODE}`), { target_id: 'g1', kind: 'ride' }));
});
test('attack: registering a code for a crew/ride someone else created (even as a member)', async () => {
  await seed((db) => updateDoc(doc(db, 'crews/c1'), { join_code: 'ZZZZZ2' }));
  await assertFails(setDoc(doc(as('b'), 'join_codes/ZZZZZ2'), { kind: 'crew', target_id: 'c1' }));
  await assertFails(setDoc(doc(as('z'), 'join_codes/ZZZZZ2'), { kind: 'crew', target_id: 'c1' }));
});
test('attack: registering a code whose target does not carry that code, or does not exist', async () => {
  await assertFails(setDoc(doc(as('a'), 'join_codes/QQQQQ2'), { kind: 'crew', target_id: 'c1' })); // c1.join_code is another code
  await assertFails(setDoc(doc(as('z'), 'join_codes/QQQQQ3'), { kind: 'crew', target_id: 'nope' }));
});
test('attack: pre-claiming a code on your own crew then pointing it at a victim', async () => {
  // z creates a crew with its own code AAAAB2, then tries a code doc for the VICTIM'S target using z's code
  const db = as('z');
  const b = writeBatch(db);
  b.set(doc(db, 'crews/cz'), crewDoc({ created_by: 'z', member_ids: ['z'], roles: { z: 'lead' }, join_code: 'AAAAB2', created_at: serverTimestamp() }));
  b.set(doc(db, 'join_codes/AAAAB2'), { kind: 'crew', target_id: 'c1' });
  await assertFails(b.commit());
});
test('attack: malformed code docs (extra fields, bad kind, bad code format)', async () => {
  const b = (code, data) => {
    const db = as('z');
    const w = writeBatch(db);
    w.set(doc(db, 'crews/cz'), crewDoc({ created_by: 'z', member_ids: ['z'], roles: { z: 'lead' }, join_code: code, created_at: serverTimestamp() }));
    w.set(doc(db, `join_codes/${code}`), data);
    return w.commit();
  };
  await assertFails(b('AAAAB2', { kind: 'crew', target_id: 'cz', extra: 'x'.repeat(5000) }));
  await assertFails(b('AAAAB3', { kind: 'admin', target_id: 'cz' }));
  await assertFails(b('abc', { kind: 'crew', target_id: 'cz' }));
  await assertFails(b('AAAAB0', { kind: 'crew', target_id: 'cz' })); // 0 is not in the alphabet
});
test('attack: an anonymous client writes a join code', async () => {
  await assertFails(setDoc(doc(anon(), 'join_codes/ZZZZZ2'), { kind: 'crew', target_id: 'c1' }));
});

// ===================================================================== server-owned collections

test('attack: writing routes / fl_rounds from a client', async () => {
  await assertFails(setDoc(doc(as('a'), 'routes/r'), { group_id: 'g1' }));
  await assertFails(setDoc(doc(as('a'), 'fl_rounds/r'), { round: 1 }));
});
