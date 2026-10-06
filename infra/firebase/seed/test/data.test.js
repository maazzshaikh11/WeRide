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

// ─── demo-parity model ────────────────────────────────────────────────────
const D = require('../teamdsy-data');
const rideDefs = D.rides(UID, NOW);
const crewDefs = D.crews(UID, NOW);
const logDefs = D.logs(UID, NOW);

test('three crews: teamDSY is in each, codes are valid and unique, leads/sweeps are crew members', () => {
  assert.equal(crewDefs.length, 3);
  const codes = crewDefs.map((c) => c.code);
  codes.forEach((c) => assert.match(c, JOIN_CODE_RE));
  assert.equal(new Set(codes).size, 3);
  assert.equal(new Set([...codes, ...defs.map((g) => g.code)]).size, 3 + defs.length, 'crew and ride codes never collide');
  for (const c of crewDefs) {
    assert.ok(c.member_ids.includes(UID));
    for (const uid of Object.keys(c.roles)) assert.ok(c.member_ids.includes(uid));
    assert.ok(['lead', 'sweep'].includes(Object.values(c.roles)[0]));
  }
});

test('every ride belongs to a crew that contains all of its members; finished rides are in the past', () => {
  for (const r of rideDefs) {
    const crew = crewDefs.find((c) => c.key === r.crew_key);
    assert.ok(crew, r.key);
    for (const m of r.member_ids) assert.ok(crew.member_ids.includes(m), `${r.key}: ${m} not in crew ${crew.key}`);
    assert.equal(r.status === 'finished', r.start_time_ms <= NOW, r.key);
    if (r.status === 'finished') assert.ok(r.finished_ms > r.started_ms);
  }
});

test('crew profiles exist for every seed- id used anywhere', () => {
  const ids = new Set(D.crewProfiles(NOW).map((p) => p.uid));
  for (const g of defs) for (const m of g.member_ids) if (m !== UID) assert.ok(ids.has(m), m);
  for (const p of D.crewProfiles(NOW)) {
    assert.ok(p.doc.name && p.doc.bike && ['Relaxed', 'Steady', 'Spirited'].includes(p.doc.style));
    assert.ok(p.doc.stats.rides > 0 && p.doc.stats.together_sum / p.doc.stats.rides <= 100);
  }
});

test('ride logs: one per finished ride, flat tracks within the limit, consistent stats and events', () => {
  assert.equal(logDefs.length, rideDefs.filter((r) => r.status === 'finished').length);
  for (const l of logDefs) {
    assert.ok(l.track.length >= 4 && l.track.length % 2 === 0 && l.track.length / 2 <= 600, l.name);
    assert.ok(l.track.every((n) => typeof n === 'number'), 'flat numbers only (no nested arrays)');
    assert.ok(l.km > 0 && l.duration_s > 0 && l.avg_kmh > 0 && l.max_kmh >= l.avg_kmh);
    assert.ok(l.together_pct >= 0 && l.together_pct <= 100);
    assert.ok(l.ended_ms === l.started_ms + l.duration_s * 1000);
    assert.equal(l.events[0].kind, 'rolled');
    assert.equal(l.events[l.events.length - 1].kind, 'arrived');
    assert.ok(l.events.every((e, i, a) => i === 0 || e.t_ms >= a[i - 1].t_ms), 'events in time order');
    assert.ok(rideDefs.some((r) => groupDocId(r.key) === l.ride_id));
  }
});

test('my public stats equal the sum of the seeded logs', () => {
  const p = D.myProfile(UID, NOW);
  assert.equal(p.stats.rides, logDefs.length);
  assert.equal(p.stats.together_sum, logDefs.reduce((a, l) => a + l.together_pct, 0));
  assert.ok(Math.abs(p.stats.km - logDefs.reduce((a, l) => a + l.km, 0)) < 0.2);
  assert.equal(p.name, 'teamDSY');
});

test('settings open the app in the Garage, with no invented emergency contacts', () => {
  const s = D.mySettings();
  assert.equal(s.onboarded, true);
  assert.equal(s.contacts, undefined);
  assert.ok([1000, 1500, 2000].includes(s.prefs.hold_ms));
});

test('RSVPs exist for the upcoming rides only and only from members', () => {
  const r = D.rsvps(UID, NOW);
  for (const [key, list] of Object.entries(r)) {
    const ride = rideDefs.find((x) => x.key === key);
    assert.equal(ride.status, 'planned');
    for (const x of list) assert.ok(ride.member_ids.includes(x.uid));
    assert.ok(['going', 'maybe', 'no'].includes(list[0].status));
  }
});

test('tracks are deterministic (re-seeding writes identical logs)', () => {
  assert.deepEqual(D.logs(UID, NOW).map((l) => l.track), logDefs.map((l) => l.track));
});
