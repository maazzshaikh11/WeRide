import { countdownLabel, everyoneReady, memberStatus, presenceLabel, readyChecks, readySet } from '../src/screens/road/parts/rollCall';
import { breakClock, nextLeg, shouldRoll } from '../src/screens/road/parts/leg';
import { buildMembers, leadDisplayName, leadUid } from '../src/screens/road/parts/members';

const MEET = { lat: 19.0, lng: 72.8 };
const north = (m: number) => ({ lat: MEET.lat + m / 111320, lng: MEET.lng });

describe('roll-call tile status', () => {
  it('ready wins', () => {
    expect(memberStatus({ ready: true, fix: null, meetup: MEET })).toMatchObject({ label: '✓ ready', ready: true });
  });
  it('at meetup = within 150 m of the meetup point', () => {
    expect(memberStatus({ ready: false, fix: north(120), meetup: MEET })).toMatchObject({ label: 'at meetup', kind: 'here' });
    expect(memberStatus({ ready: false, fix: { ...north(160), speed_mps: 0 }, meetup: MEET }).kind).toBe('none');
  });
  it('in N min = distance / that rider’s speed, only above 2 m/s (rounded up, at least 1)', () => {
    expect(memberStatus({ ready: false, fix: { ...north(1200), speed_mps: 10 }, meetup: MEET }).label).toBe('in 2 min');
    expect(memberStatus({ ready: false, fix: { ...north(200), speed_mps: 10 }, meetup: MEET }).label).toBe('in 1 min');
    expect(memberStatus({ ready: false, fix: { ...north(1200), speed_mps: 2 }, meetup: MEET }).label).toBe('no signal yet');
    expect(memberStatus({ ready: false, fix: { ...north(1200), speed_mps: NaN }, meetup: MEET }).label).toBe('no signal yet');
  });
  it('no fix or no meetup point -> "no signal yet", never a guess', () => {
    expect(memberStatus({ ready: false, fix: null, meetup: MEET }).label).toBe('no signal yet');
    expect(memberStatus({ ready: false, fix: north(10), meetup: null }).label).toBe('no signal yet');
  });
});

describe('ready set / everyone ready', () => {
  const docs = [{ uid: 'a', state: 'ready' as const, updated_ms: 1 }, { uid: 'b', state: 'notready' as const, updated_ms: 1 }];
  it('counts only `ready`', () => {
    const r = readySet(docs);
    expect([...r]).toEqual(['a']);
    expect(everyoneReady(['a', 'b'], r)).toBe(false);
    expect(everyoneReady(['a'], r)).toBe(true);
    expect(everyoneReady([], r)).toBe(false);
  });
});

describe('ready checks come from real state', () => {
  it('all good', () => {
    const c = readyChecks({ accuracyM: 6, locationGranted: true, contacts: 1, voiceLive: true });
    expect(c.every((x) => x.ok)).toBe(true);
    expect(c.map((x) => x.label)).toEqual(['GPS precise', 'Always-on location', 'SOS contact set', 'Voice channel on']);
  });
  it('warns, with honest labels', () => {
    const c = readyChecks({ accuracyM: 25, locationGranted: false, contacts: 0, voiceLive: false });
    expect(c.every((x) => !x.ok)).toBe(true);
    expect(c.map((x) => x.label)).toEqual(['GPS rough', 'Location not always on', 'No SOS contact', 'Voice channel off']);
    expect(readyChecks({ accuracyM: null, locationGranted: true, contacts: 1, voiceLive: false })[0].label).toBe('Finding GPS');
  });
  it('has no battery chip and nothing about family sharing', () => {
    const labels = readyChecks({ accuracyM: 5, locationGranted: true, contacts: 1, voiceLive: true }).map((c) => c.label.toLowerCase());
    expect(labels.some((l) => /battery|family/.test(l))).toBe(false);
  });
  it('GPS precise is exactly <= 10 m', () => {
    expect(readyChecks({ accuracyM: 10, locationGranted: true, contacts: 1, voiceLive: true })[0].ok).toBe(true);
    expect(readyChecks({ accuracyM: 10.1, locationGranted: true, contacts: 1, voiceLive: true })[0].ok).toBe(false);
  });
});

describe('countdown pill', () => {
  const at = new Date(2026, 9, 18, 6, 30).getTime();
  it('shows the time and the countdown', () => {
    expect(countdownLabel(at, at - 49 * 60000)).toBe('6:30 ∙ IN 49 MIN');
    expect(countdownLabel(at, at - 125 * 60000)).toBe('6:30 ∙ IN 2H 05');
    expect(countdownLabel(at, at)).toBe('6:30 ∙ NOW');
    expect(countdownLabel(at, at + 7 * 60000)).toBe('6:30 ∙ 7 MIN AGO');
    expect(countdownLabel(null, 0)).toBeNull();
  });
});

describe('presence labels (Stop / Arrive)', () => {
  it('maps presence to the demo words', () => {
    expect(presenceLabel('ready')).toEqual({ label: '✓ ready', ready: true });
    expect(presenceLabel('fuel').label).toBe('fuelling');
    expect(presenceLabel('stopped').label).toBe('on a break');
    expect(presenceLabel('riding').label).toBe('pulling in');
    expect(presenceLabel(undefined, true).label).toBe('on a break');
    expect(presenceLabel(undefined).label).toBe('pulling in');
  });
});

describe('members', () => {
  const byId = { m: { uid: 'm', name: 'Meera Rao', bike: '', style: 'Steady', stats: { km: 0, rides: 0, together_sum: 0 } } } as any;
  const ride = { created_by: 'm', member_ids: ['k', 'm', 'me'] };
  it('you first, lead from the crew role else the creator, sweep from roles', () => {
    const crew = { roles: { m: 'lead', k: 'sweep' } } as any;
    const ms = buildMembers(ride, crew, byId, 'me');
    expect(ms.map((x) => x.uid)).toEqual(['me', 'k', 'm']);
    expect(ms.find((x) => x.uid === 'm')).toMatchObject({ name: 'Meera Rao', initials: 'MR', role: 'Lead' });
    expect(ms.find((x) => x.uid === 'k')!.role).toBe('Sweep');
    expect(ms[0]).toMatchObject({ name: 'You', me: true });
    expect(leadUid(ride, null)).toBe('m');
    expect(leadUid(ride, { roles: { k: 'lead' } } as any)).toBe('k');
  });
  it('lead display name is the first name in capitals', () => {
    expect(leadDisplayName('m', byId, 'me')).toBe('MEERA');
    expect(leadDisplayName('zz', byId, 'me')).toBeNull();
    expect(leadDisplayName(null, byId, 'me')).toBeNull();
  });
});

describe('Next leg + break rules', () => {
  const path = [0, 2000, 4000].map((m) => [north(m).lat, north(m).lng]);
  const stop = { id: 's', name: 'Chai Point', ...north(1000) };
  it('names the next unvisited planned stop with its share of the real distance / time', () => {
    const leg = nextLeg({ routePath: path, distanceKm: 4, etaMinutes: 40, own: north(0), stops: [stop], visited: new Set(), destinationName: 'Lonavala', clusters: [] })!;
    expect(leg.name).toBe('Chai Point');
    expect(leg.km).toBeCloseTo(1, 1);
    expect(leg.minutes).toBeCloseTo(10, 0);
  });
  it('after the stop (visited) it is the destination with what is left, and counts hazards on the leg', () => {
    const cl = { cluster_id: 'h', hazard_type: 'pothole', centroid_lat: north(2500).lat, centroid_lng: north(2500).lng, report_count: 2, status: 'active' };
    const leg = nextLeg({ routePath: path, distanceKm: 3, etaMinutes: 30, own: north(1000), stops: [stop], visited: new Set(['s']), destinationName: 'Lonavala', clusters: [cl] })!;
    expect(leg).toMatchObject({ name: 'Lonavala', hazards: 1 });
    expect(leg.km).toBeCloseTo(3, 1);
  });
  it('unknown route -> only the name, no invented numbers; no destination -> no card', () => {
    const leg = nextLeg({ routePath: null, distanceKm: null, etaMinutes: null, own: null, stops: [], visited: new Set(), destinationName: 'Lonavala', clusters: [] })!;
    expect(leg).toEqual({ name: 'Lonavala', km: null, minutes: null, hazards: 0 });
    expect(nextLeg({ routePath: null, distanceKm: null, etaMinutes: null, own: null, stops: [], visited: new Set(), destinationName: null, clusters: [] })).toBeNull();
  });
  it('break timer', () => {
    expect(breakClock(65_000)).toBe('01:05');
    expect(breakClock(3_725_000)).toBe('1:02:05');
    expect(breakClock(-5)).toBe('00:00');
  });
  it('break over: everybody ready, or the lead (who was ready) rolls on while I am ready', () => {
    expect(shouldRoll({ allReady: true, meReady: true, leadPrev: undefined, leadNow: undefined })).toBe(true);
    expect(shouldRoll({ allReady: false, meReady: true, leadPrev: 'ready', leadNow: 'riding' })).toBe(true);
    expect(shouldRoll({ allReady: false, meReady: false, leadPrev: 'ready', leadNow: 'riding' })).toBe(false);
    expect(shouldRoll({ allReady: false, meReady: true, leadPrev: 'riding', leadNow: 'riding' })).toBe(false);
  });
});
