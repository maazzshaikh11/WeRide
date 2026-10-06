/**
 * Firestore rules for the demo-parity data model (docs/DEMO_PARITY_SPEC.md §2).
 *   cd infra/firebase && npx firebase-tools@13 emulators:exec --only firestore --project demo-weride \
 *     "npm --prefix rules-test test"
 */
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, getDocs, query, where } = require('firebase/firestore');

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
let env;

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-weride',
    firestore: { host, port: Number(port), rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') },
  });
});
test.after(async () => env.cleanup());
test.beforeEach(async () => env.clearFirestore());

const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const seed = (fn) => env.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));

test('profile: signed-in riders read it, only the owner writes it, anonymous reads nothing', async () => {
  await assertSucceeds(setDoc(doc(as('a'), 'users/a'), { name: 'A', bike: 'Duke 390', style: 'Steady' }));
  await assertSucceeds(getDoc(doc(as('b'), 'users/a')));
  await assertFails(setDoc(doc(as('b'), 'users/a'), { name: 'hacked' }));
  await assertFails(getDoc(doc(anon(), 'users/a')));
});

test('private settings (prefs, contacts, push token) are owner-only', async () => {
  await assertSucceeds(setDoc(doc(as('a'), 'users/a/private/settings'), { contacts: [{ id: 'c1', name: 'Mom', number: '+919800000000' }] }));
  await assertSucceeds(getDoc(doc(as('a'), 'users/a/private/settings')));
  await assertFails(getDoc(doc(as('b'), 'users/a/private/settings')));
  await assertFails(setDoc(doc(as('b'), 'users/a/private/settings'), { prefs: {} }));
});

test('ride logs are owner-only', async () => {
  await assertSucceeds(setDoc(doc(as('a'), 'users/a/ride_logs/r1'), { km: 10 }));
  await assertFails(getDoc(doc(as('b'), 'users/a/ride_logs/r1')));
  await assertFails(setDoc(doc(as('b'), 'users/a/ride_logs/r2'), { km: 99 }));
});

test('crews: create as a member, resolve by code, join by adding yourself, leave', async () => {
  await assertSucceeds(setDoc(doc(as('a'), 'crews/c1'), { name: 'Ghosts', created_by: 'a', member_ids: ['a'], join_code: 'K7M2QX' }));
  // creating a crew you are not in, or in someone else's name, is refused
  await assertFails(setDoc(doc(as('b'), 'crews/c2'), { name: 'X', created_by: 'a', member_ids: ['a'], join_code: 'AAAAAA' }));
  await assertFails(setDoc(doc(as('b'), 'crews/c3'), { name: 'X', created_by: 'b', member_ids: ['a'], join_code: 'AAAAAB' }));
  // another rider finds it by code and joins
  const found = await assertSucceeds(getDocs(query(collection(as('b'), 'crews'), where('join_code', '==', 'K7M2QX'))));
  if (found.size !== 1) throw new Error('code lookup failed');
  await assertSucceeds(updateDoc(doc(as('b'), 'crews/c1'), { member_ids: ['a', 'b'] }));
  // a stranger cannot strip members, a member can leave
  await assertFails(updateDoc(doc(as('z'), 'crews/c1'), { member_ids: ['z'] }));
  await assertSucceeds(updateDoc(doc(as('b'), 'crews/c1'), { member_ids: ['a'] }));
  await assertFails(deleteDoc(doc(as('a'), 'crews/c1')));
});

test('ride status can be advanced by a member, not by a stranger', async () => {
  await seed((db) => setDoc(doc(db, 'groups/g1'), { name: 'R', created_by: 'a', member_ids: ['a', 'b'], status: 'planned' }));
  await assertSucceeds(updateDoc(doc(as('b'), 'groups/g1'), { status: 'meetup' }));
  await assertFails(updateDoc(doc(as('z'), 'groups/g1'), { status: 'live', member_ids: ['a', 'b'] }));
});

for (const sub of ['rsvp', 'roll_call', 'presence']) {
  test(`${sub}: members read, a rider writes only their own doc, strangers nothing`, async () => {
    await seed((db) => setDoc(doc(db, 'groups/g1'), { name: 'R', created_by: 'a', member_ids: ['a', 'b'] }));
    await assertSucceeds(setDoc(doc(as('a'), `groups/g1/${sub}/a`), { state: 'ready', status: 'going', updated_ms: 1 }));
    await assertFails(setDoc(doc(as('a'), `groups/g1/${sub}/b`), { state: 'ready', updated_ms: 1 }));
    await assertSucceeds(getDoc(doc(as('b'), `groups/g1/${sub}/a`)));
    await assertFails(getDoc(doc(as('z'), `groups/g1/${sub}/a`)));
    await assertFails(setDoc(doc(as('z'), `groups/g1/${sub}/z`), { state: 'ready', updated_ms: 1 }));
  });
}

test('SOS responders: anyone signed in reads, a rider writes only their own', async () => {
  await seed((db) => setDoc(doc(db, 'sos_events/s1'), { rider_id: 'a', group_id: 'g1', resolved: false }));
  await assertSucceeds(setDoc(doc(as('b'), 'sos_events/s1/responders/b'), { state: 'going', updated_ms: 1 }));
  await assertFails(setDoc(doc(as('b'), 'sos_events/s1/responders/c'), { state: 'going', updated_ms: 1 }));
  await assertSucceeds(getDocs(collection(as('a'), 'sos_events/s1/responders')));
});

test('hazard confirmations (gone_votes) can be written by a signed-in rider', async () => {
  await seed((db) => setDoc(doc(db, 'hazards/h1'), { group_id: 'g1', status: 'active', hazard_type: 'pothole' }));
  await assertSucceeds(updateDoc(doc(as('b'), 'hazards/h1'), { group_id: 'g1', gone_votes: ['b'] }));
});
