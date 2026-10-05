const test = require('node:test');
const assert = require('node:assert/strict');
const { EMAIL, PASSWORD, DISPLAY_NAME, JOIN_CODE_RE, CREW, groups, hazards, groupDocId } = require('../teamdsy-data');

const NOW = Date.UTC(2026, 9, 5, 12, 0, 0);
const UID = 'uid-teamdsy';
const defs = groups(UID, NOW);

test('account: email login, requested password, display name', () => {
  assert.equal(EMAIL, 'teamdsy@weride.app');
  assert.equal(PASSWORD, 'teamDSY@123');
  assert.equal(DISPLAY_NAME, 'teamDSY');
  assert.ok(PASSWORD.length >= 6, 'Firebase minimum');
});

test('teamDSY is a member of every group; joined groups were created by someone else', () => {
  for (const g of defs) assert.ok(g.member_ids.includes(UID), g.key);
  const joined = defs.filter((g) => g.created_by !== UID);
  assert.ok(joined.length >= 1);
  assert.ok(joined.every((g) => g.created_by.startsWith('seed-')));
});

test('one upcoming ride, the rest past, with sensible dates', () => {
  const upcoming = defs.filter((g) => g.start_time_ms > NOW);
  const past = defs.filter((g) => g.start_time_ms <= NOW);
  assert.equal(upcoming.length, 2); // the next ride + the joined group
  assert.equal(past.length, 4);
  for (const g of defs) assert.ok(g.created_ms < g.start_time_ms, `${g.key} created before it starts`);
});

test('join codes use the app alphabet and are unique', () => {
  const codes = defs.map((g) => g.code);
  codes.forEach((c) => assert.match(c, JOIN_CODE_RE));
  assert.equal(new Set(codes).size, codes.length);
});

test('crew are plain seed- ids, no auth accounts, no duplicates per group', () => {
  const crewIds = new Set(Object.values(CREW));
  for (const g of defs) {
    assert.equal(new Set(g.member_ids).size, g.member_ids.length, g.key);
    for (const m of g.member_ids) assert.ok(m === UID || crewIds.has(m), `${g.key}: ${m}`);
  }
});

test('every ride has a real plan: start, destination, valid coordinates, stop shape the app reads', () => {
  for (const g of defs) {
    const p = g.ride_plan;
    for (const pt of [p.start, p.destination, ...p.stops]) {
      assert.ok(typeof pt.label === 'string' && pt.label.length > 0);
      assert.ok(pt.lat >= 18 && pt.lat <= 19.5 && pt.lng >= 72 && pt.lng <= 74, `${g.key} ${pt.label}`);
    }
    p.stops.forEach((s) => assert.ok(s.id && s.icon));
    assert.ok(['Casual', 'Touring', 'Sport', 'Off-road'].includes(g.ride_type));
  }
});

test('hazards: contract fields, no nested arrays (Firestore rejects them), bound to the next ride', () => {
  const id = groupDocId(defs[0].key);
  const hs = hazards(id, NOW);
  assert.ok(hs.length >= 2);
  for (const h of hs) {
    assert.equal(h.group_id, id);
    assert.ok(['pothole', 'oil_spill', 'accident', 'debris', 'other'].includes(h.hazard_type));
    assert.ok(['active', 'resolved'].includes(h.status));
    assert.ok(h.hazard_score >= 0 && h.hazard_score <= 1);
    assert.match(h.created_at_hlc, /^\d+:\d+$/);
    assert.deepEqual(h.polygon_points, []);
  }
  assert.equal(new Set(hs.map((h) => h.cluster_id)).size, hs.length);
  assert.ok(hs.some((h) => h.status === 'active') && hs.some((h) => h.status === 'resolved'));
});

test('deterministic ids make re-seeding an in-place update', () => {
  assert.equal(groupDocId('a'), groupDocId('a'));
  assert.deepEqual(groups(UID, NOW).map((g) => g.key), defs.map((g) => g.key));
});
