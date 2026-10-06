/**
 * Live-screen maths: the label beside the avatar and the status plate are
 * derived from real verified fixes only — and say nothing when there is nothing to measure.
 */
import { GAP_THRESHOLD_M, formatGap, freshRiders, groupSpreadM, liveStatus, nearestRider, staleRider } from '../src/screens/map/live/liveGeometry';
import type { RiderEntry } from '../src/store/ridersStore';
import { haversineMeters } from '../src/utils/geoUtils';

const ORIGIN = { lat: 18.52, lng: 73.85 };
/** A point `m` metres due north of ORIGIN (1° latitude ≈ 111,195 m). */
const north = (m: number) => ({ lat: ORIGIN.lat + m / 111195, lng: ORIGIN.lng });

function rider(id: string, at: { lat: number; lng: number }, markerState: RiderEntry['markerState'] = 'GREEN'): RiderEntry {
  return {
    markerState,
    receivedAt: 0,
    location: {
      rider_id: id, group_id: 'g', timestamp_hlc: '1:0', lat: at.lat, lng: at.lng,
      speed_mps: 10, heading_deg: 0, spoof_flag: markerState === 'RED', nis_score: 1, accuracy_m: 5,
    },
  };
}
const map = (...rs: RiderEntry[]) => new Map(rs.map((r) => [r.location.rider_id, r]));

describe('formatGap', () => {
  it.each([
    [4, '<10m'],
    [10, '10m'],
    [96, '100m'],
    [104, '100m'],
    [455, '460m'],
    [999.4, '1.0km'],
    [1000, '1.0km'],
    [1234, '1.2km'],
    [15600, '15.6km'],
  ])('%d m -> %s', (m, label) => expect(formatGap(m)).toBe(label));

  it('is empty for nonsense', () => {
    expect(formatGap(NaN)).toBe('');
    expect(formatGap(-5)).toBe('');
  });
});

describe('freshRiders', () => {
  it('keeps only fresh verified crew members and never the rider themself', () => {
    const riders = map(rider('me', north(0)), rider('a', north(50)), rider('b', north(80), 'GREY'), rider('c', north(90), 'RED'));
    expect(freshRiders(riders, 'me').map((r) => r.location.rider_id)).toEqual(['a']);
  });

  it('drops riders with a non-finite position', () => {
    const bad = rider('x', { lat: NaN, lng: 1 });
    expect(freshRiders(map(bad), 'me')).toHaveLength(0);
  });
});

describe('nearestRider', () => {
  it('measures to the closest of several riders, in real metres', () => {
    const others = [rider('far', north(900)), rider('near', north(100)), rider('mid', north(400))];
    const n = nearestRider(ORIGIN, others)!;
    expect(n.riderId).toBe('near');
    expect(n.distanceM).toBeCloseTo(100, 0);
    expect(n.distanceM).toBeCloseTo(haversineMeters(ORIGIN.lat, ORIGIN.lng, north(100).lat, north(100).lng), 3);
  });

  it('updates as the avatar moves: closing from 300 m to 100 m changes the label', () => {
    const others = [rider('a', north(300))];
    expect(formatGap(nearestRider(ORIGIN, others)!.distanceM)).toBe('300m');
    expect(formatGap(nearestRider(north(200), others)!.distanceM)).toBe('100m');
  });

  it('is null with nobody to measure against or no own fix — never a made-up number', () => {
    expect(nearestRider(ORIGIN, [])).toBeNull();
    expect(nearestRider(null, [rider('a', north(10))])).toBeNull();
    expect(nearestRider({ lat: NaN, lng: 0 }, [rider('a', north(10))])).toBeNull();
  });
});

describe('groupSpreadM', () => {
  it('is the largest pairwise distance', () => {
    expect(groupSpreadM([ORIGIN, north(100), north(450)])).toBeCloseTo(450, 0);
    expect(groupSpreadM([ORIGIN])).toBe(0);
    expect(groupSpreadM([])).toBe(0);
  });
});

describe('liveStatus', () => {
  const base = { own: ORIGIN, others: [] as RiderEntry[], signalLost: false, sosFrom: null as string | null };

  it('SOS beats everything', () => {
    const s = liveStatus({ ...base, signalLost: true, sosFrom: 'abcd1234' });
    expect(s).toMatchObject({ key: 'sos', tone: 'red', title: 'SOS', subtitle: 'Rider 1234 needs help' });
  });

  it('signal lost is yellow and says the SOS still works', () => {
    const s = liveStatus({ ...base, signalLost: true });
    expect(s).toMatchObject({ key: 'no-signal', tone: 'yellow' });
    expect(s.subtitle).toContain('SOS still works');
  });

  it('no fix yet -> white "Finding you"', () => {
    expect(liveStatus({ ...base, own: null })).toMatchObject({ key: 'no-fix', tone: 'white' });
  });

  it('alone -> "Riding solo", not "All together"', () => {
    expect(liveStatus(base)).toMatchObject({ key: 'solo', tone: 'white', title: 'Riding solo' });
  });

  it('everyone within the threshold -> green with the real count and spread', () => {
    const s = liveStatus({ ...base, others: [rider('a', north(120)), rider('b', north(300))] });
    expect(s).toMatchObject({ key: 'together', tone: 'green', title: 'All together' });
    expect(s.subtitle).toBe('3 riders · 300 m spread');
  });

  it(`past ${GAP_THRESHOLD_M} m -> yellow gap naming the farthest rider and its distance`, () => {
    const s = liveStatus({ ...base, others: [rider('a', north(100)), rider('zz99', north(1500))] });
    expect(s).toMatchObject({ key: 'gap', tone: 'yellow', title: 'Gap' });
    expect(s.subtitle).toBe('Rider zz99 is 1.5 km away');
  });

  it('exactly at the threshold is still together', () => {
    expect(liveStatus({ ...base, others: [rider('a', north(GAP_THRESHOLD_M - 1))] }).key).toBe('together');
  });
});

describe('liveStatus: the demo plate states', () => {
  const base = { own: ORIGIN, others: [rider('a', north(100))] as RiderEntry[], signalLost: false, sosFrom: null as string | null };
  const hazard = { id: 'h', name: 'Pothole', distanceM: 384, reportCount: 2 };
  const signal = { name: 'Meera', label: 'Wait for me' };
  const stop = { name: 'Chai Point', distanceM: 596 };
  const stale = { name: 'Ishan', ageS: 14.2 };

  it('hazard ahead: yellow "POTHOLE · 380 m" with the report count and "ease off"', () => {
    expect(liveStatus({ ...base, hazard })).toMatchObject({ key: 'hazard', tone: 'yellow', icon: 'haz', title: 'Pothole · 380 m', subtitle: 'Reported by 2 riders · ease off' });
    expect(liveStatus({ ...base, hazard: { ...hazard, reportCount: 1 } }).subtitle).toBe('Reported by a rider · ease off');
  });
  it('hazard distance follows the units pref', () => {
    expect(liveStatus({ ...base, hazard, units: 'mi' }).title).toMatch(/^Pothole · 0\.2 mi$/);
  });
  it('signal from the crew: yellow, "Meera · Wait for me"; All good is green', () => {
    expect(liveStatus({ ...base, signal })).toMatchObject({ key: 'signal', tone: 'yellow', icon: 'signal', title: 'Meera · Wait for me', subtitle: 'Signal from the crew' });
    expect(liveStatus({ ...base, signal: { name: 'Dev', label: 'All good' } }).tone).toBe('green');
  });
  it('stop ahead: blue plate "Chai Point · 600 m" / "Pull in together"', () => {
    expect(liveStatus({ ...base, stop })).toMatchObject({ key: 'stop-ahead', tone: 'blue', icon: 'cup', title: 'Chai Point · 600 m', subtitle: 'Pull in together' });
  });
  it('rider no signal: "Ishan · No signal", last seen N s ago', () => {
    expect(liveStatus({ ...base, staleRider: stale })).toMatchObject({ key: 'rider-no-signal', tone: 'yellow', icon: 'wifioff', title: 'Ishan · No signal', subtitle: 'Last seen 14 s ago · position held' });
  });
  it('rider no signal beats "riding solo" (their marker is grey so nobody is fresh)', () => {
    expect(liveStatus({ ...base, others: [], staleRider: stale }).key).toBe('rider-no-signal');
  });
  it('uses real names when given, "Rider 1234" otherwise', () => {
    expect(liveStatus({ ...base, sosFrom: 'abcd1234', nameOf: () => 'Kabir' }).subtitle).toBe('Kabir needs help');
    const far = liveStatus({ ...base, others: [rider('a', north(100)), rider('zz99', north(1500))], nameOf: (id) => (id === 'zz99' ? 'Zoya' : id) });
    expect(far.subtitle).toBe('Zoya is 1.5 km away');
  });
  it('priority: SOS > no signal > finding you > hazard > signal > stop ahead > rider no signal > gap > together', () => {
    const all = { ...base, hazard, signal, stop, staleRider: stale, others: [rider('a', north(100)), rider('b', north(2000))] };
    expect(liveStatus({ ...all, sosFrom: 'x', signalLost: true }).key).toBe('sos');
    expect(liveStatus({ ...all, signalLost: true }).key).toBe('no-signal');
    expect(liveStatus({ ...all, own: null }).key).toBe('no-fix');
    expect(liveStatus(all).key).toBe('hazard');
    expect(liveStatus({ ...all, hazard: null }).key).toBe('signal');
    expect(liveStatus({ ...all, hazard: null, signal: null }).key).toBe('stop-ahead');
    expect(liveStatus({ ...all, hazard: null, signal: null, stop: null }).key).toBe('rider-no-signal');
    expect(liveStatus({ ...all, hazard: null, signal: null, stop: null, staleRider: null }).key).toBe('gap');
  });
});

describe('staleRider', () => {
  const now = 1_000_000_000_000;
  const grey = (id: string, ageMs: number) => {
    const r = rider(id, ORIGIN, 'GREY');
    r.location.timestamp_hlc = `${now - ageMs}:0`;
    return r;
  };
  it('picks the most recently lost rider, never yourself, ignores very old ones', () => {
    const m = map(grey('a', 14000), grey('b', 40000), grey('me', 12000), grey('gone', 3600_000));
    expect(staleRider(m, 'me', now)).toEqual({ riderId: 'a', ageS: 14 });
    expect(staleRider(map(grey('gone', 3600_000)), 'me', now)).toBeNull();
    expect(staleRider(map(rider('ok', ORIGIN)), 'me', now)).toBeNull();
  });
});
