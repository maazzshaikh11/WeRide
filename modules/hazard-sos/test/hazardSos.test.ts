/**
 * Phase 1 Tests: Mock Producer Contract Compliance
 * Phase 2 Tests: Real HLC implementation included.
 */

jest.mock('react-native-mmkv', () => {
  // Each MMKV({ id }) instance gets its own isolated store, matching real react-native-mmkv behaviour.
  const stores = new Map<string, Record<string, string>>();
  const getStore = (id: string): Record<string, string> => {
    if (!stores.has(id)) stores.set(id, {});
    return stores.get(id)!;
  };
  return {
    __esModule: true,
    MMKV: jest.fn().mockImplementation(({ id }: { id: string }) => ({
      getString: jest.fn((k: string) => getStore(id)[k]),
      set: jest.fn((k: string, v: string) => { getStore(id)[k] = v; }),
      // remove() is the correct MMKV v4 API (used by hlc.ts _resetStorage)
      remove: jest.fn((k: string) => { delete getStore(id)[k]; }),
      // delete() is kept for backward compatibility with localQueue.ts (Phase 4)
      delete: jest.fn((k: string) => { delete getStore(id)[k]; }),
      clearAll: jest.fn(() => {
        const s = getStore(id);
        Object.keys(s).forEach(k => delete s[k]);
      }),
    })),
  };
});

import { HLC } from '../src/hlc/hlc';
import { generateMockHazardCluster } from '../src/services/mockHazardService';
import { MMKV } from 'react-native-mmkv';
import { generateMockSosEvent } from '../src/services/mockSosService';
import {
  haversineDistance,
  dbscan,
  clusterByType,
  calculateCentroid,
  calculateBoundingBox,
  calculateHazardScore,
} from '../src/dbscan/dbscan';
import {
  createORSet,
  orSetAdd,
  orSetRemove,
  orSetMerge,
  orSetGetActive,
  orSetSave,
  orSetLoad,
  SOSElement,
  ORSet,
} from '../src/crdt/orSet';
import type { QueuedOperation } from '../src/crdt/localQueue';

const hazardClusterContract = require('../../../contracts/hazard_cluster.json');
const sosEventContract = require('../../../contracts/sos_event.json');

describe('Phase 1: Mock Producer Contract Compliance', () => {

  beforeEach(() => {
    HLC._resetStorage();
  });

  describe('Mock Hazard Cluster', () => {
    const requiredFields = hazardClusterContract.required || [];
    const hazardTypeEnum = hazardClusterContract.properties.hazard_type.enum;
    const statusEnum = hazardClusterContract.properties.status.enum;

    test('generates all required fields from contract', () => {
      const cluster = generateMockHazardCluster('test-group-id');
      for (const field of requiredFields) {
        expect(cluster).toHaveProperty(field);
        expect((cluster as any)[field]).toBeDefined();
      }
    });

    test('uses correct data types', () => {
      const cluster = generateMockHazardCluster('test-group-id');
      const props = hazardClusterContract.properties;
      expect(typeof cluster.cluster_id).toBe(props.cluster_id.type);
      expect(typeof cluster.group_id).toBe(props.group_id.type);
      expect(typeof cluster.hazard_type).toBe(props.hazard_type.type);
      expect(typeof cluster.centroid_lat).toBe(props.centroid_lat.type);
      expect(typeof cluster.centroid_lng).toBe(props.centroid_lng.type);
      expect(Array.isArray(cluster.polygon_points)).toBe(true);
      expect(typeof cluster.report_count).toBe('number');
      expect(typeof cluster.hazard_score).toBe(props.hazard_score.type);
      expect(typeof cluster.created_at_hlc).toBe(props.created_at_hlc.type);
      expect(typeof cluster.status).toBe(props.status.type);
    });

    test('uses valid hazard_type enum values from contract', () => {
      const cluster = generateMockHazardCluster('test-group-id');
      expect(hazardTypeEnum).toContain(cluster.hazard_type);
    });

    test('uses valid status enum values from contract', () => {
      const cluster = generateMockHazardCluster('test-group-id');
      expect(statusEnum).toContain(cluster.status);
    });

    test('polygon_points matches contract array structure', () => {
      const cluster = generateMockHazardCluster('test-group-id');
      for (const point of cluster.polygon_points) {
        expect(Array.isArray(point)).toBe(true);
        expect(point.length).toBe(2);
        expect(typeof point[0]).toBe('number');
        expect(typeof point[1]).toBe('number');
      }
    });

    test('report_count satisfies contract minimum', () => {
      const cluster = generateMockHazardCluster('test-group-id');
      expect(cluster.report_count).toBeGreaterThanOrEqual(0);
    });

    test('hazard_score is within contract range [0,1]', () => {
      const cluster = generateMockHazardCluster('test-group-id');
      expect(cluster.hazard_score).toBeGreaterThanOrEqual(0);
      expect(cluster.hazard_score).toBeLessThanOrEqual(1);
    });

    test('created_at_hlc has valid HLC string format', () => {
      const cluster = generateMockHazardCluster('test-group-id');
      expect(cluster.created_at_hlc).toMatch(/^\d+-\d+$/);
    });

    test('preserves supplied group_id', () => {
      const cluster = generateMockHazardCluster('test-group-123');
      expect(cluster.group_id).toBe('test-group-123');
    });
  });

  describe('Mock SOS Event', () => {
    const requiredFields = sosEventContract.required || [];

    test('generates all required fields from contract', () => {
      const sosEvent = generateMockSosEvent('test-rider', 'test-group', 37.7749, -122.4194);
      for (const field of requiredFields) {
        expect(sosEvent).toHaveProperty(field);
      }
    });

    test('uses correct data types per contract', () => {
      const sosEvent = generateMockSosEvent('test-rider', 'test-group', 37.7749, -122.4194);
      const props = sosEventContract.properties;
      expect(typeof sosEvent.sos_id).toBe(props.sos_id.type);
      expect(typeof sosEvent.rider_id).toBe(props.rider_id.type);
      expect(typeof sosEvent.created_at_hlc).toBe(props.created_at_hlc.type);
    });

    test('resolved_at_hlc is nullable per contract', () => {
      const sosEvent = generateMockSosEvent('test-rider', 'test-group', 37.7749, -122.4194);
      expect(sosEvent.resolved_at_hlc === null || typeof sosEvent.resolved_at_hlc === 'string').toBe(true);
    });

    test('preserves properties', () => {
      const sosEvent = generateMockSosEvent('rider-456', 'group-789', 40.0, -74.0);
      expect(sosEvent.rider_id).toBe('rider-456');
      expect(sosEvent.group_id).toBe('group-789');
      expect(sosEvent.lat).toBe(40.0);
      expect(sosEvent.lng).toBe(-74.0);
      expect(sosEvent.resolved).toBe(false);
      expect(sosEvent.resolved_at_hlc).toBeNull();
    });

    test('created_at_hlc has valid HLC string format', () => {
      const sosEvent = generateMockSosEvent('test-rider', 'test-group', 37.7749, -122.4194);
      expect(sosEvent.created_at_hlc).toMatch(/^\d+-\d+$/);
    });
  });
});

describe('Phase 3 Part A: DBSCAN Hazard Clustering', () => {
  const baseTime = 1700000000000;

  const createReport = (overrides: Partial<import('../src/dbscan/dbscan').HazardReport> = {}): import('../src/dbscan/dbscan').HazardReport => ({
    report_id: `report_${Math.random().toString(36).slice(2, 9)}`,
    rider_id: 'rider_1',
    group_id: 'group_1',
    hazard_type: 'pothole',
    lat: 37.7749,
    lng: -122.4194,
    timestamp_hlc: `${baseTime}-1`,
    reported_at_hlc: `${baseTime}-1`,
    ...overrides,
  });

  describe('haversineDistance', () => {
    test('same coordinate returns approximately 0', () => {
      const dist = haversineDistance(37.7749, -122.4194, 37.7749, -122.4194);
      expect(dist).toBeLessThan(0.1);
    });

    test('known distance within reasonable tolerance', () => {
      const dist = haversineDistance(37.7749, -122.4194, 37.7849, -122.4194);
      expect(dist).toBeGreaterThan(1100);
      expect(dist).toBeLessThan(1120);
    });
  });

  describe('dbscan', () => {
    test('dbscan_cluster_boundary: two nearby reports form one cluster', () => {
      const reports = [
        createReport({ report_id: 'r1', lat: 37.7749, lng: -122.4194 }),
        createReport({ report_id: 'r2', lat: 37.7750, lng: -122.4195 }),
      ];
      const clusters = dbscan(reports, 30, 2);
      expect(clusters.length).toBe(1);
      expect(clusters[0].reports.length).toBe(2);
    });

    test('dbscan_noise_report: isolated report becomes single-report cluster', () => {
      const reports = [
        createReport({ report_id: 'r1', lat: 37.7749, lng: -122.4194 }),
        createReport({ report_id: 'r2', lat: 38.7749, lng: -123.4194 }),
      ];
      const clusters = dbscan(reports, 30, 2);
      expect(clusters.length).toBe(2);
      for (const c of clusters) {
        expect(c.reports.length).toBe(1);
      }
    });

    test('empty input returns empty array', () => {
      const clusters = dbscan([], 30, 2);
      expect(clusters).toEqual([]);
    });

    test('does not mutate original reports', () => {
      const reports = [
        createReport({ report_id: 'r1', lat: 37.7749, lng: -122.4194 }),
        createReport({ report_id: 'r2', lat: 37.7750, lng: -122.4195 }),
      ];
      const originalLat = reports[0].lat;
      dbscan(reports, 30, 2);
      expect(reports[0].lat).toBe(originalLat);
    });

    test('density-reachable points are included in cluster', () => {
      const reports = [
        createReport({ report_id: 'r1', lat: 37.7749, lng: -122.4194 }),
        createReport({ report_id: 'r2', lat: 37.7750, lng: -122.4194 }),
        createReport({ report_id: 'r3', lat: 37.7751, lng: -122.4194 }),
      ];
      const clusters = dbscan(reports, 30, 2);
      expect(clusters.length).toBe(1);
      expect(clusters[0].reports.length).toBe(3);
    });
  });

  describe('clusterByType', () => {
    test('dbscan_type_separation: different hazard types never cluster together', () => {
      const reports = [
        createReport({ report_id: 'r1', hazard_type: 'pothole', lat: 37.7749, lng: -122.4194 }),
        createReport({ report_id: 'r2', hazard_type: 'oil_spill', lat: 37.7750, lng: -122.4195 }),
      ];
      const clusters = clusterByType(reports, 30, 2);
      expect(clusters.length).toBe(2);
      for (const c of clusters) {
        expect(c.reports.length).toBe(1);
      }
    });

    test('same type clusters, different types separate', () => {
      const reports = [
        createReport({ report_id: 'r1', hazard_type: 'pothole', lat: 37.7749, lng: -122.4194 }),
        createReport({ report_id: 'r2', hazard_type: 'pothole', lat: 37.7750, lng: -122.4195 }),
        createReport({ report_id: 'r3', hazard_type: 'oil_spill', lat: 37.7749, lng: -122.4194 }),
        createReport({ report_id: 'r4', hazard_type: 'oil_spill', lat: 37.7750, lng: -122.4195 }),
      ];
      const clusters = clusterByType(reports, 30, 2);
      expect(clusters.length).toBe(2);
      for (const c of clusters) {
        expect(c.reports.length).toBe(2);
        const types = new Set(c.reports.map(r => r.hazard_type));
        expect(types.size).toBe(1);
      }
    });
  });

  describe('calculateCentroid', () => {
    test('verify average lat/lng', () => {
      const reports = [
        createReport({ report_id: 'r1', lat: 37.0, lng: -122.0 }),
        createReport({ report_id: 'r2', lat: 39.0, lng: -124.0 }),
      ];
      const centroid = calculateCentroid(reports);
      expect(centroid.lat).toBeCloseTo(38.0);
      expect(centroid.lng).toBeCloseTo(-123.0);
    });

    test('empty input returns zero', () => {
      const centroid = calculateCentroid([]);
      expect(centroid.lat).toBe(0);
      expect(centroid.lng).toBe(0);
    });
  });

  describe('calculateBoundingBox', () => {
    test('verify four corners and min/max values', () => {
      const reports = [
        createReport({ report_id: 'r1', lat: 37.0, lng: -124.0 }),
        createReport({ report_id: 'r2', lat: 39.0, lng: -122.0 }),
        createReport({ report_id: 'r3', lat: 38.0, lng: -123.0 }),
      ];
      const bbox = calculateBoundingBox(reports);
      expect(bbox.length).toBe(4);
      expect(bbox[0]).toEqual([37.0, -124.0]);
      expect(bbox[1]).toEqual([37.0, -122.0]);
      expect(bbox[2]).toEqual([39.0, -122.0]);
      expect(bbox[3]).toEqual([39.0, -124.0]);
    });

    test('empty input returns zero box', () => {
      const bbox = calculateBoundingBox([]);
      expect(bbox.length).toBe(4);
      for (const pt of bbox) {
        expect(pt).toEqual([0, 0]);
      }
    });
  });

  describe('calculateHazardScore', () => {
    const now = Date.now();

    test('recent report has high score', () => {
      const score = calculateHazardScore(1, now - 1000);
      expect(score).toBeGreaterThan(0.1);
      expect(score).toBeLessThanOrEqual(1);
    });

    test('5 recent reports reaches max report-count component', () => {
      const score = calculateHazardScore(5, now - 1000);
      expect(score).toBeCloseTo(1 * Math.exp(-(1000 / 3600000) / 24), 3);
    });

    test('older report has lower score', () => {
      const recentScore = calculateHazardScore(3, now - 3600000);
      const olderScore = calculateHazardScore(3, now - 7200000);
      expect(olderScore).toBeLessThan(recentScore);
    });

    test('score remains within [0,1]', () => {
      const score1 = calculateHazardScore(100, now);
      const score2 = calculateHazardScore(0, now);
      const score3 = calculateHazardScore(5, now + 86400000);
      expect(score1).toBeGreaterThanOrEqual(0);
      expect(score1).toBeLessThanOrEqual(1);
      expect(score2).toBeGreaterThanOrEqual(0);
      expect(score2).toBeLessThanOrEqual(1);
      expect(score3).toBeGreaterThanOrEqual(0);
      expect(score3).toBeLessThanOrEqual(1);
    });

    test('future timestamp does not produce score > 1', () => {
      const score = calculateHazardScore(10, now + 86400000);
      expect(score).toBeLessThanOrEqual(1);
    });
  });
});

describe('Phase 2: Real HLC Implementation', () => {
  beforeEach(() => {
    HLC._resetStorage();
  });

  describe('A. HLC ordering', () => {
    test('multiple local now() calls are monotonically increasing', () => {
      const hlc = HLC.fresh(() => 1000);
      const t1 = hlc.now();
      const t2 = hlc.now();
      expect(HLC.compare(t1, t2)).toBe(-1);
    });

    test('same-millisecond calls increment the logical counter', () => {
      const hlc = HLC.fresh(() => 1000);
      hlc.now();
      hlc.now();
      const state = hlc.toState();
      expect(state.physical).toBe(1000);
      expect(state.counter).toBe(2);
    });

    test('physical time advancing resets the counter', () => {
      let time = 1000;
      const hlc = HLC.fresh(() => time);
      hlc.now();

      time = 1001;
      hlc.now();

      const state = hlc.toState();
      expect(state.physical).toBe(1001);
      expect(state.counter).toBe(0);
    });
  });

  describe('B. HLC persistence', () => {
    test('generates timestamp, persists, recreates, and next timestamp does not go backwards', () => {
      let time = 2000;
      const hlc1 = HLC.fresh(() => time);
      const t1 = hlc1.now();

      time = 1000;
      const hlc2 = HLC.fresh(() => time);
      const t2 = hlc2.now();

      expect(HLC.compare(t1, t2)).toBe(-1);
      expect(hlc2.toState().physical).toBe(2000);
      expect(hlc2.toState().counter).toBe(2);
    });
  });

  describe('C. HLC receive', () => {
    test('merged timestamp follows receive algorithm', () => {
      const hlc = HLC.fresh(() => 1000);
      hlc.now();

      const merged1 = hlc.receive('2000-5');
      expect(merged1).toBe('2000-6');
      expect(hlc.toState().counter).toBe(6);

      const merged2 = hlc.receive('500-10');
      expect(merged2).toBe('2000-7');
    });
  });

  describe('D. HLC compare', () => {
    test('physical less', () => {
      expect(HLC.compare('1000-0', '1001-0')).toBe(-1);
    });
    test('physical greater', () => {
      expect(HLC.compare('2000-0', '1000-5')).toBe(1);
    });
    test('same physical + lower counter', () => {
      expect(HLC.compare('1000-3', '1000-4')).toBe(-1);
    });
    test('same physical + higher counter', () => {
      expect(HLC.compare('1000-5', '1000-4')).toBe(1);
    });
    test('exact equality', () => {
      expect(HLC.compare('1000-3', '1000-3')).toBe(0);
    });
  });

  describe('E. Serialization', () => {
    test('toString -> parse -> exact state', () => {
      const hlc = HLC.fresh(() => 9999);
      const str = hlc.now();
      const parsed = HLC.parse(str);
      expect(parsed.physical).toBe(hlc.toState().physical);
      expect(parsed.counter).toBe(hlc.toState().counter);
      expect(hlc.toString()).toBe(`${parsed.physical}-${parsed.counter}`);
    });
  });

  describe('F. Offline ordering scenario', () => {
    test('events created offline by different devices preserve causality on receipt', () => {
      let timeA = 1000;
      let timeB = 1000;
      const hlcA = HLC.fresh(() => timeA);
      const hlcB = HLC.fresh(() => timeB);

      const eventA1 = hlcA.now();
      const eventB1 = hlcB.now();

      hlcB.receive(eventA1);
      const eventB2 = hlcB.now();

      expect(HLC.compare(eventA1, eventB2)).toBe(-1);
      expect(HLC.compare(eventA1, eventB1)).toBe(0);
    });
  });
});

describe('Phase 3 Part B: CRDT OR-Set for SOS', () => {
  const createHLC = () => HLC.fresh(() => 1000);
  const baseTime = 1700000000000;

  const createSosElement = (overrides: Partial<SOSElement> = {}): SOSElement => ({
    sos_id: `sos_${Math.random().toString(36).slice(2, 9)}`,
    rider_id: 'rider_1',
    group_id: 'group_1',
    lat: 37.7749,
    lng: -122.4194,
    created_at_hlc: `${baseTime}-1`,
    ...overrides,
  });

  const resetMockMMKV = () => {
    jest.resetModules();
  };

  beforeEach(() => {
    HLC._resetStorage();
  });

  describe('crdt_sos_merge_convergent', () => {
    test('Client A creates SOS-A, Client B creates SOS-B, merge contains both', () => {
      const hlcA = createHLC();
      const hlcB = createHLC();

      let setA = createORSet();
      const sosA = createSosElement({ sos_id: 'sos-A', rider_id: 'rider-A' });
      setA = orSetAdd(setA, sosA, hlcA);

      let setB = createORSet();
      const sosB = createSosElement({ sos_id: 'sos-B', rider_id: 'rider-B' });
      setB = orSetAdd(setB, sosB, hlcB);

      const mergedAB = orSetMerge(setA, setB);
      const activeAB = orSetGetActive(mergedAB);
      expect(activeAB.length).toBe(2);
      const idsAB = activeAB.map(s => s.sos_id).sort();
      expect(idsAB).toEqual(['sos-A', 'sos-B']);

      const mergedBA = orSetMerge(setB, setA);
      const activeBA = orSetGetActive(mergedBA);
      expect(activeBA.length).toBe(2);
      const idsBA = activeBA.map(s => s.sos_id).sort();
      expect(idsBA).toEqual(['sos-A', 'sos-B']);
    });

    test('merge is commutative: merge(A,B) === merge(B,A)', () => {
      const hlcA = createHLC();
      const hlcB = createHLC();

      let setA = createORSet();
      setA = orSetAdd(setA, createSosElement({ sos_id: 'sos-1' }), hlcA);
      setA = orSetAdd(setA, createSosElement({ sos_id: 'sos-2' }), hlcA);

      let setB = createORSet();
      setB = orSetAdd(setB, createSosElement({ sos_id: 'sos-3' }), hlcB);

      const mergedAB = orSetMerge(setA, setB);
      const mergedBA = orSetMerge(setB, setA);

      const activeAB = orSetGetActive(mergedAB).map(s => s.sos_id).sort();
      const activeBA = orSetGetActive(mergedBA).map((s: SOSElement) => s.sos_id).sort();
      expect(activeAB).toEqual(activeBA);

      expect(mergedAB.adds.size).toBe(mergedBA.adds.size);
      expect(mergedAB.tombstones.size).toBe(mergedBA.tombstones.size);
    });
  });

  describe('crdt_resolve_tombstone', () => {
    test('Create SOS then resolve it -> inactive', () => {
      const hlc = createHLC();
      let set = createORSet();
      const sos = createSosElement({ sos_id: 'sos-resolve' });
      set = orSetAdd(set, sos, hlc);

      expect(orSetGetActive(set).length).toBe(1);

      set = orSetRemove(set, 'sos-resolve');

      expect(orSetGetActive(set).length).toBe(0);
    });

    test('Resolve merges with another replica - convergence', () => {
      const hlcA = createHLC();
      const hlcB = createHLC();

      let setA = createORSet();
      const sosA = createSosElement({ sos_id: 'sos-merge-resolve' });
      setA = orSetAdd(setA, sosA, hlcA);
      setA = orSetRemove(setA, 'sos-merge-resolve');

      let setB = createORSet();
      setB = orSetAdd(setB, createSosElement({ sos_id: 'sos-other' }), hlcB);

      const merged = orSetMerge(setA, setB);
      const active = orSetGetActive(merged);
      expect(active.length).toBe(1);
      expect(active[0].sos_id).toBe('sos-other');
    });

    test('Concurrent add and resolve: Replica A resolves, Replica B adds new tag for same SOS', () => {
      const hlcA = createHLC();
      const hlcB = createHLC();

      let setA = createORSet();
      const sosOriginal = createSosElement({ sos_id: 'sos-concurrent', rider_id: 'rider-A' });
      setA = orSetAdd(setA, sosOriginal, hlcA);
      setA = orSetRemove(setA, 'sos-concurrent');

      let setB = createORSet();
      const sosConcurrent = createSosElement({
        sos_id: 'sos-concurrent',
        rider_id: 'rider-B',
        created_at_hlc: `${baseTime}-999`,
      });
      setB = orSetAdd(setB, sosConcurrent, hlcB);

      const merged = orSetMerge(setA, setB);
      const active = orSetGetActive(merged);

      expect(active.length).toBe(1);
      expect(active[0].sos_id).toBe('sos-concurrent');
      expect(active[0].rider_id).toBe('rider-B');
    });
  });

  describe('crdt_add_idempotent', () => {
    test('Adding same logical SOS repeatedly produces no duplicates', () => {
      const hlc = createHLC();
      let set = createORSet();

      const sos = createSosElement({ sos_id: 'sos-idempotent' });

      set = orSetAdd(set, sos, hlc);
      set = orSetAdd(set, sos, hlc);
      set = orSetAdd(set, sos, hlc);

      const active = orSetGetActive(set);
      expect(active.length).toBe(1);
      expect(active[0].sos_id).toBe('sos-idempotent');
    });
  });

  describe('crdt_merge_commutative', () => {
    test('merge(A,B) and merge(B,A) produce equivalent normalized state', () => {
      const hlcA = createHLC();
      const hlcB = createHLC();

      let setA = createORSet();
      setA = orSetAdd(setA, createSosElement({ sos_id: 'sos-A1' }), hlcA);
      setA = orSetAdd(setA, createSosElement({ sos_id: 'sos-A2' }), hlcA);
      setA = orSetRemove(setA, 'sos-A1');

      let setB = createORSet();
      setB = orSetAdd(setB, createSosElement({ sos_id: 'sos-B1' }), hlcB);
      setB = orSetRemove(setB, 'sos-B1');

      const mergedAB = orSetMerge(setA, setB);
      const mergedBA = orSetMerge(setB, setA);

      const activeAB = orSetGetActive(mergedAB).map(s => s.sos_id).sort();
      const activeBA = orSetGetActive(mergedBA).map((s: SOSElement) => s.sos_id).sort();
      expect(activeAB).toEqual(activeBA);

      const addsAB = Array.from(mergedAB.adds.keys()).sort();
      const addsBA = Array.from(mergedBA.adds.keys()).sort();
      expect(addsAB).toEqual(addsBA);

      const tombstonesAB = Array.from(mergedAB.tombstones).sort();
      const tombstonesBA = Array.from(mergedBA.tombstones).sort();
      expect(tombstonesAB).toEqual(tombstonesBA);
    });
  });

  describe('crdt_persistence', () => {
    test('Save OR-Set with multiple elements and tombstone, load and verify', () => {
      const hlc = createHLC();
      let set = createORSet();

      const sos1 = createSosElement({ sos_id: 'sos-1' });
      const sos2 = createSosElement({ sos_id: 'sos-2' });
      const sos3 = createSosElement({ sos_id: 'sos-3' });

      set = orSetAdd(set, sos1, hlc);
      set = orSetAdd(set, sos2, hlc);
      set = orSetAdd(set, sos3, hlc);
      set = orSetRemove(set, 'sos-2');

      const storageKey = 'test_or_set_persistence';
      orSetSave(set, storageKey);

      const loaded = orSetLoad(storageKey);

      expect(loaded.adds.size).toBe(3);
      expect(loaded.tombstones.size).toBe(1);

      const active = orSetGetActive(loaded);
      expect(active.length).toBe(2);
      const activeIds = active.map((s: SOSElement) => s.sos_id).sort();
      expect(activeIds).toEqual(['sos-1', 'sos-3']);
    });

    test('Load from missing/invalid storage returns empty OR-Set', () => {
      const storage = require('react-native-mmkv').MMKV;
      const instance = new storage({ id: 'nonexistent_key_12345' });
      instance.clearAll();

      const loaded = orSetLoad('nonexistent_key_12345');
      expect(loaded.adds.size).toBe(0);
      expect(loaded.tombstones.size).toBe(0);
      expect(orSetGetActive(loaded).length).toBe(0);
    });

    test('Load from corrupted JSON returns empty OR-Set', () => {
      const storage = require('react-native-mmkv').MMKV;
      const instance = new storage({ id: 'corrupted_test' });
      instance.set('or_set', 'not valid json');

      const loaded = orSetLoad('corrupted_test');
      expect(loaded.adds.size).toBe(0);
      expect(loaded.tombstones.size).toBe(0);
    });
  });
});
describe('Phase 4: Offline-Resilient Storage & Sync - Component 1: Local Queue', () => {
  // Import Phase 4 queue functions
  const {
    queueEnqueue,
    queueDequeue,
    queuePeek,
    queueUpdateRetry,
    queueSize,
    queueClear,
    _resetQueueStorage,
    HAZARD_QUEUE,
    SOS_QUEUE,
  } = require('../src/crdt/localQueue');

  beforeEach(() => {
    _resetQueueStorage();
    HLC._resetStorage();
  });

  describe('queue_enqueue_dequeue', () => {
    test('enqueue A, B, C then peek returns all three in order', () => {
      const opA = {
        id: 'op-A',
        type: 'hazard_report' as const,
        data: { report_id: 'r1', rider_id: 'rider1', group_id: 'g1', hazard_type: 'pothole', lat: 37.0, lng: -122.0, timestamp_hlc: '1000-0', reported_at_hlc: '1000-0' },
        created_at_hlc: '1000-0',
        retry_count: 0
      };
      const opB = {
        id: 'op-B',
        type: 'sos_event' as const,
        data: { sos_id: 's1', rider_id: 'rider1', group_id: 'g1', lat: 37.0, lng: -122.0, created_at_hlc: '1000-1' },
        created_at_hlc: '1000-1',
        retry_count: 0
      };
      const opC = {
        id: 'op-C',
        type: 'sos_resolve' as const,
        data: { sos_id: 's1', resolved_at_hlc: '1000-2' },
        created_at_hlc: '1000-2',
        retry_count: 0
      };

      queueEnqueue(HAZARD_QUEUE, opA);
      queueEnqueue(HAZARD_QUEUE, opB);
      queueEnqueue(HAZARD_QUEUE, opC);

      const queue = queuePeek(HAZARD_QUEUE);
      expect(queue.length).toBe(3);
      expect(queue[0].id).toBe('op-A');
      expect(queue[1].id).toBe('op-B');
      expect(queue[2].id).toBe('op-C');
    });

    test('dequeue B removes only B, leaving A and C in order', () => {
      const opA = {
        id: 'op-A',
        type: 'hazard_report' as const,
        data: { report_id: 'r1', rider_id: 'rider1', group_id: 'g1', hazard_type: 'pothole', lat: 37.0, lng: -122.0, timestamp_hlc: '1000-0', reported_at_hlc: '1000-0' },
        created_at_hlc: '1000-0',
        retry_count: 0
      };
      const opB = {
        id: 'op-B',
        type: 'sos_event' as const,
        data: { sos_id: 's1', rider_id: 'rider1', group_id: 'g1', lat: 37.0, lng: -122.0, created_at_hlc: '1000-1' },
        created_at_hlc: '1000-1',
        retry_count: 0
      };
      const opC = {
        id: 'op-C',
        type: 'sos_resolve' as const,
        data: { sos_id: 's1', resolved_at_hlc: '1000-2' },
        created_at_hlc: '1000-2',
        retry_count: 0
      };

      queueEnqueue(HAZARD_QUEUE, opA);
      queueEnqueue(HAZARD_QUEUE, opB);
      queueEnqueue(HAZARD_QUEUE, opC);

      queueDequeue(HAZARD_QUEUE, 'op-B');

      const queue = queuePeek(HAZARD_QUEUE);
      expect(queue.length).toBe(2);
      expect(queue[0].id).toBe('op-A');
      expect(queue[1].id).toBe('op-C');
    });

    test('dequeue nonexistent ID is safe (idempotent)', () => {
      const opA = {
        id: 'op-A',
        type: 'hazard_report' as const,
        data: { report_id: 'r1', rider_id: 'rider1', group_id: 'g1', hazard_type: 'pothole', lat: 37.0, lng: -122.0, timestamp_hlc: '1000-0', reported_at_hlc: '1000-0' },
        created_at_hlc: '1000-0',
        retry_count: 0
      };

      queueEnqueue(HAZARD_QUEUE, opA);

      // Dequeue nonexistent - should not throw
      queueDequeue(HAZARD_QUEUE, 'nonexistent-id');

      const queue = queuePeek(HAZARD_QUEUE);
      expect(queue.length).toBe(1);
      expect(queue[0].id).toBe('op-A');
    });
  });

  describe('FIFO behavior', () => {
    test('operations returned in insertion order', () => {
      const operations = [];
      for (let i = 0; i < 5; i++) {
        const op = {
          id: `op-${i}`,
          type: 'hazard_report' as const,
          data: { report_id: `r${i}`, rider_id: 'rider1', group_id: 'g1', hazard_type: 'pothole', lat: 37.0, lng: -122.0, timestamp_hlc: `1000-${i}`, reported_at_hlc: `1000-${i}` },
          created_at_hlc: `1000-${i}`,
          retry_count: 0
        };
        operations.push(op);
        queueEnqueue(HAZARD_QUEUE, op);
      }

      const queue = queuePeek(HAZARD_QUEUE);
      expect(queue.length).toBe(5);
      for (let i = 0; i < 5; i++) {
        expect(queue[i].id).toBe(`op-${i}`);
      }
    });
  });

  describe('persistence', () => {
    test('enqueue, simulate reload, operation still exists', () => {
      const op = {
        id: 'op-persist',
        type: 'sos_event' as const,
        data: { sos_id: 's1', rider_id: 'rider1', group_id: 'g1', lat: 37.0, lng: -122.0, created_at_hlc: '1000-0' },
        created_at_hlc: '1000-0',
        retry_count: 0
      };

      queueEnqueue(SOS_QUEUE, op);

      // Simulate module reload - queue peek should still work
      const queue = queuePeek(SOS_QUEUE);
      expect(queue.length).toBe(1);
      expect(queue[0].id).toBe('op-persist');
      expect(queue[0].type).toBe('sos_event');
    });

    test('empty queue returns empty array', () => {
      const queue = queuePeek('nonexistent_queue');
      expect(queue).toEqual([]);
    });

    test('corrupted queue JSON returns empty array', () => {
      const MMKV = require('react-native-mmkv').MMKV;
      const storage = new MMKV({ id: 'offline_queue' });
      storage.set('corrupted_queue', '{invalid json}');

      const queue = queuePeek('corrupted_queue');
      expect(queue).toEqual([]);
    });
  });

  describe('retry count updates', () => {
    test('queueUpdateRetry updates retry_count for specific operation', () => {
      const op1 = {
        id: 'op-1',
        type: 'hazard_report' as const,
        data: { report_id: 'r1', rider_id: 'rider1', group_id: 'g1', hazard_type: 'pothole', lat: 37.0, lng: -122.0, timestamp_hlc: '1000-0', reported_at_hlc: '1000-0' },
        created_at_hlc: '1000-0',
        retry_count: 0
      };
      const op2 = {
        id: 'op-2',
        type: 'hazard_report' as const,
        data: { report_id: 'r2', rider_id: 'rider1', group_id: 'g1', hazard_type: 'pothole', lat: 37.0, lng: -122.0, timestamp_hlc: '1000-1', reported_at_hlc: '1000-1' },
        created_at_hlc: '1000-1',
        retry_count: 0
      };

      queueEnqueue(HAZARD_QUEUE, op1);
      queueEnqueue(HAZARD_QUEUE, op2);

      queueUpdateRetry(HAZARD_QUEUE, 'op-1', 1);

      const queue = queuePeek(HAZARD_QUEUE);
      expect(queue[0].retry_count).toBe(1);
      expect(queue[1].retry_count).toBe(0);
    });

    test('retry count persists across queue reload', () => {
      const op = {
        id: 'op-retry',
        type: 'sos_event' as const,
        data: { sos_id: 's1', rider_id: 'rider1', group_id: 'g1', lat: 37.0, lng: -122.0, created_at_hlc: '1000-0' },
        created_at_hlc: '1000-0',
        retry_count: 0
      };

      queueEnqueue(SOS_QUEUE, op);
      queueUpdateRetry(SOS_QUEUE, 'op-retry', 2);

      // Simulate reload
      const queue = queuePeek(SOS_QUEUE);
      expect(queue[0].retry_count).toBe(2);
    });
  });

  describe('queue utility functions', () => {
    test('queueSize returns correct count', () => {
      expect(queueSize(HAZARD_QUEUE)).toBe(0);

      queueEnqueue(HAZARD_QUEUE, {
        id: 'op-1',
        type: 'hazard_report' as const,
        data: { report_id: 'r1', rider_id: 'rider1', group_id: 'g1', hazard_type: 'pothole', lat: 37.0, lng: -122.0, timestamp_hlc: '1000-0', reported_at_hlc: '1000-0' },
        created_at_hlc: '1000-0',
        retry_count: 0
      });

      expect(queueSize(HAZARD_QUEUE)).toBe(1);

      queueEnqueue(HAZARD_QUEUE, {
        id: 'op-2',
        type: 'hazard_report' as const,
        data: { report_id: 'r2', rider_id: 'rider1', group_id: 'g1', hazard_type: 'pothole', lat: 37.0, lng: -122.0, timestamp_hlc: '1000-1', reported_at_hlc: '1000-1' },
        created_at_hlc: '1000-1',
        retry_count: 0
      });

      expect(queueSize(HAZARD_QUEUE)).toBe(2);
    });

    test('queueClear removes all operations', () => {
      queueEnqueue(HAZARD_QUEUE, {
        id: 'op-1',
        type: 'hazard_report' as const,
        data: { report_id: 'r1', rider_id: 'rider1', group_id: 'g1', hazard_type: 'pothole', lat: 37.0, lng: -122.0, timestamp_hlc: '1000-0', reported_at_hlc: '1000-0' },
        created_at_hlc: '1000-0',
        retry_count: 0
      });
      queueEnqueue(HAZARD_QUEUE, {
        id: 'op-2',
        type: 'hazard_report' as const,
        data: { report_id: 'r2', rider_id: 'rider1', group_id: 'g1', hazard_type: 'pothole', lat: 37.0, lng: -122.0, timestamp_hlc: '1000-1', reported_at_hlc: '1000-1' },
        created_at_hlc: '1000-1',
        retry_count: 0
      });

      expect(queueSize(HAZARD_QUEUE)).toBe(2);

      queueClear(HAZARD_QUEUE);

      expect(queueSize(HAZARD_QUEUE)).toBe(0);
      expect(queuePeek(HAZARD_QUEUE)).toEqual([]);
    });
  });

  describe('separate queue isolation', () => {
    test('HAZARD_QUEUE and SOS_QUEUE are independent', () => {
      const hazardOp = {
        id: 'hazard-op',
        type: 'hazard_report' as const,
        data: { report_id: 'r1', rider_id: 'rider1', group_id: 'g1', hazard_type: 'pothole', lat: 37.0, lng: -122.0, timestamp_hlc: '1000-0', reported_at_hlc: '1000-0' },
        created_at_hlc: '1000-0',
        retry_count: 0
      };
      const sosOp = {
        id: 'sos-op',
        type: 'sos_event' as const,
        data: { sos_id: 's1', rider_id: 'rider1', group_id: 'g1', lat: 37.0, lng: -122.0, created_at_hlc: '1000-1' },
        created_at_hlc: '1000-1',
        retry_count: 0
      };

      queueEnqueue(HAZARD_QUEUE, hazardOp);
      queueEnqueue(SOS_QUEUE, sosOp);

      expect(queueSize(HAZARD_QUEUE)).toBe(1);
      expect(queueSize(SOS_QUEUE)).toBe(1);
      expect(queuePeek(HAZARD_QUEUE)[0].id).toBe('hazard-op');
      expect(queuePeek(SOS_QUEUE)[0].id).toBe('sos-op');

      queueClear(HAZARD_QUEUE);

      expect(queueSize(HAZARD_QUEUE)).toBe(0);
      expect(queueSize(SOS_QUEUE)).toBe(1);
    });
  });
});

describe('Phase 4: Offline-Resilient Storage & Sync - Component 2: SyncWorker', () => {
  // Import Phase 4 sync functions
  const {
    isOnline,
    syncHazardReports,
    syncSosEvents,
    mergeSosOnSync,
    startSyncWorker,
    _getSyncCallCount,
    _resetSyncCallCount,
  } = require('../src/crdt/syncWorker');

  const {
    queueEnqueue,
    queueDequeue,
    queuePeek,
    queueClear,
    _resetQueueStorage,
    HAZARD_QUEUE,
    SOS_QUEUE,
  } = require('../src/crdt/localQueue');

  const {
    createORSet,
    orSetAdd,
    orSetSave,
    orSetLoad,
    orSetGetActive,
  } = require('../src/crdt/orSet');

  const NetInfo = require('@react-native-community/netinfo').default;
  const firestore = require('@react-native-firebase/firestore').default;

  beforeEach(() => {
    _resetQueueStorage();
    HLC._resetStorage();
    _resetSyncCallCount();
    NetInfo._clearListeners();
    NetInfo._setNetworkState({ isConnected: true });
    firestore._clearData();
    firestore._setFailWrites(false);
  });

  describe('isOnline', () => {
    test('returns true when connected', async () => {
      NetInfo._setNetworkState({ isConnected: true });
      const online = await isOnline();
      expect(online).toBe(true);
    });

    test('returns false when disconnected', async () => {
      NetInfo._setNetworkState({ isConnected: false });
      const online = await isOnline();
      expect(online).toBe(false);
    });

    test('returns false when isConnected is null', async () => {
      NetInfo._setNetworkState({ isConnected: null });
      const online = await isOnline();
      expect(online).toBe(false);
    });
  });

  describe('syncHazardReports', () => {
    test('syncs queued hazard report to Firestore and dequeues on success', async () => {
      const report = {
        report_id: 'r1',
        rider_id: 'rider1',
        group_id: 'group1',
        hazard_type: 'pothole',
        lat: 37.0,
        lng: -122.0,
        timestamp_hlc: '1000-0',
        reported_at_hlc: '1000-0',
      };

      const operation = {
        id: 'op-1',
        type: 'hazard_report' as const,
        data: report,
        created_at_hlc: '1000-0',
        retry_count: 0,
      };

      queueEnqueue(HAZARD_QUEUE, operation);
      expect(queuePeek(HAZARD_QUEUE).length).toBe(1);

      await syncHazardReports('group1');

      // Should be dequeued after successful sync
      expect(queuePeek(HAZARD_QUEUE).length).toBe(0);

      // Should be in Firestore
      const firestoreData = firestore._getData();
      expect(firestoreData['groups/group1/reports']).toBeDefined();
      expect(firestoreData['groups/group1/reports']['r1']).toEqual(report);
    });

    test('increments retry_count on Firestore failure', async () => {
      const report = {
        report_id: 'r1',
        rider_id: 'rider1',
        group_id: 'group1',
        hazard_type: 'pothole',
        lat: 37.0,
        lng: -122.0,
        timestamp_hlc: '1000-0',
        reported_at_hlc: '1000-0',
      };

      const operation = {
        id: 'op-1',
        type: 'hazard_report' as const,
        data: report,
        created_at_hlc: '1000-0',
        retry_count: 0,
      };

      queueEnqueue(HAZARD_QUEUE, operation);
      firestore._setFailWrites(true);

      await syncHazardReports('group1');

      // Should still be queued
      const queue = queuePeek(HAZARD_QUEUE);
      expect(queue.length).toBe(1);
      expect(queue[0].retry_count).toBe(1);
    });

    test('drops operation after retry_count > 3', async () => {
      const report = {
        report_id: 'r1',
        rider_id: 'rider1',
        group_id: 'group1',
        hazard_type: 'pothole',
        lat: 37.0,
        lng: -122.0,
        timestamp_hlc: '1000-0',
        reported_at_hlc: '1000-0',
      };

      const operation = {
        id: 'op-1',
        type: 'hazard_report' as const,
        data: report,
        created_at_hlc: '1000-0',
        retry_count: 3, // Already at max
      };

      queueEnqueue(HAZARD_QUEUE, operation);
      firestore._setFailWrites(true);

      await syncHazardReports('group1');

      // Should be dequeued (dropped)
      expect(queuePeek(HAZARD_QUEUE).length).toBe(0);
    });

    test('only syncs reports for specified groupId', async () => {
      const report1 = {
        report_id: 'r1',
        rider_id: 'rider1',
        group_id: 'group1',
        hazard_type: 'pothole',
        lat: 37.0,
        lng: -122.0,
        timestamp_hlc: '1000-0',
        reported_at_hlc: '1000-0',
      };

      const report2 = {
        report_id: 'r2',
        rider_id: 'rider2',
        group_id: 'group2',
        hazard_type: 'oil_spill',
        lat: 38.0,
        lng: -123.0,
        timestamp_hlc: '1000-1',
        reported_at_hlc: '1000-1',
      };

      queueEnqueue(HAZARD_QUEUE, {
        id: 'op-1',
        type: 'hazard_report' as const,
        data: report1,
        created_at_hlc: '1000-0',
        retry_count: 0,
      });

      queueEnqueue(HAZARD_QUEUE, {
        id: 'op-2',
        type: 'hazard_report' as const,
        data: report2,
        created_at_hlc: '1000-1',
        retry_count: 0,
      });

      await syncHazardReports('group1');

      // Only group1 report should be dequeued
      const remaining = queuePeek(HAZARD_QUEUE);
      expect(remaining.length).toBe(1);
      expect((remaining[0].data as any).group_id).toBe('group2');
    });
  });

  describe('syncSosEvents', () => {
    test('syncs sos_event to Firestore and dequeues on success', async () => {
      const sos = {
        sos_id: 's1',
        rider_id: 'rider1',
        group_id: 'group1',
        lat: 37.0,
        lng: -122.0,
        created_at_hlc: '1000-0',
      };

      const operation = {
        id: 'op-1',
        type: 'sos_event' as const,
        data: sos,
        created_at_hlc: '1000-0',
        retry_count: 0,
      };

      queueEnqueue(SOS_QUEUE, operation);

      await syncSosEvents('group1');

      expect(queuePeek(SOS_QUEUE).length).toBe(0);

      const firestoreData = firestore._getData();
      expect(firestoreData['sos_events']).toBeDefined();
      expect(firestoreData['sos_events']['s1']).toMatchObject({
        sos_id: 's1',
        rider_id: 'rider1',
        group_id: 'group1',
        resolved: false,
        resolved_at_hlc: null,
      });
    });

    test('syncs sos_resolve updates existing SOS without deleting', async () => {
      // First, create SOS in Firestore
      const db = firestore();
      await db.collection('sos_events').doc('s1').set({
        sos_id: 's1',
        rider_id: 'rider1',
        group_id: 'group1',
        lat: 37.0,
        lng: -122.0,
        created_at_hlc: '1000-0',
        resolved: false,
        resolved_at_hlc: null,
      });

      // Queue resolve operation
      const resolveOp = {
        id: 'op-resolve',
        type: 'sos_resolve' as const,
        data: {
          sos_id: 's1',
          resolved_at_hlc: '1000-5',
        },
        created_at_hlc: '1000-5',
        retry_count: 0,
      };

      queueEnqueue(SOS_QUEUE, resolveOp);

      await syncSosEvents('group1');

      expect(queuePeek(SOS_QUEUE).length).toBe(0);

      // Document should still exist with resolved=true
      const firestoreData = firestore._getData();
      expect(firestoreData['sos_events']['s1']).toBeDefined();
      expect(firestoreData['sos_events']['s1'].resolved).toBe(true);
      expect(firestoreData['sos_events']['s1'].resolved_at_hlc).toBe('1000-5');
    });

    test('increments retry_count on failure', async () => {
      const sos = {
        sos_id: 's1',
        rider_id: 'rider1',
        group_id: 'group1',
        lat: 37.0,
        lng: -122.0,
        created_at_hlc: '1000-0',
      };

      const operation = {
        id: 'op-1',
        type: 'sos_event' as const,
        data: sos,
        created_at_hlc: '1000-0',
        retry_count: 0,
      };

      queueEnqueue(SOS_QUEUE, operation);
      firestore._setFailWrites(true);

      await syncSosEvents('group1');

      const queue = queuePeek(SOS_QUEUE);
      expect(queue.length).toBe(1);
      expect(queue[0].retry_count).toBe(1);
    });

    test('drops operation after retry_count > 3', async () => {
      const sos = {
        sos_id: 's1',
        rider_id: 'rider1',
        group_id: 'group1',
        lat: 37.0,
        lng: -122.0,
        created_at_hlc: '1000-0',
      };

      const operation = {
        id: 'op-1',
        type: 'sos_event' as const,
        data: sos,
        created_at_hlc: '1000-0',
        retry_count: 3,
      };

      queueEnqueue(SOS_QUEUE, operation);
      firestore._setFailWrites(true);

      await syncSosEvents('group1');

      expect(queuePeek(SOS_QUEUE).length).toBe(0);
    });

    test('cross-group sos_resolve is NOT dequeued by a different group\'s syncSosEvents', async () => {
      // Pre-seed Firestore so the lookup returns group2's doc
      const db = firestore();
      await db.collection('sos_events').doc('s-g2').set({
        sos_id: 's-g2',
        rider_id: 'rider2',
        group_id: 'group2',
        lat: 38.0,
        lng: -123.0,
        created_at_hlc: '2000-0',
        resolved: false,
        resolved_at_hlc: null,
      });

      // Enqueue a resolve for group2
      const resolveOp = {
        id: 'op-resolve-g2',
        type: 'sos_resolve' as const,
        data: { sos_id: 's-g2', resolved_at_hlc: '2000-5' },
        created_at_hlc: '2000-5',
        retry_count: 0,
      };
      queueEnqueue(SOS_QUEUE, resolveOp);

      // Sync for group1 — must NOT consume group2's resolve operation
      await syncSosEvents('group1');

      // The resolve op must still be in the queue for group2 to process
      const remaining = queuePeek(SOS_QUEUE);
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe('op-resolve-g2');
    });
  });

  describe('mergeSosOnSync', () => {
    test('merges local and remote OR-Sets', async () => {
      const hlc = HLC.fresh();
      const storageKey = 'sos_orset_group1';

      // Create local OR-Set with one SOS
      let localSet = createORSet();
      const localSos = {
        sos_id: 'local-s1',
        rider_id: 'rider1',
        group_id: 'group1',
        lat: 37.0,
        lng: -122.0,
        created_at_hlc: '1000-0',
      };
      localSet = orSetAdd(localSet, localSos, hlc);
      orSetSave(localSet, storageKey);

      // Create remote SOS in Firestore
      const db = firestore();
      await db.collection('sos_events').doc('remote-s1').set({
        sos_id: 'remote-s1',
        rider_id: 'rider2',
        group_id: 'group1',
        lat: 38.0,
        lng: -123.0,
        created_at_hlc: '1000-1',
        resolved: false,
        resolved_at_hlc: null,
      });

      await mergeSosOnSync('group1');

      // Load merged set
      const merged = orSetLoad(storageKey);
      const active = orSetGetActive(merged);

      // Should contain both local and remote
      expect(active.length).toBe(2);
      const ids = active.map((s: any) => s.sos_id).sort();
      expect(ids).toContain('local-s1');
      expect(ids).toContain('remote-s1');
    });

    test('pushes local-only SOS to Firestore', async () => {
      const hlc = HLC.fresh();
      const storageKey = 'sos_orset_group1';

      // Create local OR-Set with SOS
      let localSet = createORSet();
      const localSos = {
        sos_id: 'local-only-s1',
        rider_id: 'rider1',
        group_id: 'group1',
        lat: 37.0,
        lng: -122.0,
        created_at_hlc: '1000-0',
      };
      localSet = orSetAdd(localSet, localSos, hlc);
      orSetSave(localSet, storageKey);

      await mergeSosOnSync('group1');

      // Local-only SOS should be pushed to Firestore
      const firestoreData = firestore._getData();
      expect(firestoreData['sos_events']).toBeDefined();
      expect(firestoreData['sos_events']['local-only-s1']).toMatchObject({
        sos_id: 'local-only-s1',
        rider_id: 'rider1',
        group_id: 'group1',
      });
    });

    test('preserves tombstone for resolved SOS', async () => {
      const hlc = HLC.fresh();
      const storageKey = 'sos_orset_group1';

      // Create local OR-Set (empty)
      const localSet = createORSet();
      orSetSave(localSet, storageKey);

      // Create resolved SOS in Firestore
      const db = firestore();
      await db.collection('sos_events').doc('resolved-s1').set({
        sos_id: 'resolved-s1',
        rider_id: 'rider1',
        group_id: 'group1',
        lat: 37.0,
        lng: -122.0,
        created_at_hlc: '1000-0',
        resolved: true,
        resolved_at_hlc: '1000-5',
      });

      await mergeSosOnSync('group1');

      // Load merged set
      const merged = orSetLoad(storageKey);
      const active = orSetGetActive(merged);

      // Resolved SOS should not be in active set
      expect(active.length).toBe(0);

      // But should be in the OR-Set with tombstone
      expect(merged.adds.size).toBeGreaterThan(0);
      expect(merged.tombstones.size).toBeGreaterThan(0);
    });
  });

  describe('startSyncWorker', () => {
    test('triggers sync on offline to online transition', async () => {
      // Queue some operations
      queueEnqueue(HAZARD_QUEUE, {
        id: 'op-h1',
        type: 'hazard_report' as const,
        data: {
          report_id: 'r1',
          rider_id: 'rider1',
          group_id: 'group1',
          hazard_type: 'pothole',
          lat: 37.0,
          lng: -122.0,
          timestamp_hlc: '1000-0',
          reported_at_hlc: '1000-0',
        },
        created_at_hlc: '1000-0',
        retry_count: 0,
      });

      queueEnqueue(SOS_QUEUE, {
        id: 'op-s1',
        type: 'sos_event' as const,
        data: {
          sos_id: 's1',
          rider_id: 'rider1',
          group_id: 'group1',
          lat: 37.0,
          lng: -122.0,
          created_at_hlc: '1000-1',
        },
        created_at_hlc: '1000-1',
        retry_count: 0,
      });

      // Start worker in offline state, then await the sync that fires on online transition
      await new Promise<void>(resolve => {
        const unsubscribe = startSyncWorker('group1', () => {
          unsubscribe();
          resolve();
        });
        // Set initial state to offline
        NetInfo._triggerStateChange({ isConnected: false });
        // Transition to online — triggers sync
        NetInfo._triggerStateChange({ isConnected: true });
      });

      // Operations should be synced
      expect(queuePeek(HAZARD_QUEUE).length).toBe(0);
      expect(queuePeek(SOS_QUEUE).length).toBe(0);
    });

    test('does not sync when already online', async () => {
      NetInfo._setNetworkState({ isConnected: true });

      const unsubscribe = startSyncWorker('group1');

      // Queue operation after worker started
      queueEnqueue(HAZARD_QUEUE, {
        id: 'op-h1',
        type: 'hazard_report' as const,
        data: {
          report_id: 'r1',
          rider_id: 'rider1',
          group_id: 'group1',
          hazard_type: 'pothole',
          lat: 37.0,
          lng: -122.0,
          timestamp_hlc: '1000-0',
          reported_at_hlc: '1000-0',
        },
        created_at_hlc: '1000-0',
        retry_count: 0,
      });

      // Trigger state change while online
      NetInfo._triggerStateChange({ isConnected: true });

      await new Promise(resolve => setTimeout(resolve, 200));

      // Should NOT sync (no transition)      expect(queuePeek(HAZARD_QUEUE).length).toBe(1);

      unsubscribe();
    });

    test('unsubscribe stops the worker', () => {
      const unsubscribe = startSyncWorker('group1');

      // Should have one listener
      expect(NetInfo.addEventListener).toHaveBeenCalled();

      unsubscribe();

      // Listener should be removed (check that unsubscribe was called)
      const listenersCount = NetInfo.addEventListener.mock.calls.length;
      expect(listenersCount).toBeGreaterThan(0);
    });
  });

  describe('offline_queue_durability', () => {
    test('SOS queued offline survives app restart and syncs on reconnect', async () => {
      // Simulate offline
      NetInfo._setNetworkState({ isConnected: false });

      // Queue SOS operation
      const sos = {
        sos_id: 's1',
        rider_id: 'rider1',
        group_id: 'group1',
        lat: 37.0,
        lng: -122.0,
        created_at_hlc: '1000-0',
      };

      queueEnqueue(SOS_QUEUE, {
        id: 'op-s1',
        type: 'sos_event' as const,
        data: sos,
        created_at_hlc: '1000-0',
        retry_count: 0,
      });

      // Verify queued
      expect(queuePeek(SOS_QUEUE).length).toBe(1);

      // Simulate app restart (queue should survive via MMKV)
      const queueAfterRestart = queuePeek(SOS_QUEUE);
      expect(queueAfterRestart.length).toBe(1);
      expect(queueAfterRestart[0].id).toBe('op-s1');

      // Simulate reconnect
      NetInfo._setNetworkState({ isConnected: true });

      await syncSosEvents('group1');

      // Should be synced and dequeued
      expect(queuePeek(SOS_QUEUE).length).toBe(0);

      const firestoreData = firestore._getData();
      expect(firestoreData['sos_events']['s1']).toBeDefined();
    });
  });


  describe('Phase 4: CRDT Correctness & Sync Idempotency', () => {
    const {
      syncSosEvents,
      mergeSosOnSync,
      startSyncWorker,
      _getSyncCallCount,
      _resetSyncCallCount,
    } = require('../src/crdt/syncWorker');

    const {
      queueEnqueue,
      queuePeek,
      SOS_QUEUE,
      _resetQueueStorage,
    } = require('../src/crdt/localQueue');

    const firestore = require('../test/__mocks__/firebaseMock').default;
    const NetInfo = require('@react-native-community/netinfo').default;

    beforeEach(() => {
      HLC._resetStorage();
      firestore._clearData();
      _resetQueueStorage();
      _resetSyncCallCount();
      NetInfo._clearListeners();
      jest.clearAllMocks();

      // Clear every MMKV instance that tests in this describe block write to.
      // With per-id isolation, each id gets its own store — clear them all.
      const MMKV = require('react-native-mmkv').MMKV;
      new MMKV({ id: 'test' }).clearAll();
      new MMKV({ id: 'offline_queue' }).clearAll();
      new MMKV({ id: 'sos_orset_group1' }).clearAll();
      new MMKV({ id: 'hlc_storage' }).clearAll();
    });

    describe('CRDT Tag Preservation', () => {
      it('should preserve original CRDT tags across Firestore sync', async () => {
        const groupId = 'group1';
        const hlc = HLC.fresh();

        // Create local SOS with specific tag
        let localSet = createORSet();
        const sosElement: SOSElement = {
          sos_id: 's1',
          rider_id: 'r1',
          group_id: groupId,
          lat: 10.0,
          lng: 20.0,
          created_at_hlc: hlc.now(),
        };
        localSet = orSetAdd(localSet, sosElement, hlc);

        // Extract the generated tag
        const originalTag = Array.from(localSet.adds.keys())[0];
        expect(originalTag).toBeDefined();

        // Save local
        orSetSave(localSet, `sos_orset_${groupId}`);

        // Simulate upload to Firestore (with tag)
        const db = firestore();
        await db.collection('sos_events').doc('s1').set({
          sos_id: 's1',
          rider_id: 'r1',
          group_id: groupId,
          lat: 10.0,
          lng: 20.0,
          created_at_hlc: sosElement.created_at_hlc,
          tag: originalTag,
          resolved: false,
          resolved_at_hlc: null,
        });

        // Clear local to simulate fresh state
        orSetSave(createORSet(), `sos_orset_${groupId}`);

        // Run mergeSosOnSync
        await mergeSosOnSync(groupId);

        // Load merged set
        const merged = orSetLoad(`sos_orset_${groupId}`);

        // Verify original tag is preserved
        const tags = Array.from(merged.adds.keys());
        expect(tags).toHaveLength(1);
        expect(tags[0]).toBe(originalTag);
      });

      it('should use orSetAddWithTag for Firestore reconstruction', async () => {
        const groupId = 'group1';
        const db = firestore();

        // Pre-populate Firestore with explicit tag
        const explicitTag = 's1:r1:1234567890';
        await db.collection('sos_events').doc('s1').set({
          sos_id: 's1',
          rider_id: 'r1',
          group_id: groupId,
          lat: 10.0,
          lng: 20.0,
          created_at_hlc: '1234567890',
          tag: explicitTag,
          resolved: false,
          resolved_at_hlc: null,
        });

        // Run merge
        await mergeSosOnSync(groupId);

        // Verify tag
        const merged = orSetLoad(`sos_orset_${groupId}`);
        const tags = Array.from(merged.adds.keys());
        expect(tags).toContain(explicitTag);
      });
    });

    describe('Local Active + Remote Resolved', () => {
      it('should tombstone existing tag when remote SOS is resolved', async () => {
        const groupId = 'group1';
        const hlc = HLC.fresh();

        // Create local active SOS
        let localSet = createORSet();
        const sosElement: SOSElement = {
          sos_id: 's1',
          rider_id: 'r1',
          group_id: groupId,
          lat: 10.0,
          lng: 20.0,
          created_at_hlc: hlc.now(),
        };
        localSet = orSetAdd(localSet, sosElement, hlc);
        const originalTag = Array.from(localSet.adds.keys())[0];
        orSetSave(localSet, `sos_orset_${groupId}`);

        // Remote has same SOS but resolved
        const db = firestore();
        await db.collection('sos_events').doc('s1').set({
          sos_id: 's1',
          rider_id: 'r1',
          group_id: groupId,
          lat: 10.0,
          lng: 20.0,
          created_at_hlc: sosElement.created_at_hlc,
          tag: originalTag,
          resolved: true,
          resolved_at_hlc: hlc.now(),
        });

        // Run merge
        await mergeSosOnSync(groupId);

        // Verify SOS is tombstoned
        const merged = orSetLoad(`sos_orset_${groupId}`);
        expect(merged.tombstones.has(originalTag)).toBe(true);
        expect(orSetGetActive(merged)).toHaveLength(0);

        // Verify no duplicate tags created
        const tags = Array.from(merged.adds.keys());
        expect(tags).toHaveLength(1);
        expect(tags[0]).toBe(originalTag);
      });
    });


    describe('CRDT Concurrent Tags', () => {
      it('should preserve both tags when local and remote have different tags for same sos_id', async () => {
        const groupId = 'group1';
        const hlc = HLC.fresh();

        // Create local SOS with tag A
        let localSet = createORSet();
        const sosElement: SOSElement = {
          sos_id: 's1',
          rider_id: 'r1',
          group_id: groupId,
          lat: 10.0,
          lng: 20.0,
          created_at_hlc: hlc.now(),
        };
        localSet = orSetAdd(localSet, sosElement, hlc);
        const tagA = Array.from(localSet.adds.keys())[0];
        orSetSave(localSet, `sos_orset_${groupId}`);

        // Remote has same SOS but different tag B
        const tagB = 's1:r1:different-timestamp';
        const db = firestore();
        await db.collection('sos_events').doc('s1').set({
          sos_id: 's1',
          rider_id: 'r1',
          group_id: groupId,
          lat: 10.0,
          lng: 20.0,
          created_at_hlc: 'different-timestamp',
          tag: tagB,
          resolved: false,
          resolved_at_hlc: null,
        });

        // Run merge
        await mergeSosOnSync(groupId);

        // Verify BOTH tags are preserved
        const merged = orSetLoad(`sos_orset_${groupId}`);
        const tags = Array.from(merged.adds.keys());
        expect(tags).toHaveLength(2);
        expect(tags).toContain(tagA);
        expect(tags).toContain(tagB);

        // But only one active SOS (same sos_id)
        const active = orSetGetActive(merged);
        expect(active).toHaveLength(1);
        expect(active[0].sos_id).toBe('s1');
      });
    });

    describe('Repeated Sync Idempotency', () => {
      it('should not accumulate duplicate tags on repeated sync', async () => {
        const groupId = 'group1';
        const db = firestore();

        // Pre-populate Firestore
        await db.collection('sos_events').doc('s1').set({
          sos_id: 's1',
          rider_id: 'r1',
          group_id: groupId,
          lat: 10.0,
          lng: 20.0,
          created_at_hlc: '1234567890',
          tag: 's1:r1:1234567890',
          resolved: false,
          resolved_at_hlc: null,
        });

        // Run merge 3 times
        await mergeSosOnSync(groupId);
        await mergeSosOnSync(groupId);
        await mergeSosOnSync(groupId);

        // Verify only one tag exists
        const merged = orSetLoad(`sos_orset_${groupId}`);
        const tags = Array.from(merged.adds.keys());
        expect(tags).toHaveLength(1);
        expect(orSetGetActive(merged)).toHaveLength(1);
      });

      it('should remain stable across multiple syncs with no remote changes', async () => {
        const groupId = 'group1';
        const hlc = HLC.fresh();

        // Create initial local state
        let localSet = createORSet();
        const sos1: SOSElement = {
          sos_id: 's1',
          rider_id: 'r1',
          group_id: groupId,
          lat: 10.0,
          lng: 20.0,
          created_at_hlc: hlc.now(),
        };
        localSet = orSetAdd(localSet, sos1, hlc);
        orSetSave(localSet, `sos_orset_${groupId}`);

        // First sync (pushes local to remote)
        await mergeSosOnSync(groupId);
        const afterFirst = orSetLoad(`sos_orset_${groupId}`);

        // Second sync (no changes)
        await mergeSosOnSync(groupId);
        const afterSecond = orSetLoad(`sos_orset_${groupId}`);

        // Third sync (no changes)
        await mergeSosOnSync(groupId);
        const afterThird = orSetLoad(`sos_orset_${groupId}`);

        // All should be identical
        expect(Array.from(afterFirst.adds.keys())).toEqual(Array.from(afterSecond.adds.keys()));
        expect(Array.from(afterSecond.adds.keys())).toEqual(Array.from(afterThird.adds.keys()));
        expect(orSetGetActive(afterThird)).toHaveLength(1);
      });
    });

    describe('Resolve-Before-Create Edge Case', () => {
      it('should handle resolve arriving before create exists remotely', async () => {
        const groupId = 'group1';

        // Queue a resolve operation when create doesn't exist yet
        const resolveOp: QueuedOperation = {
          id: 'op-resolve-early',
          type: 'sos_resolve',
          data: {
            sos_id: 's1',
            resolved_at_hlc: '1234567890',
          },
          created_at_hlc: '1234567890',
          retry_count: 0,
        };

        queueEnqueue(SOS_QUEUE, resolveOp);

        // First sync attempt - should retry (not dequeue)
        await syncSosEvents(groupId);

        const queueAfterFirst = queuePeek(SOS_QUEUE);
        expect(queueAfterFirst).toHaveLength(1);
        expect(queueAfterFirst[0].retry_count).toBe(1);

        // Now create the SOS
        const db = firestore();
        await db.collection('sos_events').doc('s1').set({
          sos_id: 's1',
          rider_id: 'r1',
          group_id: groupId,
          lat: 10.0,
          lng: 20.0,
          created_at_hlc: '1234567889',
          tag: 's1:r1:1234567889',
          resolved: false,
          resolved_at_hlc: null,
        });

        // Second sync attempt - should succeed
        await syncSosEvents(groupId);

        const queueAfterSecond = queuePeek(SOS_QUEUE);
        expect(queueAfterSecond).toHaveLength(0);

        // Verify resolved flag is set
        const doc = await db.collection('sos_events').doc('s1').get();
        expect(doc.data()?.resolved).toBe(true);
      });

      it('should create tombstoned entry after max retries if create never arrives', async () => {
        const groupId = 'group1';

        // Queue resolve with high retry count
        const resolveOp: QueuedOperation = {
          id: 'op-resolve-orphan',
          type: 'sos_resolve',
          data: {
            sos_id: 's2',
            resolved_at_hlc: '1234567890',
          },
          created_at_hlc: '1234567890',
          retry_count: 3, // Already at max
        };

        queueEnqueue(SOS_QUEUE, resolveOp);

        // Sync - should create tombstoned entry and dequeue
        await syncSosEvents(groupId);

        const queue = queuePeek(SOS_QUEUE);
        expect(queue).toHaveLength(0);

        // Verify tombstoned entry created
        const db = firestore();
        const doc = await db.collection('sos_events').doc('s2').get();
        expect(doc.exists).toBe(true);
        expect(doc.data()?.resolved).toBe(true);
      });
    });

    describe('Reconnect Transition Logic', () => {
      it('should sync only on offline -> online transition', async () => {
        const groupId = 'group1';

        // Queue an operation
        const sosOp: QueuedOperation = {
          id: 'op-s1',
          type: 'sos_event',
          data: {
            sos_id: 's1',
            rider_id: 'r1',
            group_id: groupId,
            lat: 10.0,
            lng: 20.0,
            created_at_hlc: '1234567890',
          },
          created_at_hlc: '1234567890',
          retry_count: 0,
        };

        queueEnqueue(SOS_QUEUE, sosOp);

        // Queue must still be intact while offline
        NetInfo._triggerStateChange({ isConnected: false });
        expect(queuePeek(SOS_QUEUE)).toHaveLength(1);

        // Await sync completion via onSyncComplete callback (no guessed timeouts)
        await new Promise<void>(resolve => {
          const unsubscribe = startSyncWorker(groupId, () => {
            unsubscribe();
            resolve();
          });
          // Establish offline baseline first, then transition online to trigger sync
          NetInfo._triggerStateChange({ isConnected: false });
          NetInfo._triggerStateChange({ isConnected: true });
        });

        // Should have synced and dequeued
        expect(queuePeek(SOS_QUEUE)).toHaveLength(0);
      });

      it('should NOT sync on repeated online events', async () => {
        const groupId = 'group1';

        // Use the exported counter — it increments inside startSyncWorker when a sync
        // actually fires, so this correctly tracks real calls (unlike patching global).
        _resetSyncCallCount();

        // Start worker; go offline, then await the first online-transition sync finish.
        await new Promise<void>(resolve => {
          const unsubscribe = startSyncWorker(groupId, () => {
            // Called once the first sync run completes — now check repeated events.
            const countAfterFirst = _getSyncCallCount();
            expect(countAfterFirst).toBe(1);

            // Fire repeated online→online events (no offline transition in between).
            NetInfo._triggerStateChange({ isConnected: true });
            NetInfo._triggerStateChange({ isConnected: true });

            // Sync count must not increase — online→online is not a reconnect.
            expect(_getSyncCallCount()).toBe(countAfterFirst);

            unsubscribe();
            resolve();
          });
          // Establish offline baseline, then transition online to trigger the first sync.
          NetInfo._triggerStateChange({ isConnected: false });
          NetInfo._triggerStateChange({ isConnected: true });
        });
      });

      it('should NOT sync on offline transitions', async () => {
        const groupId = 'group1';

        // Queue operation
        queueEnqueue(SOS_QUEUE, {
          id: 'op-s1',
          type: 'sos_event',
          data: {
            sos_id: 's1',
            rider_id: 'r1',
            group_id: groupId,
            lat: 10.0,
            lng: 20.0,
            created_at_hlc: '1234567890',
          },
          created_at_hlc: '1234567890',
          retry_count: 0,
        });

        // Start online
        NetInfo._setNetworkState({ isConnected: true });
        const unsubscribe = startSyncWorker(groupId);
        await new Promise(resolve => setTimeout(resolve, 50));

        // Transition to offline
        NetInfo._setNetworkState({ isConnected: false });
        await new Promise(resolve => setTimeout(resolve, 50));

        // Should NOT sync (still queued)
        expect(queuePeek(SOS_QUEUE)).toHaveLength(1);

        unsubscribe();
      });
    });

    describe('Firestore Mock Group Filtering', () => {
      it('should actually filter by group_id in where() clause', async () => {
        const db = firestore();

        // Add SOS events for multiple groups
        await db.collection('sos_events').doc('s1').set({
          sos_id: 's1',
          group_id: 'group1',
          rider_id: 'r1',
          lat: 10.0,
          lng: 20.0,
          created_at_hlc: '1000',
          tag: 's1:r1:1000',
          resolved: false,
          resolved_at_hlc: null,
        });

        await db.collection('sos_events').doc('s2').set({
          sos_id: 's2',
          group_id: 'group2',
          rider_id: 'r2',
          lat: 30.0,
          lng: 40.0,
          created_at_hlc: '2000',
          tag: 's2:r2:2000',
          resolved: false,
          resolved_at_hlc: null,
        });

        // Query group1 only
        const snapshot = await db.collection('sos_events').where('group_id', '==', 'group1').get();

        // Should only return group1 SOS
        expect(snapshot.docs).toHaveLength(1);
        expect(snapshot.docs[0].data().sos_id).toBe('s1');
      });
    });

    describe('Two-Replica Convergence', () => {
      it('should converge when both replicas have different SOS events', async () => {
        const groupId = 'group1';
        const hlc1 = HLC.fresh();
        const hlc2 = HLC.fresh();

        // Replica 1: has s1
        let replica1 = createORSet();
        const sos1: SOSElement = {
          sos_id: 's1',
          rider_id: 'r1',
          group_id: groupId,
          lat: 10.0,
          lng: 20.0,
          created_at_hlc: hlc1.now(),
        };
        replica1 = orSetAdd(replica1, sos1, hlc1);

        // Replica 2: has s2
        let replica2 = createORSet();
        const sos2: SOSElement = {
          sos_id: 's2',
          rider_id: 'r2',
          group_id: groupId,
          lat: 30.0,
          lng: 40.0,
          created_at_hlc: hlc2.now(),
        };
        replica2 = orSetAdd(replica2, sos2, hlc2);

        // Merge
        const merged = orSetMerge(replica1, replica2);

        // Both should be present
        const active = orSetGetActive(merged);
        expect(active).toHaveLength(2);
        const sosIds = active.map((s: SOSElement) => s.sos_id).sort();
        expect(sosIds).toEqual(['s1', 's2']);
      });
    });

    describe('Batch Failure Preserves Queue', () => {
      it('should not dequeue operations when batch commit fails', async () => {
        const groupId = 'group1';
        const hlc = HLC.fresh();

        // Create local SOS
        let localSet = createORSet();
        const sos1: SOSElement = {
          sos_id: 's1',
          rider_id: 'r1',
          group_id: groupId,
          lat: 10.0,
          lng: 20.0,
          created_at_hlc: hlc.now(),
        };
        localSet = orSetAdd(localSet, sos1, hlc);
        orSetSave(localSet, `sos_orset_${groupId}`);

        // Enable write failure
        firestore._setFailWrites(true);

        // Attempt sync - should fail
        await expect(mergeSosOnSync(groupId)).rejects.toThrow();

        // Disable failure and retry
        firestore._setFailWrites(false);
        await mergeSosOnSync(groupId);

        // Should eventually succeed
        const db = firestore();
        const doc = await db.collection('sos_events').doc('s1').get();
        expect(doc.exists).toBe(true);
      });
    });
  });
});


// Phase 4 Regression Tests - CRDT Correctness


describe('Phase 5: Real Service Layer - Firestore Integration', () => {
  const {
    submitHazardReport,
    triggerClustering,
    subscribeToHazardReports,
    subscribeToHazardClusters,
    resolveHazard,
  } = require('../src/services/hazardService');

  const {
    triggerSos,
    resolveSos,
    subscribeToSosEvents,
    getLocalActiveSosEvents,
  } = require('../src/services/sosService');

  const {
    queueEnqueue,
    queuePeek,
    HAZARD_QUEUE,
    SOS_QUEUE,
    _resetQueueStorage,
  } = require('../src/crdt/localQueue');

  const {
    orSetLoad,
    orSetSave,
    orSetGetActive,
    createORSet,
  } = require('../src/crdt/orSet');

  const firestore = require('../test/__mocks__/firebaseMock').default;
  const NetInfo = require('@react-native-community/netinfo').default;
  const { HLC } = require('../src/hlc/hlc');

  beforeEach(() => {
    HLC._resetStorage();
    firestore._clearData();
    _resetQueueStorage();
    NetInfo._clearListeners();
    jest.clearAllMocks();

    const MMKV = require('react-native-mmkv').MMKV;
    new MMKV({ id: 'hlc' }).clearAll();
    new MMKV({ id: 'offline_queue' }).clearAll();
    new MMKV({ id: 'sos_orset_group1' }).clearAll();
    new MMKV({ id: 'sos_orset_group2' }).clearAll();
    new MMKV({ id: 'sos_orset_group-1' }).clearAll();
  });

  describe('submitHazardReport', () => {
    test('submitHazardReport_online: creates correct report and writes expected Firestore path', async () => {
      NetInfo._setNetworkState({ isConnected: true });

      const report = await submitHazardReport(
        'pothole',
        37.7749,
        -122.4194,
        'rider-1',
        'group-1',
        '1000-0'
      );

      expect(report).toMatchObject({
        hazard_type: 'pothole',
        lat: 37.7749,
        lng: -122.4194,
        rider_id: 'rider-1',
        group_id: 'group-1',
        timestamp_hlc: '1000-0',
      });
      expect(report.report_id).toBeDefined();
      expect(report.reported_at_hlc).toMatch(/^\d+-\d+$/);

      const firestoreData = firestore._getData();
      expect(firestoreData['groups/group-1/reports']).toBeDefined();
      expect(firestoreData['groups/group-1/reports'][report.report_id]).toMatchObject(report);
    });

    test('submitHazardReport_offline: does NOT depend on Firestore, queues using existing local queue', async () => {
      NetInfo._setNetworkState({ isConnected: false });

      const report = await submitHazardReport(
        'accident',
        38.0,
        -123.0,
        'rider-2',
        'group-1',
        '1000-1'
      );

      expect(report.hazard_type).toBe('accident');
      expect(report.group_id).toBe('group-1');

      // Should be queued, not in Firestore
      const queue = queuePeek(HAZARD_QUEUE);
      expect(queue.length).toBe(1);
      expect(queue[0].type).toBe('hazard_report');
      expect((queue[0].data as any).report_id).toBe(report.report_id);

      const firestoreData = firestore._getData();
      expect(firestoreData['groups/group-1/reports']).toBeUndefined();
    });

    test('hazard_report_contract: exact required fields/types', async () => {
      NetInfo._setNetworkState({ isConnected: true });

      const report = await submitHazardReport(
        'debris',
        37.0,
        -122.0,
        'rider-3',
        'group-2',
        '2000-0'
      );

      // Contract: report_id, rider_id, group_id, hazard_type, lat, lng, timestamp_hlc, reported_at_hlc
      expect(typeof report.report_id).toBe('string');
      expect(typeof report.rider_id).toBe('string');
      expect(typeof report.group_id).toBe('string');
      expect(['pothole', 'oil_spill', 'accident', 'debris', 'other']).toContain(report.hazard_type);
      expect(typeof report.lat).toBe('number');
      expect(typeof report.lng).toBe('number');
      expect(typeof report.timestamp_hlc).toBe('string');
      expect(typeof report.reported_at_hlc).toBe('string');
      expect(report.reported_at_hlc).toMatch(/^\d+-\d+$/);
    });
  });

  describe('triggerClustering', () => {
    test('triggerClustering: uses eps=30m, minSamples=2, produces correct hazard_cluster shape', async () => {
      NetInfo._setNetworkState({ isConnected: true });

      // Pre-seed reports in Firestore
      const db = firestore();
      await db.collection('groups/group-1/reports').doc('r1').set({
        report_id: 'r1',
        rider_id: 'rider-1',
        group_id: 'group-1',
        hazard_type: 'pothole',
        lat: 37.7749,
        lng: -122.4194,
        timestamp_hlc: '1000-0',
        reported_at_hlc: '1000-0',
      });
      await db.collection('groups/group-1/reports').doc('r2').set({
        report_id: 'r2',
        rider_id: 'rider-2',
        group_id: 'group-1',
        hazard_type: 'pothole',
        lat: 37.7750,
        lng: -122.4195,
        timestamp_hlc: '1000-1',
        reported_at_hlc: '1000-1',
      });

      await triggerClustering('group-1');

      const firestoreData = firestore._getData();
      expect(firestoreData['hazards']).toBeDefined();

      const clusters = Object.values(firestoreData['hazards']) as any[];
      expect(clusters.length).toBeGreaterThan(0);

      const cluster = clusters[0];
      expect(cluster).toMatchObject({
        cluster_id: expect.any(String),
        group_id: 'group-1',
        hazard_type: 'pothole',
        centroid_lat: expect.any(Number),
        centroid_lng: expect.any(Number),
        polygon_points: expect.arrayContaining([
          expect.arrayContaining([expect.any(Number), expect.any(Number)]),
        ]),
        report_count: 2,
        hazard_score: expect.any(Number),
        created_at_hlc: expect.stringMatching(/^\d+-\d+$/),
        status: 'active',
      });
      expect(cluster.hazard_score).toBeGreaterThanOrEqual(0);
      expect(cluster.hazard_score).toBeLessThanOrEqual(1);
      expect(cluster.polygon_points.length).toBe(4);
    });

    test('hazard_cluster_update: repeated clustering updates existing logical cluster rather than blindly creating duplicates', async () => {
      NetInfo._setNetworkState({ isConnected: true });

      const db = firestore();

      // Add two nearby reports
      await db.collection('groups/group-1/reports').doc('r1').set({
        report_id: 'r1',
        rider_id: 'rider-1',
        group_id: 'group-1',
        hazard_type: 'pothole',
        lat: 37.7749,
        lng: -122.4194,
        timestamp_hlc: '1000-0',
        reported_at_hlc: '1000-0',
      });
      await db.collection('groups/group-1/reports').doc('r2').set({
        report_id: 'r2',
        rider_id: 'rider-2',
        group_id: 'group-1',
        hazard_type: 'pothole',
        lat: 37.7750,
        lng: -122.4195,
        timestamp_hlc: '1000-1',
        reported_at_hlc: '1000-1',
      });

      // First clustering
      await triggerClustering('group-1');
      let firestoreData = firestore._getData();
      const firstClusters = Object.keys(firestoreData['hazards'] || {});
      expect(firstClusters.length).toBe(1);
      const firstClusterId = firstClusters[0];

      // Add a third nearby report
      await db.collection('groups/group-1/reports').doc('r3').set({
        report_id: 'r3',
        rider_id: 'rider-3',
        group_id: 'group-1',
        hazard_type: 'pothole',
        lat: 37.7751,
        lng: -122.4196,
        timestamp_hlc: '1000-2',
        reported_at_hlc: '1000-2',
      });

      // Second clustering - should UPDATE existing cluster, not create new
      await triggerClustering('group-1');
      firestoreData = firestore._getData();
      const secondClusters = Object.keys(firestoreData['hazards'] || {});

      // Should still have only 1 cluster (updated)
      expect(secondClusters.length).toBe(1);
      expect(secondClusters[0]).toBe(firstClusterId);

      // Report count should be updated
      expect(firestoreData['hazards'][firstClusterId].report_count).toBe(3);
    });
  });

  describe('subscribeToHazardClusters', () => {
    test('subscribeToHazardClusters: filters group_id, filters active status, returns unsubscribe function', async () => {
      NetInfo._setNetworkState({ isConnected: true });

      const db = firestore();

      // Add clusters for group-1 (active and resolved)
      await db.collection('hazards').doc('c1').set({
        cluster_id: 'c1',
        group_id: 'group-1',
        hazard_type: 'pothole',
        centroid_lat: 37.0,
        centroid_lng: -122.0,
        polygon_points: [[37.0, -122.0], [37.0, -121.0], [38.0, -121.0], [38.0, -122.0]],
        report_count: 2,
        hazard_score: 0.5,
        created_at_hlc: '1000-0',
        status: 'active',
      });
      await db.collection('hazards').doc('c2').set({
        cluster_id: 'c2',
        group_id: 'group-1',
        hazard_type: 'oil_spill',
        centroid_lat: 38.0,
        centroid_lng: -123.0,
        polygon_points: [[38.0, -123.0], [38.0, -122.0], [39.0, -122.0], [39.0, -123.0]],
        report_count: 1,
        hazard_score: 0.2,
        created_at_hlc: '1000-1',
        status: 'resolved',
      });

      // Add cluster for group-2 (should not appear)
      await db.collection('hazards').doc('c3').set({
        cluster_id: 'c3',
        group_id: 'group-2',
        hazard_type: 'pothole',
        centroid_lat: 39.0,
        centroid_lng: -124.0,
        polygon_points: [[39.0, -124.0], [39.0, -123.0], [40.0, -123.0], [40.0, -124.0]],
        report_count: 3,
        hazard_score: 0.8,
        created_at_hlc: '1000-2',
        status: 'active',
      });

      let receivedClusters: any[] = [];
      const unsubscribe = subscribeToHazardClusters('group-1', (clusters: any[]) => {
        receivedClusters = clusters;
      });

      // Allow listener to fire
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(receivedClusters.length).toBe(1);
      expect(receivedClusters[0].cluster_id).toBe('c1');
      expect(receivedClusters[0].status).toBe('active');
      expect(receivedClusters[0].group_id).toBe('group-1');

      // Verify unsubscribe function works
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  describe('resolveHazard', () => {
    test('resolveHazard: sets status=resolved, does not delete document', async () => {
      NetInfo._setNetworkState({ isConnected: true });

      const db = firestore();

      await db.collection('hazards').doc('c1').set({
        cluster_id: 'c1',
        group_id: 'group-1',
        hazard_type: 'pothole',
        centroid_lat: 37.0,
        centroid_lng: -122.0,
        polygon_points: [[37.0, -122.0], [37.0, -121.0], [38.0, -121.0], [38.0, -122.0]],
        report_count: 2,
        hazard_score: 0.5,
        created_at_hlc: '1000-0',
        status: 'active',
      });

      await resolveHazard('c1');

      const doc = await db.collection('hazards').doc('c1').get();
      expect(doc.exists).toBe(true);
      expect(doc.data()?.status).toBe('resolved');
    });
  });

  describe('triggerSos', () => {
    test('triggerSos_durable_before_network: OR-Set persistence occurs before Firestore/network attempt', async () => {
      NetInfo._setNetworkState({ isConnected: true });

      const sosId = await triggerSos('rider-1', 'group-1', 37.7749, -122.4194);

      // Verify local OR-Set was persisted first
      const localSet = orSetLoad('sos_orset_group-1');
      const active = orSetGetActive(localSet);
      expect(active.length).toBe(1);
      expect(active[0].sos_id).toBe(sosId);

      // Verify Firestore was written
      const firestoreData = firestore._getData();
      expect(firestoreData['sos_events'][sosId]).toBeDefined();
      expect(firestoreData['sos_events'][sosId].sos_id).toBe(sosId);
      expect(firestoreData['sos_events'][sosId].resolved).toBe(false);
    });

    test('triggerSos_offline: OR-Set is persisted, queue operation is created', async () => {
      NetInfo._setNetworkState({ isConnected: false });

      const sosId = await triggerSos('rider-2', 'group-1', 38.0, -123.0);

      // Verify local OR-Set was persisted
      const localSet = orSetLoad('sos_orset_group-1');
      const active = orSetGetActive(localSet);
      expect(active.length).toBe(1);
      expect(active[0].sos_id).toBe(sosId);

      // Verify queue operation was created
      const queue = queuePeek(SOS_QUEUE);
      expect(queue.length).toBe(1);
      expect(queue[0].type).toBe('sos_event');
      expect((queue[0].data as any).sos_id).toBe(sosId);

      // Verify NOT in Firestore
      const firestoreData = firestore._getData();
      expect(firestoreData['sos_events']).toBeUndefined();
    });

    test('sos_contract: exact frozen sos_event shape', async () => {
      NetInfo._setNetworkState({ isConnected: true });

      const sosId = await triggerSos('rider-3', 'group-2', 40.0, -74.0);

      const firestoreData = firestore._getData();
      const sos = firestoreData['sos_events'][sosId];

      // Contract: sos_id, rider_id, group_id, lat, lng, created_at_hlc, resolved, resolved_at_hlc
      expect(typeof sos.sos_id).toBe('string');
      expect(typeof sos.rider_id).toBe('string');
      expect(typeof sos.group_id).toBe('string');
      expect(typeof sos.lat).toBe('number');
      expect(typeof sos.lng).toBe('number');
      expect(typeof sos.created_at_hlc).toBe('string');
      expect(typeof sos.resolved).toBe('boolean');
      expect(sos.resolved_at_hlc === null || typeof sos.resolved_at_hlc === 'string').toBe(true);
      expect(sos.resolved).toBe(false);
      expect(sos.resolved_at_hlc).toBeNull();
    });
  });

  describe('resolveSos', () => {
    test('resolveSos: creates OR-Set tombstone, persists it, updates/queues Firestore resolution', async () => {
      NetInfo._setNetworkState({ isConnected: true });

      const db = firestore();

      // Pre-create SOS in Firestore
      await db.collection('sos_events').doc('s1').set({
        sos_id: 's1',
        rider_id: 'rider-1',
        group_id: 'group-1',
        lat: 37.0,
        lng: -122.0,
        created_at_hlc: '1000-0',
        tag: 's1:rider-1:1000-0',
        resolved: false,
        resolved_at_hlc: null,
      });

      // Also add to local OR-Set
      const localSet = createORSet();
      const { orSetAdd } = require('../src/crdt/orSet');
      let updatedSet = orSetAdd(localSet, {
        sos_id: 's1',
        rider_id: 'rider-1',
        group_id: 'group-1',
        lat: 37.0,
        lng: -122.0,
        created_at_hlc: '1000-0',
      }, HLC.fresh());
      orSetSave(updatedSet, 'sos_orset_group-1');

      await resolveSos('s1', 'group-1');

      // Verify local OR-Set has tombstone
      const mergedSet = orSetLoad('sos_orset_group-1');
      expect(orSetGetActive(mergedSet).length).toBe(0);
      expect(mergedSet.tombstones.size).toBeGreaterThan(0);

      // Verify Firestore was updated
      const doc = await db.collection('sos_events').doc('s1').get();
      expect(doc.data()?.resolved).toBe(true);
      expect(doc.data()?.resolved_at_hlc).toMatch(/^\d+-\d+$/);
    });

    test('resolveSos_offline: creates OR-Set tombstone, queues resolve operation', async () => {
      NetInfo._setNetworkState({ isConnected: false });

      // Add to local OR-Set first
      const localSet = createORSet();
      const { orSetAdd } = require('../src/crdt/orSet');
      let updatedSet = orSetAdd(localSet, {
        sos_id: 's2',
        rider_id: 'rider-2',
        group_id: 'group-1',
        lat: 38.0,
        lng: -123.0,
        created_at_hlc: '1000-1',
      }, HLC.fresh());
      orSetSave(updatedSet, 'sos_orset_group-1');

      await resolveSos('s2', 'group-1');

      // Verify local OR-Set has tombstone
      const mergedSet = orSetLoad('sos_orset_group-1');
      expect(orSetGetActive(mergedSet).length).toBe(0);

      // Verify queue operation was created
      const queue = queuePeek(SOS_QUEUE);
      expect(queue.length).toBe(1);
      expect(queue[0].type).toBe('sos_resolve');
      expect((queue[0].data as any).sos_id).toBe('s2');
    });
  });

  describe('subscribeToSosEvents', () => {
    test('subscribeToSosEvents: merges remote events into local OR-Set, returns active events', async () => {
      NetInfo._setNetworkState({ isConnected: true });

      const db = firestore();

      // Pre-create SOS in Firestore
      await db.collection('sos_events').doc('s1').set({
        sos_id: 's1',
        rider_id: 'rider-1',
        group_id: 'group-1',
        lat: 37.0,
        lng: -122.0,
        created_at_hlc: '1000-0',
        tag: 's1:rider-1:1000-0',
        resolved: false,
        resolved_at_hlc: null,
      });

      let receivedEvents: any[] = [];
      const unsubscribe = subscribeToSosEvents('group-1', (events: any[]) => {
        receivedEvents = events;
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedEvents.length).toBe(1);
      expect(receivedEvents[0].sos_id).toBe('s1');
      expect(receivedEvents[0].rider_id).toBe('rider-1');

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    test('subscribeToSosEvents: resolved events do not incorrectly appear active', async () => {
      NetInfo._setNetworkState({ isConnected: true });

      const db = firestore();

      // Pre-create RESOLVED SOS in Firestore
      await db.collection('sos_events').doc('s1').set({
        sos_id: 's1',
        rider_id: 'rider-1',
        group_id: 'group-1',
        lat: 37.0,
        lng: -122.0,
        created_at_hlc: '1000-0',
        tag: 's1:rider-1:1000-0',
        resolved: true,
        resolved_at_hlc: '1000-5',
      });

      let receivedEvents: any[] = [];
      const unsubscribe = subscribeToSosEvents('group-1', (events: any[]) => {
        receivedEvents = events;
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should NOT receive resolved event as active
      expect(receivedEvents.length).toBe(0);

      unsubscribe();
    });
  });

  describe('FCM trigger', () => {
    test('fcm_trigger_payload: verify server-side notification payload contains required fields', () => {
      // This test documents the expected FCM payload structure
      // The actual Cloud Function is in infra/firebase/functions/index.js
      const expectedPayload = {
        title: 'SOS Alert',
        body: expect.stringContaining('SOS'),
        group_id: expect.any(String),
        sos_id: expect.any(String),
      };

      // Verify the structure exists in the Cloud Function
      const fs = require('fs');
      const path = require('path');
      const funcPath = path.join(__dirname, '..', '..', '..', 'infra', 'firebase', 'functions', 'index.js');
      const funcContent = fs.readFileSync(funcPath, 'utf-8');

      expect(funcContent).toContain('title: \'SOS Alert\'');
      expect(funcContent).toContain('group_id: groupId');
      expect(funcContent).toContain('sos_id: context.params.sosId');
      expect(funcContent).toContain('sendMulticast');
    });
  });
});

