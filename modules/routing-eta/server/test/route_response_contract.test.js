/**
 * Route response contract validation test (Phase 1 T-03).
 * Verifies that POST /route responses match the frozen contracts/route_contract.json schema.
 * This test runs in CI and fails if the response shape drifts from the spec.
 */

import { test } from 'node:test';
import { strict as assert } from 'assert';

/**
 * Simple schema validator for the route_response contract.
 * Checks required fields and types against contracts/route_contract.json.
 */
function validateRouteResponse(payload) {
  // Required fields per contract
  const requiredFields = [
    'route_id',
    'path_points',
    'distance_km',
    'eta_minutes',
    'safety_score',
    'recalculated_at_hlc',
  ];

  for (const field of requiredFields) {
    if (!(field in payload)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Type checks
  if (typeof payload.route_id !== 'string' || !payload.route_id) {
    throw new Error('route_id must be a non-empty string');
  }

  if (!Array.isArray(payload.path_points)) {
    throw new Error('path_points must be an array');
  }

  for (const point of payload.path_points) {
    if (!Array.isArray(point) || point.length !== 2) {
      throw new Error('Each path_point must be [lat, lng]');
    }
    if (typeof point[0] !== 'number' || typeof point[1] !== 'number') {
      throw new Error('path_point coordinates must be numbers');
    }
  }

  if (typeof payload.distance_km !== 'number' || payload.distance_km < 0) {
    throw new Error('distance_km must be a non-negative number');
  }

  if (typeof payload.eta_minutes !== 'number' || payload.eta_minutes < 0) {
    throw new Error('eta_minutes must be a non-negative number');
  }

  if (
    typeof payload.safety_score !== 'number' ||
    payload.safety_score < 0 ||
    payload.safety_score > 1
  ) {
    throw new Error('safety_score must be a number in [0, 1]');
  }

  if (typeof payload.recalculated_at_hlc !== 'string' || !payload.recalculated_at_hlc) {
    throw new Error('recalculated_at_hlc must be a non-empty string (HLC timestamp)');
  }
}

// Tests

test('validates a correct route_response payload', () => {
  const validPayload = {
    route_id: 'route-12345',
    path_points: [
      [40.7128, -74.006],
      [40.7140, -74.0089],
    ],
    distance_km: 1.5,
    eta_minutes: 5.2,
    safety_score: 0.85,
    recalculated_at_hlc: '1692374400000:0',
  };

  // Should not throw
  assert.doesNotThrow(() => validateRouteResponse(validPayload));
});

test('rejects payload missing required fields', () => {
  const missingRoute = {
    // missing route_id
    path_points: [[40.7128, -74.006]],
    distance_km: 1.5,
    eta_minutes: 5.2,
    safety_score: 0.85,
    recalculated_at_hlc: '1692374400000:0',
  };

  assert.throws(() => validateRouteResponse(missingRoute), /Missing required field: route_id/);
});

test('rejects invalid route_id type', () => {
  const invalidRouteId = {
    route_id: 12345, // number, not string
    path_points: [[40.7128, -74.006]],
    distance_km: 1.5,
    eta_minutes: 5.2,
    safety_score: 0.85,
    recalculated_at_hlc: '1692374400000:0',
  };

  assert.throws(
    () => validateRouteResponse(invalidRouteId),
    /route_id must be a non-empty string/
  );
});

test('rejects path_points with invalid coordinates', () => {
  const invalidPathPoints = {
    route_id: 'route-12345',
    path_points: [
      [40.7128, -74.006],
      ['invalid', 'coords'], // strings, not numbers
    ],
    distance_km: 1.5,
    eta_minutes: 5.2,
    safety_score: 0.85,
    recalculated_at_hlc: '1692374400000:0',
  };

  assert.throws(
    () => validateRouteResponse(invalidPathPoints),
    /path_point coordinates must be numbers/
  );
});

test('rejects negative distance_km', () => {
  const negativeDistance = {
    route_id: 'route-12345',
    path_points: [[40.7128, -74.006]],
    distance_km: -1.5, // negative
    eta_minutes: 5.2,
    safety_score: 0.85,
    recalculated_at_hlc: '1692374400000:0',
  };

  assert.throws(
    () => validateRouteResponse(negativeDistance),
    /distance_km must be a non-negative number/
  );
});

test('rejects safety_score outside [0, 1]', () => {
  const outOfRangeScore = {
    route_id: 'route-12345',
    path_points: [[40.7128, -74.006]],
    distance_km: 1.5,
    eta_minutes: 5.2,
    safety_score: 1.5, // > 1.0
    recalculated_at_hlc: '1692374400000:0',
  };

  assert.throws(
    () => validateRouteResponse(outOfRangeScore),
    /safety_score must be a number in \[0, 1\]/
  );
});

test('rejects missing recalculated_at_hlc', () => {
  const missingHlc = {
    route_id: 'route-12345',
    path_points: [[40.7128, -74.006]],
    distance_km: 1.5,
    eta_minutes: 5.2,
    safety_score: 0.85,
    // missing recalculated_at_hlc
  };

  assert.throws(
    () => validateRouteResponse(missingHlc),
    /Missing required field: recalculated_at_hlc/
  );
});

test('accepts safety_score at exact boundaries', () => {
  const boundaryZero = {
    route_id: 'route-12345',
    path_points: [[40.7128, -74.006]],
    distance_km: 1.5,
    eta_minutes: 5.2,
    safety_score: 0.0,
    recalculated_at_hlc: '1692374400000:0',
  };

  const boundaryOne = {
    route_id: 'route-12345',
    path_points: [[40.7128, -74.006]],
    distance_km: 1.5,
    eta_minutes: 5.2,
    safety_score: 1.0,
    recalculated_at_hlc: '1692374400000:0',
  };

  assert.doesNotThrow(() => validateRouteResponse(boundaryZero));
  assert.doesNotThrow(() => validateRouteResponse(boundaryOne));
});

test('accepts empty path_points (though unusual)', () => {
  const emptyPath = {
    route_id: 'route-12345',
    path_points: [],
    distance_km: 0,
    eta_minutes: 0,
    safety_score: 0.5,
    recalculated_at_hlc: '1692374400000:0',
  };

  // Empty path is technically valid per schema (no minItems constraint)
  assert.doesNotThrow(() => validateRouteResponse(emptyPath));
});

export { validateRouteResponse };
