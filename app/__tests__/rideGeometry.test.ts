import {
  routeLatLngs,
  fitPointsFor,
  fitSignature,
  buildRidePins,
} from '../src/screens/map/rideGeometry';
import type { RouteResponse } from '../src/models/routeResponse';

const route = (pts: number[][], id = 'r1'): RouteResponse => ({
  route_id: id,
  path_points: pts,
  distance_km: 10,
  eta_minutes: 20,
  safety_score: 0.9,
  recalculated_at_hlc: '1:0',
});

const START = { lat: 18.5204, lng: 73.8567, label: 'Pune, Maharashtra' };
const END = { lat: 18.7546, lng: 73.4062, label: 'Lonavala, Maharashtra' };
const STOP = { lat: 18.6, lng: 73.7, label: 'Chai Point, Talegaon' };

describe('routeLatLngs', () => {
  it('converts [lat,lng] pairs and drops unusable points', () => {
    expect(routeLatLngs(route([[18.5, 73.8], [0, 0], [NaN, 1], [18.6, 73.7]]))).toEqual([
      { lat: 18.5, lng: 73.8 },
      { lat: 18.6, lng: 73.7 },
    ]);
  });
  it('handles no route', () => {
    expect(routeLatLngs(null)).toEqual([]);
  });
});

describe('fitPointsFor', () => {
  it('includes the route line AND plan markers', () => {
    const pts = fitPointsFor(route([[18.52, 73.85], [18.75, 73.4]]), {
      start: START,
      stops: [STOP],
      destination: END,
    });
    expect(pts).toHaveLength(2 + 3);
  });
  it('falls back to plan markers when no route yet (camera can still frame the ride)', () => {
    const pts = fitPointsFor(null, { start: START, stops: [], destination: END });
    expect(pts).toEqual([
      { lat: START.lat, lng: START.lng, label: START.label },
      { lat: END.lat, lng: END.lng, label: END.label },
    ]);
  });
  it('is empty with no plan and no route', () => {
    expect(fitPointsFor(null, { start: null, stops: [], destination: null })).toEqual([]);
  });
});

describe('fitSignature', () => {
  const plan = { start: START, stops: [STOP], destination: END };
  it('is stable across re-routes (same plan, route already ready)', () => {
    expect(fitSignature(plan, true)).toBe(fitSignature({ ...plan }, true));
  });
  it('changes when the route first arrives', () => {
    expect(fitSignature(plan, false)).not.toBe(fitSignature(plan, true));
  });
  it('changes when the destination changes', () => {
    const other = { ...plan, destination: { ...END, lat: 19.0 } };
    expect(fitSignature(plan, true)).not.toBe(fitSignature(other, true));
  });
  it('changes when a stop is added', () => {
    expect(fitSignature(plan, true)).not.toBe(fitSignature({ ...plan, stops: [] }, true));
  });
});

describe('buildRidePins', () => {
  it('builds distinct start / numbered stop / end features with short labels', () => {
    const fc = buildRidePins({ start: START, stops: [STOP], destination: END }, null);
    expect(fc.features.map((f) => f.properties)).toEqual([
      { kind: 'start', n: '', label: 'Pune' },
      { kind: 'stop', n: '1', label: 'Chai Point' },
      { kind: 'end', n: '', label: 'Lonavala' },
    ]);
    // GeoJSON order is [lng, lat]
    expect(fc.features[0].geometry.coordinates).toEqual([START.lng, START.lat]);
  });

  it('uses the route origin as the start pin when the plan has no start', () => {
    const fc = buildRidePins(
      { start: null, stops: [], destination: END },
      route([[18.4, 73.9], [18.7, 73.4]]),
    );
    expect(fc.features[0].properties).toMatchObject({ kind: 'start', label: 'You' });
    expect(fc.features[0].geometry.coordinates).toEqual([73.9, 18.4]);
  });

  it('draws nothing it does not have (no plan, no route → no pins)', () => {
    expect(buildRidePins({ start: null, stops: [], destination: null }, null).features).toEqual([]);
  });

  it('same start and end still yields two distinct features (end drawn on top)', () => {
    const fc = buildRidePins({ start: START, stops: [], destination: { ...START } }, null);
    expect(fc.features.map((f) => f.properties.kind)).toEqual(['start', 'end']);
  });
});
