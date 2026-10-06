/**
 * Backfill against the Firestore emulator:
 *   cd infra/firebase && npx firebase-tools@13.35.1 emulators:exec --only firestore --project demo-weride \
 *     "node --test migrations/test/backfill.emulator.test.js"
 * (firebase-admin is resolved from ../seed/node_modules when this folder has none installed.)
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
// let this folder use the seed folder's firebase-admin when `npm install` was not run here
Module.globalPaths.push(path.join(__dirname, '..', '..', 'seed', 'node_modules'));
process.env.NODE_PATH = [process.env.NODE_PATH, path.join(__dirname, '..', '..', 'seed', 'node_modules')].filter(Boolean).join(path.delimiter);
Module._initPaths();
const admin = require('firebase-admin');
const { backfill, parseArgs } = require('../backfill-join-codes');

const skip = !process.env.FIRESTORE_EMULATOR_HOST && 'emulator not running';
let db;

async function wipe() {
  for (const c of ['crews', 'groups', 'join_codes']) {
    const s = await db.collection(c).get();
    await Promise.all(s.docs.map((d) => d.ref.delete()));
  }
}
const seqRandom = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };

test.before(() => { if (!skip) { admin.initializeApp({ projectId: 'demo-weride' }); db = admin.firestore(); } });
test.beforeEach(async () => { if (!skip) await wipe(); });

test('parseArgs', () => {
  assert.equal(parseArgs(['--dry-run', '--project', 'p']).dryRun, true);
  assert.equal(parseArgs(['--project', 'p']).dryRun, false);
  assert.throws(() => parseArgs(['--nope']));
});

test('writes a join_codes doc for every crew and ride, and is idempotent', { skip }, async () => {
  await db.doc('crews/c1').set({ name: 'C', created_by: 'a', member_ids: ['a'], join_code: 'GH7S2K' });
  await db.doc('groups/g1').set({ name: 'G', created_by: 'a', member_ids: ['a'], join_code: 'K7M2QX' });
  await db.doc('groups/g2').set({ name: 'G2', created_by: 'a', member_ids: ['a'], join_code: 'k7m2qy' }); // lower-case
  const r = await backfill(db);
  assert.equal(r.written, 3);
  assert.deepEqual((await db.doc('join_codes/GH7S2K').get()).data(), { kind: 'crew', target_id: 'c1' });
  assert.deepEqual((await db.doc('join_codes/K7M2QX').get()).data(), { kind: 'ride', target_id: 'g1' });
  assert.deepEqual((await db.doc('join_codes/K7M2QY').get()).data(), { kind: 'ride', target_id: 'g2' });
  assert.equal((await db.doc('groups/g2').get()).data().join_code, 'K7M2QY');
  const again = await backfill(db);
  assert.equal(again.written, 0);
  assert.equal(again.alreadyOk, 3);
});

test('--dry-run writes nothing but reports the same plan', { skip }, async () => {
  await db.doc('crews/c1').set({ name: 'C', member_ids: ['a'], join_code: 'GH7S2K' });
  await db.doc('groups/g1').set({ name: 'G', member_ids: ['a'] }); // no code
  const dry = await backfill(db, { dryRun: true, random: seqRandom(0.1, 0.2, 0.3, 0.4, 0.5, 0.6) });
  assert.equal(dry.dryRun, true);
  assert.equal(dry.written, 2);
  assert.equal(dry.assigned.length, 1);
  assert.equal((await db.collection('join_codes').get()).size, 0);
  assert.equal((await db.doc('groups/g1').get()).data().join_code, undefined);
});

test('a crew and a ride sharing a code: the crew keeps it, the ride is re-coded', { skip }, async () => {
  await db.doc('crews/c1').set({ name: 'C', member_ids: ['a'], join_code: 'SAME22' });
  await db.doc('groups/g1').set({ name: 'G', member_ids: ['a'], join_code: 'SAME22' });
  const r = await backfill(db, { random: seqRandom(0.0, 0.1, 0.2, 0.3, 0.4, 0.5) });
  assert.equal(r.recoded.length, 1);
  assert.equal(r.recoded[0].target, 'groups/g1');
  assert.deepEqual((await db.doc('join_codes/SAME22').get()).data(), { kind: 'crew', target_id: 'c1' });
  const g = (await db.doc('groups/g1').get()).data();
  assert.notEqual(g.join_code, 'SAME22');
  assert.deepEqual((await db.doc(`join_codes/${g.join_code}`).get()).data(), { kind: 'ride', target_id: 'g1' });
});

test('legacy rides with no / invalid code get one; schema problems are warned about, not changed', { skip }, async () => {
  await db.doc('groups/old').set({ name: 'Old', member_ids: ['a'] });
  await db.doc('groups/bad').set({ name: 'x'.repeat(80), member_ids: ['a'], join_code: 'abc' });
  const r = await backfill(db);
  assert.equal(r.assigned.length, 2);
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /groups\/bad: name/);
  for (const id of ['old', 'bad']) {
    const code = (await db.doc(`groups/${id}`).get()).data().join_code;
    assert.match(code, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    assert.equal((await db.doc(`join_codes/${code}`).get()).data().target_id, id);
  }
});

test('never overwrites an existing code doc that points at someone else', { skip }, async () => {
  await db.doc('join_codes/K7M2QX').set({ kind: 'ride', target_id: 'someone-else' });
  await db.doc('groups/g1').set({ name: 'G', member_ids: ['a'], join_code: 'K7M2QX' });
  const r = await backfill(db);
  assert.equal(r.recoded.length, 1);
  assert.equal((await db.doc('join_codes/K7M2QX').get()).data().target_id, 'someone-else');
});
