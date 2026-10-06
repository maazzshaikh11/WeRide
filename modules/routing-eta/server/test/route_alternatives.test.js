/**
 * POST /route `alternatives` (Plan flow). The Mapbox Directions call needs a token
 * we do not have in CI, so global.fetch is mocked: Directions returns canned GeoJSON
 * routes, and the ETA sidecar is made unreachable (heuristic fallback).
 */
import { test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'assert';
import { handleRoute, labelAlternatives, validateRouteResponse } from '../astar.js';

const ORIGIN = { lat: 19.0, lng: 72.8 };
const DEST = { lat: 19.2, lng: 73.1 };

// Mapbox geometry is [lng, lat].
const FAST = { distance: 90000, duration: 5000, geometry: { coordinates: [[72.8, 19.0], [72.95, 19.1], [73.1, 19.2]] }, legs: [] };
const LONG = { distance: 110000, duration: 6500, geometry: { coordinates: [[72.8, 19.0], [72.9, 19.18], [73.1, 19.2]] }, legs: [] };
const THIRD = { distance: 100000, duration: 5800, geometry: { coordinates: [[72.8, 19.0], [73.0, 19.05], [73.1, 19.2]] }, legs: [] };

const realFetch = global.fetch;
const realToken = process.env.MAPBOX_ACCESS_TOKEN;
let directionsUrls;

function mockFetch(routes) {
  directionsUrls = [];
  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes('api.mapbox.com/directions')) {
      directionsUrls.push(u);
      return { ok: true, status: 200, json: async () => ({ routes }) };
    }
    throw new Error('sidecar down'); // ETA sidecar -> heuristic fallback
  };
}

function run(body) {
  const res = {};
  res.json = (d) => { res.data = d; res.status_code = 200; return res; };
  res.status = (c) => ({ json: (d) => { res.data = d; res.status_code = c; return res; } });
  return handleRoute({ body }, res).then(() => res);
}

const base = { group_id: 'g', origin: ORIGIN, destination: DEST, avoid_hazard_types: [] };

beforeEach(() => { process.env.MAPBOX_ACCESS_TOKEN = 'pk.test-token'; });
afterEach(() => {
  global.fetch = realFetch;
  if (realToken === undefined) delete process.env.MAPBOX_ACCESS_TOKEN;
  else process.env.MAPBOX_ACCESS_TOKEN = realToken;
});

test('returns up to three alternatives; the first is the top-level route', async () => {
  mockFetch([FAST, LONG, THIRD, { ...THIRD, distance: 120000 }]);
  const res = await run(base);
  assert.equal(res.status_code, 200);
  assert.doesNotThrow(() => validateRouteResponse(res.data));
  const alts = res.data.alternatives;
  assert.equal(alts.length, 3);
  assert.equal(alts[0].route_id, res.data.route_id);
  assert.deepEqual(alts[0].path_points, res.data.path_points);
  assert.equal(alts[0].distance_km, res.data.distance_km);
  assert.equal(alts[0].eta_minutes, res.data.eta_minutes);
  assert.equal(alts[0].safety_score, res.data.safety_score);
  assert.equal(new Set(alts.map((a) => a.route_id)).size, 3);
  for (const a of alts) {
    assert.ok(a.path_points.length >= 2 && a.path_points.every((p) => p.length === 2));
    assert.ok(a.distance_km > 0 && a.eta_minutes > 0);
    assert.ok(a.safety_score >= 0 && a.safety_score <= 1);
    assert.equal(typeof a.hazard_count, 'number');
    assert.ok(['Fastest', 'Safest', 'Alternative'].includes(a.label));
  }
  assert.ok(directionsUrls[0].includes('alternatives=true'));
});

test('existing response shape is intact', async () => {
  mockFetch([FAST, LONG]);
  const res = await run(base);
  for (const k of ['route_id', 'path_points', 'distance_km', 'eta_minutes', 'safety_score', 'recalculated_at_hlc']) {
    assert.ok(k in res.data, k);
  }
});

test('with a hazard on one route, the clean route is first (Safest) and the quicker one is Fastest', async () => {
  mockFetch([FAST, LONG]);
  const res = await run({
    ...base,
    avoid_hazard_types: ['pothole'],
    // sits on FAST's middle vertex, nowhere near LONG's
    active_hazards: [{ centroid_lat: 19.1, centroid_lng: 72.95, hazard_type: 'pothole', hazard_score: 1 }],
  });
  const [a, b] = res.data.alternatives;
  assert.equal(a.hazard_count, 0);
  assert.equal(a.safety_score, 1);
  assert.equal(b.hazard_count, 1);
  assert.ok(b.safety_score < 1);
  assert.equal(a.label, 'Safest');
  assert.equal(b.label, 'Fastest'); // the hazardous one is genuinely the quicker
});

test('Fastest is only awarded when strictly the minimum duration', async () => {
  // No hazards: both routes score 1.0 safety, so only duration can differ.
  mockFetch([FAST, LONG]);
  const res = await run(base);
  const [a, b] = res.data.alternatives;
  assert.ok(a.eta_minutes < b.eta_minutes);
  assert.equal(a.label, 'Fastest');
  assert.equal(b.label, 'Alternative');
});

test('without a Mapbox token: a single straight-line option', async () => {
  delete process.env.MAPBOX_ACCESS_TOKEN;
  mockFetch([FAST, LONG]);
  const res = await run(base);
  assert.equal(res.data.alternatives.length, 1);
  assert.equal(res.data.alternatives[0].route_id, res.data.route_id);
  assert.equal(res.data.alternatives[0].label, 'Alternative');
  assert.equal(directionsUrls.length, 0);
});

test('Mapbox failure degrades to one option instead of an error', async () => {
  global.fetch = async () => { throw new Error('network'); };
  const res = await run(base);
  assert.equal(res.status_code, 200);
  assert.equal(res.data.alternatives.length, 1);
});

test('labelAlternatives: ties are never labelled', () => {
  assert.deepEqual(labelAlternatives([{ eta_minutes: 10, safety_score: 1 }, { eta_minutes: 10, safety_score: 1 }]), ['Alternative', 'Alternative']);
  assert.deepEqual(labelAlternatives([{ eta_minutes: 10, safety_score: 0.5 }]), ['Alternative']);
  assert.deepEqual(
    labelAlternatives([{ eta_minutes: 10, safety_score: 0.5 }, { eta_minutes: 12, safety_score: 0.9 }, { eta_minutes: 14, safety_score: 0.7 }]),
    ['Fastest', 'Safest', 'Alternative'],
  );
});
