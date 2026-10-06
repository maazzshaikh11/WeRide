/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
/**
 * Meetup (roll call): real tiles, derivations, ready check, CTA, lead roll-out, opening a planned ride.
 */
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaInsetsContext: require('react').createContext(null),
}));
const mockHandlers: { ride?: (r: any) => void; rollCall?: (d: any[]) => void; presence?: (d: any[]) => void } = {};
const mockSetStatus = jest.fn().mockResolvedValue(undefined);
const mockSetRollCall = jest.fn().mockResolvedValue(undefined);
jest.mock('../src/services/rideService', () => ({
  subscribeRide: (_id: string, cb: (r: any) => void) => { mockHandlers.ride = cb; return jest.fn(); },
  subscribeRollCall: (_id: string, cb: (d: any[]) => void) => { mockHandlers.rollCall = cb; return jest.fn(); },
  subscribePresence: (_id: string, cb: (d: any[]) => void) => { mockHandlers.presence = cb; return jest.fn(); },
  setRideStatus: (...a: unknown[]) => mockSetStatus(...a),
  setRollCall: (...a: unknown[]) => mockSetRollCall(...a),
  setPresence: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/services/permissionsService', () => ({ getPermissionStatus: jest.fn().mockResolvedValue('granted') }));
jest.mock('../src/navigation/navigationRef', () => ({ navigationRef: { isReady: () => false, getCurrentRoute: () => undefined }, navigateRoot: jest.fn(), resetRoot: jest.fn() }));
jest.mock('react-native-geolocation-service', () => ({
  getCurrentPosition: (ok: (p: any) => void) => ok({ coords: { latitude: 19.0, longitude: 72.8, accuracy: 6, speed: 0 } }),
}));

import React from 'react';
import { Linking, StyleSheet, Text } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import MeetupScreen, { AUTO_ROLL_DELAY_MS } from '../src/screens/road/MeetupScreen';
import { useAppStore } from '../src/store/appStore';
import { useRidersStore } from '../src/store/ridersStore';
import { useProfileStore } from '../src/store/profileStore';
import { useCrewsStore } from '../src/store/crewsStore';
import { useRidesStore } from '../src/store/ridesStore';
import { usePrefsStore } from '../src/store/prefsStore';
import { useVoiceStore } from '../src/hooks/useVoiceChannel';
import { ThemeContext, buildTheme } from '../src/theme/ThemeProvider';
import { THEMES } from '../src/theme/palettes';

const ALL = [['demo', 'light'], ['demo', 'dark'], ['ember', 'light'], ['ember', 'dark']] as const;
const MEET = { label: 'Bandra Fort, Gate 3', lat: 19.0, lng: 72.8 };
const north = (m: number) => ({ lat: MEET.lat + m / 111320, lng: MEET.lng });
const prof = (uid: string, name: string) => ({ uid, name, bike: 'Duke 390', style: 'Steady', stats: { km: 0, rides: 0, together_sum: 0 } }) as any;
const baseRide = (over: object = {}) => ({
  id: 'r1', name: 'Sunrise Ghat Run', created_by: 'lead', member_ids: ['me', 'lead', 'zoya', 'dev'], crew_id: 'c1', join_code: null, ride_type: null, pace: null,
  start_time_ms: Date.now() + 49 * 60000, status: 'meetup', started_ms: null, finished_ms: null, meetup: MEET, ride_plan: null, invited_ids: [], created_ms: 1, ...over,
});
const hlc = () => `${Date.now()}:0`;
const putRider = (id: string, at: { lat: number; lng: number }, speed = 0) =>
  act(() => useRidersStore.getState().upsertRider({ rider_id: id, group_id: 'r1', timestamp_hlc: hlc(), lat: at.lat, lng: at.lng, speed_mps: speed, heading_deg: 0, spoof_flag: false, nis_score: 1, accuracy_m: 5 }));

const mounted: ReactTestRenderer[] = [];
async function mount(id: 'demo' | 'ember' = 'demo', scheme: 'light' | 'dark' = 'dark') {
  let t!: ReactTestRenderer;
  act(() => {
    t = create(
      <ThemeContext.Provider value={buildTheme(id, THEMES[id][scheme])}>
        <MeetupScreen navigation={{ goBack: jest.fn() }} route={{ params: { groupId: 'r1' } }} />
      </ThemeContext.Provider>,
    );
  });
  mounted.push(t);
  await act(async () => { await Promise.resolve(); }); // let the permission read settle
  return t;
}
const texts = (t: ReactTestRenderer) => t.root.findAllByType(Text).map((n) => [n.props.children].flat(3).join(''));
const byLabel = (t: ReactTestRenderer, label: string) => t.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
const tile = (t: ReactTestRenderer, uid: string) => t.root.findAll((n) => n.props.testID === `tile-${uid}` && typeof n.type === 'string')[0];
const emit = (ride: any, rollCall: any[] = []) => act(() => { mockHandlers.ride?.(ride); mockHandlers.rollCall?.(rollCall); });

describe('MeetupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAppStore.setState({ userId: 'me', groupId: 'r1' });
    useRidersStore.setState({ riders: new Map(), subscribe: jest.fn(), unsubscribe: jest.fn() } as any);
    useProfileStore.setState({ byId: { me: prof('me', 'Arjun'), lead: prof('lead', 'Meera Rao'), zoya: prof('zoya', 'Zoya Khan'), dev: prof('dev', 'Dev Patel') }, ensure: jest.fn() } as any);
    useCrewsStore.setState({ crews: [{ id: 'c1', name: 'Ghat Ghosts', created_by: 'lead', member_ids: [], roles: { lead: 'lead', dev: 'sweep' }, join_code: 'X', created_ms: 1 }] as any });
    useRidesStore.setState({ rides: [], loaded: true });
    usePrefsStore.setState({ contacts: [{ id: 'c', name: 'Mom', number: '+911' }] } as any);
    useVoiceStore.setState({ status: 'off', talking: false });
  });
  afterEach(() => mounted.splice(0).forEach((t) => act(() => t.unmount())));

  it.each(ALL)('%s/%s: renders header, tiles for EVERY member, ready check and the CTA', async (id, scheme) => {
    const t = await mount(id, scheme);
    emit(baseRide());
    const tx = texts(t);
    expect(tx).toContain('ROLL CALL ∙ SUNRISE GHAT RUN');
    expect(tx).toContain('Meetup');
    expect(tx.some((x) => /^\d+:\d\d ∙ IN (48|49|50) MIN$/i.test(x))).toBe(true);
    expect(tx).toContain('YOUR READY CHECK');
    ['me', 'lead', 'zoya', 'dev'].forEach((u) => expect(tile(t, u)).toBeDefined());
    expect(tx).toContain('You');
    expect(tx).toContain('Meera Rao');
    expect(byLabel(t, "I'm ready")).toBeDefined();
    expect(byLabel(t, 'Navigate to the meetup point')).toBeDefined();
  });

  it('the countdown pill is the demo\'s mono ink pill (which also wraps the roll-call title like the demo)', async () => {
    const t = await mount();
    emit(baseRide());
    const pill = t.root.findAll((n) => n.props.testID === 'meetup-countdown' && typeof n.type === 'string')[0];
    expect(pill).toBeDefined();
    expect(pill.props.accessibilityLabel).toMatch(/^\d+:\d\d ∙ IN (48|49|50) MIN$/);
    const label = pill.findAllByType(Text)[0];
    const st = ([] as any[]).concat(label.props.style).flat(3).filter(Boolean).reduce((a, b) => ({ ...a, ...b }), {});
    expect(st.fontFamily).toMatch(/Mono/);
    expect(st.fontSize).toBe(13);
  });

  it('shows real roles, and no battery chip or family sharing', async () => {
    const t = await mount();
    emit(baseRide());
    const tx = texts(t);
    expect(tx).toContain('LEAD');
    expect(tx).toContain('SWEEP');
    expect(tx.some((x) => /battery|family/i.test(x))).toBe(false);
  });

  it('tile status: ready / at meetup / in N min / no signal yet', async () => {
    const t = await mount();
    emit(baseRide(), [{ uid: 'lead', state: 'ready', updated_ms: 1 }]);
    putRider('zoya', north(80));
    putRider('dev', north(1500), 10); // 1.5 km at 10 m/s -> 3 min
    const status = (u: string) => tile(t, u).props.accessibilityLabel;
    expect(status('lead')).toBe('Meera Rao, ✓ ready');
    expect(status('zoya')).toBe('Zoya Khan, at meetup');
    expect(status('dev')).toBe('Dev Patel, in 3 min');
    expect(status('me')).toBe('You, at meetup'); // own GPS read: at the meetup point
  });

  it('"N of M ready" pill follows the roll call', async () => {
    const t = await mount();
    emit(baseRide(), [{ uid: 'lead', state: 'ready', updated_ms: 1 }, { uid: 'zoya', state: 'ready', updated_ms: 1 }]);
    expect(texts(t)).toContain('2 OF 4 READY');
  });

  it('ready check from real state; warn chips use the accent (yellow) disc', async () => {
    usePrefsStore.setState({ contacts: [] } as any);
    const t = await mount();
    await act(async () => { await Promise.resolve(); });
    emit(baseRide());
    const label = (k: string) => t.root.findAll((n) => n.props.testID === `check-${k}` && typeof n.type === 'string')[0].props.accessibilityLabel;
    expect(label('gps')).toBe('GPS precise');
    expect(label('location')).toBe('Always-on location');
    expect(label('sos')).toBe('No SOS contact, needs attention');
    expect(label('voice')).toBe('Voice channel off, needs attention');
    const palette = THEMES.demo.dark;
    const warnChip = t.root.findAll((n) => n.props.testID === 'check-sos' && typeof n.type === 'string')[0];
    const disc = warnChip.findAll((n) => typeof n.type === 'string' && n.props.style && StyleSheet.flatten(n.props.style).width === 20)[0];
    expect(StyleSheet.flatten(disc.props.style).backgroundColor).toBe(palette.pri);
    act(() => useVoiceStore.setState({ status: 'live' }));
    expect(label('voice')).toBe('Voice channel on');
  });

  it('I’m ready writes the roll call; Ready ∙ waiting for N un-readies', async () => {
    const t = await mount();
    emit(baseRide());
    act(() => byLabel(t, "I'm ready").props.onPress());
    expect(mockSetRollCall).toHaveBeenCalledWith('r1', 'me', 'ready');
    emit(baseRide(), [{ uid: 'me', state: 'ready', updated_ms: 1 }]);
    const again = byLabel(t, 'Ready. Waiting for 3. Tap to cancel');
    expect(again).toBeDefined();
    act(() => again.props.onPress());
    expect(mockSetRollCall).toHaveBeenLastCalledWith('r1', 'me', 'notready');
  });

  it('only the lead sees Roll out; it is disabled until someone is ready and rolls out (status live)', async () => {
    const t = await mount();
    emit(baseRide());
    expect(byLabel(t, 'Roll out now')).toBeUndefined();
    act(() => t.unmount()); mounted.pop();

    useAppStore.setState({ userId: 'lead' });
    const l = await mount();
    emit(baseRide());
    const btn = l.root.findAll((n) => n.props.accessibilityLabel === 'Roll out now' && typeof n.props.onPress === 'function')[0];
    expect(btn.props.disabled).toBe(true);
    emit(baseRide(), [{ uid: 'zoya', state: 'ready', updated_ms: 1 }]);
    const enabled = l.root.findAll((n) => n.props.accessibilityLabel === 'Roll out now' && typeof n.props.onPress === 'function')[0];
    expect(enabled.props.disabled).toBeFalsy();
    act(() => enabled.props.onPress());
    expect(mockSetStatus).toHaveBeenCalledWith('r1', 'live');
  });

  it('when every member is ready the LEAD’s phone starts the roll-out; a member’s phone does not', async () => {
    jest.useFakeTimers();
    const all = ['me', 'lead', 'zoya', 'dev'].map((u) => ({ uid: u, state: 'ready', updated_ms: 1 }));
    useAppStore.setState({ userId: 'lead' });
    const l = await mount();
    emit(baseRide(), all);
    expect(mockSetStatus).not.toHaveBeenCalledWith('r1', 'live');
    act(() => { jest.advanceTimersByTime(AUTO_ROLL_DELAY_MS + 5); });
    expect(mockSetStatus).toHaveBeenCalledWith('r1', 'live');
    act(() => l.unmount()); mounted.pop();

    mockSetStatus.mockClear();
    useAppStore.setState({ userId: 'zoya' });
    await mount();
    emit(baseRide(), all);
    act(() => { jest.advanceTimersByTime(AUTO_ROLL_DELAY_MS + 5); });
    expect(mockSetStatus).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('opening a planned ride opens the roll call (once)', async () => {
    const t = await mount();
    emit(baseRide({ status: 'planned' }));
    emit(baseRide({ status: 'planned' }));
    expect(mockSetStatus.mock.calls.filter((c) => c[1] === 'meetup')).toHaveLength(1);
    expect(t).toBeDefined();
  });

  it('Navigate opens the maps app at the meetup point', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    const t = await mount();
    emit(baseRide());
    act(() => byLabel(t, 'Navigate to the meetup point').props.onPress());
    expect(open).toHaveBeenCalledWith(expect.stringContaining('destination=19,72.8'));
    open.mockRestore();
  });

  it('honest while loading: no tiles, no invented riders', async () => {
    const t = await mount();
    expect(texts(t)).toContain('Loading the roll call…');
    expect(t.root.findAll((n) => String(n.props.testID ?? '').startsWith('tile-'))).toHaveLength(0);
  });
});
