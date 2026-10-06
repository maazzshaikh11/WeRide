/**
 * Shared harness for the rules tests. RULES_FILE (path, relative to this folder or absolute) picks the rules under test;
 * it defaults to ../firestore.rules. `npm run test:old` runs the suites against the pre-hardening rules
 * (old-rules.fixture.rules) to show which attacks they allowed.
 */
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const fb = require('firebase/firestore');

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const rulesPath = process.env.RULES_FILE
  ? path.resolve(__dirname, process.env.RULES_FILE)
  : path.join(__dirname, '..', 'firestore.rules');

const CODE = 'K7M2QX';
const CODE2 = 'GH7S2K';

function harness(test) {
  const h = {};
  test.before(async () => {
    h.env = await initializeTestEnvironment({
      projectId: 'demo-weride',
      firestore: { host, port: Number(port), rules: fs.readFileSync(rulesPath, 'utf8') },
    });
  });
  test.after(async () => h.env.cleanup());
  test.beforeEach(async () => h.env.clearFirestore());
  h.as = (uid) => h.env.authenticatedContext(uid).firestore();
  h.anon = () => h.env.unauthenticatedContext().firestore();
  h.seed = (fn) => h.env.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
  return h;
}

const crewDoc = (o = {}) => ({ name: 'Ghosts', created_by: 'a', member_ids: ['a', 'b'], roles: { a: 'lead' }, join_code: CODE, ...o });
const groupDoc = (o = {}) => ({
  name: 'Sunday Run', created_by: 'a', member_ids: ['a', 'b'], join_code: CODE2, status: 'planned', active_ride_id: null,
  ride_plan: { start: { label: 'A', lat: 1, lng: 2 }, destination: { label: 'B', lat: 3, lng: 4 }, stops: [] },
  ...o,
});
const hazardDoc = (o = {}) => ({
  cluster_id: 'h1', group_id: 'g1', hazard_type: 'pothole', centroid_lat: 19, centroid_lng: 72, polygon_points: [], report_count: 2,
  hazard_score: 0.5, created_at_hlc: '1:0', status: 'active', ...o,
});
const sosDoc = (o = {}) => ({
  sos_id: 's1', rider_id: 'a', group_id: 'g1', lat: 19, lng: 72, created_at_hlc: '1:0', tag: 't', resolved: false, resolved_at_hlc: null, ...o,
});
const reportDoc = (o = {}) => ({
  report_id: 'r1', rider_id: 'a', group_id: 'g1', hazard_type: 'pothole', lat: 19, lng: 72, timestamp_hlc: '1:0', reported_at_hlc: '1:0', ...o,
});
const locDoc = (o = {}) => ({ rider_id: 'a', group_id: 'g1', timestamp_hlc: '1:0', lat: 19, lng: 72, speed_mps: 3, heading_deg: 90, spoof_flag: false, nis_score: 0.1, accuracy_m: 5, ...o });

/** Standard world: crew c1 {a lead, b}, ride g1 {a, b} in crew c1, ride g2 {x}, with their join codes. */
async function world(h) {
  await h.seed(async (db) => {
    await fb.setDoc(fb.doc(db, 'crews/c1'), crewDoc());
    await fb.setDoc(fb.doc(db, `join_codes/${CODE}`), { kind: 'crew', target_id: 'c1' });
    await fb.setDoc(fb.doc(db, 'groups/g1'), groupDoc({ crew_id: 'c1', join_code: CODE2 }));
    await fb.setDoc(fb.doc(db, `join_codes/${CODE2}`), { kind: 'ride', target_id: 'g1' });
    await fb.setDoc(fb.doc(db, 'groups/g2'), groupDoc({ created_by: 'x', member_ids: ['x'], join_code: 'AAAAA2' }));
    await fb.setDoc(fb.doc(db, 'join_codes/AAAAA2'), { kind: 'ride', target_id: 'g2' });
    await fb.setDoc(fb.doc(db, 'users/a/private/settings'), { contacts: [{ id: 'c', name: 'Mom', number: '+919800000000' }] });
    await fb.setDoc(fb.doc(db, 'users/a/ride_logs/r1'), { km: 10 });
    await fb.setDoc(fb.doc(db, 'groups/g1/locations/a'), locDoc());
    await fb.setDoc(fb.doc(db, 'groups/g1/rsvp/a'), { status: 'going', updated_ms: 1 });
    await fb.setDoc(fb.doc(db, 'groups/g1/roll_call/a'), { state: 'ready', updated_ms: 1 });
    await fb.setDoc(fb.doc(db, 'groups/g1/presence/a'), { state: 'riding', updated_ms: 1 });
    await fb.setDoc(fb.doc(db, 'groups/g1/reports/r1'), reportDoc());
    await fb.setDoc(fb.doc(db, 'hazards/h1'), hazardDoc());
    await fb.setDoc(fb.doc(db, 'sos_events/s1'), sosDoc());
    await fb.setDoc(fb.doc(db, 'sos_events/s1/responders/b'), { state: 'going', updated_ms: 1 });
  });
}

module.exports = { fb, harness, world, CODE, CODE2, crewDoc, groupDoc, hazardDoc, sosDoc, reportDoc, locDoc };
