/**
 * Integration test for POST /route endpoint (T-04, Phase 2).
 * Tests that the server responds with a schema-valid mock route_response.
 */

import { test } from 'node:test';
import { strict as assert } from 'assert';
import { handleRoute, validateRouteResponse } from '../astar.js';

// Mock Express request/response objects
function mockReq(body) {
  return { body };
}

function mockRes() {
  const res = {};
  res.json = function (data) {
    this.data = data;
    this.status_code = 200;
    return this;
  };
  res.status = function (code) {
    this.status_code = code;
    return {
      json: (data) => {
        res.data = data;
        res.status_code = code;
        return res;
      },
    };
  };
  return res;
}

test('POST /route returns schema-valid mock response', async () => {
  const req = mockReq({
    group_id: 'group-123',
    origin: { lat: 40.7128, lng: -74.006 },
    destination: { lat: 40.7140, lng: -74.0089 },
    avoid_hazard_types: [],
  });

  const res = mockRes();
  await handleRoute(req, res);

  assert.equal(res.status_code, 200);
  assert(res.data, 'response should have data');

  // Validate against schema
  assert.doesNotThrow(() => validateRouteResponse(res.data));

  // Check required fields
  assert(res.data.route_id);
  assert(Array.isArray(res.data.path_points));
  assert(res.data.path_points.length >= 2);
  assert(res.data.distance_km > 0);
  assert(res.data.eta_minutes > 0);
  assert(res.data.safety_score >= 0 && res.data.safety_score <= 1);
  assert(res.data.recalculated_at_hlc);
});

test('POST /route rejects missing group_id', async () => {
  const req = mockReq({
    origin: { lat: 40.7128, lng: -74.006 },
    destination: { lat: 40.7140, lng: -74.0089 },
    avoid_hazard_types: [],
  });

  const res = mockRes();
  await handleRoute(req, res);

  assert.equal(res.status_code, 400);
  assert(res.data.error);
});

test('POST /route rejects invalid origin', async () => {
  const req = mockReq({
    group_id: 'group-123',
    origin: { lat: 'invalid', lng: -74.006 },
    destination: { lat: 40.7140, lng: -74.0089 },
    avoid_hazard_types: [],
  });

  const res = mockRes();
  await handleRoute(req, res);

  assert.equal(res.status_code, 400);
  assert(res.data.error);
});

test('POST /route rejects missing avoid_hazard_types', async () => {
  const req = mockReq({
    group_id: 'group-123',
    origin: { lat: 40.7128, lng: -74.006 },
    destination: { lat: 40.7140, lng: -74.0089 },
  });

  const res = mockRes();
  await handleRoute(req, res);

  assert.equal(res.status_code, 400);
  assert(res.data.error);
});

test('POST /route path_points follow straight-line mock', async () => {
  const req = mockReq({
    group_id: 'group-123',
    origin: { lat: 40.7128, lng: -74.006 },
    destination: { lat: 40.7140, lng: -74.0089 },
    avoid_hazard_types: [],
  });

  const res = mockRes();
  await handleRoute(req, res);

  assert.equal(res.status_code, 200);
  // Mock should be straight-line: origin -> destination
  assert.deepEqual(res.data.path_points[0], [40.7128, -74.006]);
  assert.deepEqual(res.data.path_points[1], [40.7140, -74.0089]);
});
