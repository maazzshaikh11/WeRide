import { dbscanByType, HLC, OrSet, SosEvent } from '../src/index';

describe('DBSCAN', () => {
  const mk = (id: string, type: any, lat: number, lng: number): any => ({
    reportId: id, riderId: 'r', groupId: 'g', hazardType: type, lat, lng, timestampHlc: '1:0', reportedAtHlc: '1:0',
  });

  test('clusters nearby reports of same type', () => {
    const reports = [mk('1', 'pothole', 12.0, 34.0), mk('2', 'pothole', 12.0001, 34.0001), mk('3', 'pothole', 12.0002, 34.0002)];
    const clusters = dbscanByType(reports, { epsMeters: 30, minSamples: 2, newClusterId: () => 'c1' });
    expect(clusters.length).toBe(1);
    expect(clusters[0].reportCount).toBe(3);
  });

  test('separates by hazard_type (pothole vs oil_spill 10m apart)', () => {
    const reports = [mk('1', 'pothole', 12.0, 34.0), mk('2', 'oil_spill', 12.00005, 34.00005)];
    const clusters = dbscanByType(reports, { epsMeters: 30, minSamples: 1, newClusterId: () => 'c' });
    expect(clusters.length).toBe(2);
  });

  test('noise report published as single-report cluster', () => {
    const reports = [mk('1', 'pothole', 12.0, 34.0), mk('2', 'pothole', 13.0, 35.0)];
    const clusters = dbscanByType(reports, { epsMeters: 30, minSamples: 2, newClusterId: () => 'c' });
    expect(clusters.length).toBe(2);
    expect(clusters.every((c) => c.reportCount === 1)).toBe(true);
  });

  test('boundary reports cluster together (no edge-split)', () => {
    const reports = [mk('1', 'pothole', 12.0, 34.0), mk('2', 'pothole', 12.00015, 34.0), mk('3', 'pothole', 12.0003, 34.0)];
    const clusters = dbscanByType(reports, { epsMeters: 25, minSamples: 2, newClusterId: () => 'c' });
    expect(clusters.length).toBe(1);
    expect(clusters[0].reportCount).toBe(3);
  });
});

describe('HLC', () => {
  let mockTime = 1000;
  const hlc = new HLC({ physical: 1000, counter: 0 }, () => mockTime);

  test('now increments counter when physical unchanged', () => {
    hlc.now();
    hlc.now();
    expect(hlc.now()).toBe('1000:3');
  });

  test('physical advances with wall clock', () => {
    mockTime = 2000;
    expect(hlc.now()).toBe('2000:0');
  });

  test('receive merges remote timestamp', () => {
    const result = hlc.receive('3000:5');
    expect(hlc.physical).toBe(3000);
  });

  test('ordering compares correctly', () => {
    expect(HLC.compare('1000:0', '1000:1')).toBeLessThan(0);
    expect(HLC.compare('2000:0', '1000:5')).toBeGreaterThan(0);
    expect(HLC.compare('1000:3', '1000:3')).toBe(0);
  });
});

describe('OR-Set CRDT', () => {
  test('add and query active', () => {
    const set = new OrSet();
    set.add({ sosId: 's1', riderId: 'a', groupId: 'g', lat: 0, lng: 0, createdAtHlc: '1:0', resolved: false, resolvedAtHlc: null } as SosEvent);
    expect(set.active.length).toBe(1);
    expect(set.contains('s1')).toBe(true);
  });

  test('resolve adds tombstone', () => {
    const set = new OrSet();
    set.add({ sosId: 's1', riderId: 'a', groupId: 'g', lat: 0, lng: 0, createdAtHlc: '1:0', resolved: false, resolvedAtHlc: null } as SosEvent);
    set.resolve('s1', '2:0');
    expect(set.active.length).toBe(0);
    expect(set.all.length).toBe(1);
    expect(set.all[0].resolved).toBe(true);
  });

  test('merge converges two clients', () => {
    const a = new OrSet();
    const b = new OrSet();
    a.add({ sosId: 's1', riderId: 'a', groupId: 'g', lat: 0, lng: 0, createdAtHlc: '1:0', resolved: false, resolvedAtHlc: null } as SosEvent);
    b.add({ sosId: 's2', riderId: 'b', groupId: 'g', lat: 1, lng: 1, createdAtHlc: '1:1', resolved: false, resolvedAtHlc: null } as SosEvent);
    a.merge(b);
    b.merge(a);
    expect(a.active.length).toBe(1); // only s2 active after merge
    expect(b.active.length).toBe(1);
  });
});