import { HLC } from '../src/hlc/hlc';
import { clusterByType, HazardReport } from '../src/dbscan/dbscan';
import { createORSet, orSetMerge, orSetAddWithTag } from '../src/crdt/orSet';
import { jest } from '@jest/globals';

jest.mock('react-native-mmkv', () => {
  return {
    MMKV: jest.fn().mockImplementation((config: unknown) => {
      const { id: _id } = config as { id: string };
      return {
        getString: jest.fn(() => null),
        set: jest.fn(),
        clearAll: jest.fn(),
      };
    }),
  };
});

describe('Phase 7 Integration Tests', () => {

  describe('DBSCAN edge cases', () => {
    it('Two reports close to boundary form ONE cluster, not two', () => {
      const reports: HazardReport[] = [
        { report_id: 'r1', rider_id: 'u1', group_id: 'g1', hazard_type: 'pothole', lat: 0, lng: 0, timestamp_hlc: '0', reported_at_hlc: '0' },
        { report_id: 'r2', rider_id: 'u2', group_id: 'g1', hazard_type: 'pothole', lat: 0.00025, lng: 0, timestamp_hlc: '0', reported_at_hlc: '0' },
      ];
      // 0.00025 degrees is ~27.8 meters, which is within the 30m eps boundary.
      const clusters = clusterByType(reports, 30, 2);
      expect(clusters.length).toBe(1);
      expect(clusters[0].reports.length).toBe(2);
    });

    it('One isolated report is NOT discarded, published as single-report hazard', () => {
      const reports: HazardReport[] = [
        { report_id: 'r1', rider_id: 'u1', group_id: 'g1', hazard_type: 'pothole', lat: 0, lng: 0, timestamp_hlc: '0', reported_at_hlc: '0' }
      ];
      const clusters = clusterByType(reports, 30, 2);
      expect(clusters.length).toBe(1);
      expect(clusters[0].reports.length).toBe(1);
    });

    it('Different hazard types at same location remain separate clusters', () => {
      const reports: HazardReport[] = [
        { report_id: 'r1', rider_id: 'u1', group_id: 'g1', hazard_type: 'pothole', lat: 0, lng: 0, timestamp_hlc: '0', reported_at_hlc: '0' },
        { report_id: 'r2', rider_id: 'u2', group_id: 'g1', hazard_type: 'oil_spill', lat: 0, lng: 0, timestamp_hlc: '0', reported_at_hlc: '0' },
      ];
      const clusters = clusterByType(reports, 30, 2);
      expect(clusters.length).toBe(2);
      expect(clusters[0].reports.length).toBe(1);
      expect(clusters[1].reports.length).toBe(1);
    });
  });

  describe('CRDT Merge Convergence', () => {
    it('Merge is commutative and idempotent', () => {
      let setA = createORSet();
      let setB = createORSet();

      setA = orSetAddWithTag(setA, { sos_id: 's1', rider_id: 'u1', group_id: 'g1', lat: 0, lng: 0, created_at_hlc: '1' }, 'tag1');
      setB = orSetAddWithTag(setB, { sos_id: 's2', rider_id: 'u2', group_id: 'g1', lat: 0, lng: 0, created_at_hlc: '2' }, 'tag2');

      const mergedAB = orSetMerge(setA, setB);
      const mergedBA = orSetMerge(setB, setA);

      expect(mergedAB.adds.size).toBe(2);
      expect(mergedAB.adds).toEqual(mergedBA.adds);

      const mergedABA = orSetMerge(mergedAB, setA);
      expect(mergedABA.adds.size).toBe(2);
    });
  });

  describe('HLC Ordering', () => {
    it('HLC timestamps remain valid and compare correctly', () => {
      const hlc = HLC.fresh();
      const t1 = hlc.now();
      hlc.receive(t1);
      const t2 = hlc.now();
      
      expect(HLC.compare(t1, t2)).toBe(-1);
    });
  });
});
