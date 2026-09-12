import { performance } from 'node:perf_hooks';

const store: Record<string, string> = {};

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    getString: (key: string) => store[key] ?? null,
    set: (key: string, value: string) => { store[key] = value; },
    remove: (key: string) => { delete store[key]; },
    clearAll: () => Object.keys(store).forEach((key) => delete store[key]),
  })),
}));

import { dbscan, type HazardReport } from '../src/dbscan/dbscan';
import { HLC } from '../src/hlc/hlc';
import { createORSet, orSetAddWithTag, orSetMerge } from '../src/crdt/orSet';

describe('deterministic standalone performance checks', () => {
  beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
    HLC._resetStorage();
  });

  test('meets the Phase 8 local performance targets', () => {
    const reports: HazardReport[] = Array.from({ length: 100 }, (_, index) => ({
      report_id: `report-${index}`,
      rider_id: `rider-${index % 4}`,
      group_id: 'demo-group-b',
      hazard_type: index % 2 === 0 ? 'pothole' : 'oil_spill',
      lat: 12.9716 + (index % 10) * 0.00002,
      lng: 77.5946 + Math.floor(index / 10) * 0.00002,
      timestamp_hlc: '1700000000000-0',
      reported_at_hlc: '1700000000000-0',
    }));

    const dbscanStart = performance.now();
    dbscan(reports, 30, 2);
    const dbscanMs = performance.now() - dbscanStart;

    const clock = HLC.fresh(() => 1700000000000);
    const timestampStart = performance.now();
    for (let index = 0; index < 10_000; index++) clock.now();
    const hlcPerTimestampMs = (performance.now() - timestampStart) / 10_000;

    let left = createORSet();
    let right = createORSet();
    for (let index = 0; index < 100; index++) {
      const element = {
        sos_id: `sos-${index}`,
        rider_id: `rider-${index % 4}`,
        group_id: 'demo-group-b',
        lat: 12.9716,
        lng: 77.5946,
        created_at_hlc: `1700000000000-${index}`,
      };
      if (index % 2 === 0) left = orSetAddWithTag(left, element, `tag-${index}`);
      else right = orSetAddWithTag(right, element, `tag-${index}`);
    }
    const mergeStart = performance.now();
    orSetMerge(left, right);
    const mergeMs = performance.now() - mergeStart;

    console.info(
      `[performance] dbscan100=${dbscanMs.toFixed(3)}ms; ` +
      `hlc=${hlcPerTimestampMs.toFixed(6)}ms/timestamp; ` +
      `orsetMerge100=${mergeMs.toFixed(3)}ms`,
    );
    expect(dbscanMs).toBeLessThan(500);
    expect(hlcPerTimestampMs).toBeLessThan(1);
    expect(mergeMs).toBeLessThan(100);
  });
});
