/** IntelSheet and RideInfoSheet. */
import React from 'react';
import { Text } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';

import type { Ride, RsvpDoc } from '../src/models/domain';
import { ThemeContext, buildTheme } from '../src/theme/ThemeProvider';
import { THEMES } from '../src/theme/palettes';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SafeAreaInsetsContext: require('react').createContext(null),
}));
const mockSetString = jest.fn();
jest.mock('@react-native-clipboard/clipboard', () => ({ __esModule: true, default: { setString: (...a: any[]) => mockSetString(...a) } }));
let mockRsvp: RsvpDoc[] = [];
const mockSetRsvp = jest.fn(() => Promise.resolve());
jest.mock('../src/services/rideService', () => ({
  ...jest.requireActual('../src/services/rideService'),
  subscribeRsvp: jest.fn((_id: string, on: (d: RsvpDoc[]) => void) => { on(mockRsvp); return jest.fn(); }),
  setRsvp: (...a: any[]) => (mockSetRsvp as any)(...a),
}));

import IntelSheet from '../src/sheets/IntelSheet';
import RideInfoSheet from '../src/sheets/RideInfoSheet';
import { useCrewsStore } from '../src/store/crewsStore';
import { useSessionStore } from '../src/store/sessionStore';
import { useToastStore } from '../src/store/toastStore';
import { usePrefsStore } from '../src/store/prefsStore';

const ALL = [['demo', 'light'], ['demo', 'dark'], ['ember', 'light'], ['ember', 'dark']] as const;
const mounted: ReactTestRenderer[] = [];
afterEach(() => mounted.splice(0).forEach((t) => act(() => t.unmount())));
function mount(el: React.ReactElement, id: 'demo' | 'ember' = 'demo', scheme: 'light' | 'dark' = 'light') {
  let t!: ReactTestRenderer;
  act(() => {
    t = create(<ThemeContext.Provider value={buildTheme(id, THEMES[id][scheme])}>{el}</ThemeContext.Provider>);
  });
  mounted.push(t);
  return t;
}
const texts = (t: ReactTestRenderer) => t.root.findAllByType(Text).map((n) => [n.props.children].flat(4).filter((x) => typeof x === 'string' || typeof x === 'number').join(''));
const has = (t: ReactTestRenderer, s: string | RegExp) => texts(t).some((x) => (typeof s === 'string' ? x === s : s.test(x)));
const press = (t: ReactTestRenderer, label: string) => {
  const n = t.root.findAll((x) => x.props.accessibilityLabel === label && typeof x.props.onPress === 'function')[0];
  if (!n) throw new Error(`no pressable "${label}" in: ${texts(t).join(' | ')}`);
  act(() => n.props.onPress());
};

describe('IntelSheet', () => {
  const cluster = (type: string, n: number, lng: number) => ({ cluster_id: type, group_id: 'g', hazard_type: type as any, centroid_lat: 19, centroid_lng: lng, polygon_points: [], report_count: n, hazard_score: 1, created_at_hlc: '1700000000000:0', status: 'active' as const });
  it.each(ALL)('%s/%s: a rail of real hazards, the safety score and the explainer', (id, scheme) => {
    const t = mount(<IntelSheet visible onClose={jest.fn()} clusters={[cluster('pothole', 3, 72.85), cluster('oil_spill', 1, 72.9)]} path={[{ lat: 19, lng: 72.8 }, { lat: 19, lng: 73 }]} safety={0.88} now={1700000000000 + 2 * 3_600_000} />, id, scheme);
    expect(has(t, 'ROUTE INTEL')).toBe(true);
    expect(has(t, 'Before you roll')).toBe(true);
    expect(has(t, /^Pothole · km \d+$/)).toBe(true);
    expect(has(t, /^Oil on the road · km \d+$/)).toBe(true);
    expect(has(t, '3 reports · first reported 2h ago')).toBe(true);
    expect(has(t, 'Route safety score 88')).toBe(true);
    expect(has(t, 'Hazards show up when two riders report the same spot. That keeps one bad tap from crying wolf.')).toBe(true);
  });
  it('no clusters, no score: an honest empty line', () => {
    const t = mount(<IntelSheet visible onClose={jest.fn()} />);
    expect(has(t, 'No active hazards have been reported on this route.')).toBe(true);
  });
  it('"Got it" closes', () => {
    const onClose = jest.fn();
    const t = mount(<IntelSheet visible onClose={onClose} />);
    press(t, 'Got it');
    expect(onClose).toHaveBeenCalled();
  });
  it('renders nothing while closed', () => {
    const t = mount(<IntelSheet visible={false} onClose={jest.fn()} />);
    expect(t.root.findAll((n) => n.props.testID === 'sheet-Intel' && typeof n.type === 'string')).toHaveLength(0);
  });
});

describe('RideInfoSheet', () => {
  const ride = (over: Partial<Ride> = {}): Ride => {
    const r: any = {
      id: 'r2', name: 'Mulshi Lake Loop', created_by: 'u2', member_ids: ['u2', 'me'], crew_id: null, join_code: 'RIDE22', ride_type: null, pace: null,
      start_time_ms: new Date(2025, 9, 18, 6, 0).getTime(), status: 'planned', started_ms: null, finished_ms: null, meetup: null, invited_ids: [], created_ms: 1,
      ride_plan: { start: { label: 'Pune', lat: 18.5, lng: 73.8 }, stops: [], destination: { label: 'Mulshi', lat: 18.5, lng: 73.5 } }, ...over,
    };
    r.route_stats = { distance_km: 112, eta_minutes: 190, safety_score: 0.9, path: [{ lat: 18.5, lng: 73.8 }, { lat: 18.5, lng: 73.5 }] };
    return r;
  };
  beforeEach(() => {
    mockRsvp = [{ uid: 'u2', status: 'going', updated_ms: 1 }, { uid: 'u3', status: 'going', updated_ms: 1 }, { uid: 'u4', status: 'maybe', updated_ms: 1 }];
    mockSetRsvp.mockClear();
    mockSetString.mockClear();
    useSessionStore.setState({ uid: 'me', authKnown: true });
    useCrewsStore.setState({ crews: [] });
    useToastStore.setState({ toasts: [] });
    usePrefsStore.setState({ prefs: { ...usePrefsStore.getState().prefs, units: 'km' } });
  });

  it.each(ALL)('%s/%s: name, when · distance · riders confirmed, and the map', (id, scheme) => {
    const t = mount(<RideInfoSheet visible onClose={jest.fn()} ride={ride()} />, id, scheme);
    expect(has(t, 'UPCOMING')).toBe(true);
    expect(has(t, 'Mulshi Lake Loop')).toBe(true);
    expect(has(t, 'Sat 18 Oct · 6:00 AM · 112 km · 2 riders confirmed')).toBe(true);
    expect(t.root.findAllByProps({ testID: 'rideinfo-map' }).length).toBeGreaterThan(0);
  });
  it('shows miles in miles', () => {
    usePrefsStore.setState({ prefs: { ...usePrefsStore.getState().prefs, units: 'mi' } });
    expect(has(mount(<RideInfoSheet visible onClose={jest.fn()} ride={ride()} />), /· 70 mi ·/)).toBe(true);
  });
  it('omits the distance when the ride has no saved route', () => {
    const r: any = ride();
    r.route_stats = null;
    expect(has(mount(<RideInfoSheet visible onClose={jest.fn()} ride={r} />), 'Sat 18 Oct · 6:00 AM · 2 riders confirmed')).toBe(true);
  });
  it('"I’m in" writes the RSVP, confirms and closes', () => {
    const onClose = jest.fn();
    const t = mount(<RideInfoSheet visible onClose={onClose} ride={ride()} />);
    press(t, 'I’m in');
    expect(mockSetRsvp).toHaveBeenCalledWith('r2', 'me', 'going');
    expect(useToastStore.getState().toasts[0].message).toBe('You’re in');
    expect(onClose).toHaveBeenCalled();
  });
  it('already going: the button says so and is disabled', () => {
    mockRsvp = [{ uid: 'me', status: 'going', updated_ms: 1 }];
    const t = mount(<RideInfoSheet visible onClose={jest.fn()} ride={ride()} />);
    expect(has(t, 'You’re in')).toBe(true);
    expect(has(t, 'I’m in')).toBe(false);
    const b = t.root.findAll((x) => x.props.accessibilityLabel === 'You’re in' && x.props.accessibilityRole === 'button')[0];
    expect(b.props.disabled).toBeTruthy();
  });
  it('Invite copies the ride\'s code, or the crew\'s code when the ride belongs to a crew', () => {
    let t = mount(<RideInfoSheet visible onClose={jest.fn()} ride={ride()} />);
    press(t, 'Copy invite code RIDE22');
    expect(mockSetString).toHaveBeenLastCalledWith('RIDE22');
    expect(useToastStore.getState().toasts[0].message).toBe('Invite code copied');
    useCrewsStore.setState({ crews: [{ id: 'c1', name: 'Ghosts', created_by: 'u2', member_ids: ['u2', 'me'], roles: {}, join_code: 'GHOST7', created_ms: 1 }] });
    t = mount(<RideInfoSheet visible onClose={jest.fn()} ride={ride({ crew_id: 'c1' })} />);
    press(t, 'Copy invite code GHOST7');
    expect(mockSetString).toHaveBeenLastCalledWith('GHOST7');
  });
  it('with no code at all Invite is disabled', () => {
    const t = mount(<RideInfoSheet visible onClose={jest.fn()} ride={ride({ join_code: null })} />);
    const b = t.root.findAll((x) => x.props.accessibilityLabel === 'Invite' && x.props.accessibilityRole === 'button')[0];
    expect(b.props.disabled).toBeTruthy();
  });
  it('a failed RSVP write is reported inline', async () => {
    mockSetRsvp.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    const t = mount(<RideInfoSheet visible onClose={jest.fn()} ride={ride()} />);
    press(t, 'I’m in');
    await act(async () => undefined);
    expect(has(t, 'Could not save that. Check your connection and try again.')).toBe(true);
  });
  it('renders nothing without a ride', () => {
    const t = mount(<RideInfoSheet visible onClose={jest.fn()} ride={null} />);
    expect(t.root.findAll((n) => n.props.testID === 'sheet-RideInfo' && typeof n.type === 'string')).toHaveLength(0);
  });
});
