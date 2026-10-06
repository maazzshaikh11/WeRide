/**
 * Crews tab, Crew, Join and their sheets: the four palettes, loaded / loading / empty / error states,
 * and what each interaction calls (services are mocked at the module boundary).
 */
import React from 'react';
import { Share, StyleSheet } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Path } from 'react-native-svg';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SafeAreaInsetsContext: require('react').createContext(null),
}));
jest.mock('@react-native-clipboard/clipboard', () => ({ __esModule: true, default: { setString: jest.fn() } }));
jest.mock('../src/services/crewService', () => {
  const actual = jest.requireActual('../src/services/crewService');
  return {
    ...actual,
    createCrew: jest.fn(),
    joinCrewByCode: jest.fn(),
    leaveCrew: jest.fn(),
    getCrew: jest.fn(),
    getCrewNextRide: jest.fn(),
    findRideByCode: jest.fn(),
    subscribeMyCrews: jest.fn(() => () => undefined),
  };
});
jest.mock('../src/services/rideLogService', () => ({ subscribeRideLogs: jest.fn(() => () => undefined) }));
const mockJoinGroup = jest.fn();
jest.mock('@routing/group/groupService', () => ({ GroupService: jest.fn().mockImplementation(() => ({ joinGroup: mockJoinGroup })) }));

import Clipboard from '@react-native-clipboard/clipboard';
import CrewsScreen from '../src/screens/garage/CrewsScreen';
import CrewScreen from '../src/screens/garage/CrewScreen';
import JoinScreen from '../src/screens/garage/JoinScreen';
import NewCrewSheet from '../src/sheets/NewCrewSheet';
import InviteSheet from '../src/sheets/InviteSheet';
import MemberSheet from '../src/sheets/MemberSheet';
import CrewMenuSheet from '../src/sheets/CrewMenuSheet';
import * as crewService from '../src/services/crewService';
import { subscribeRideLogs } from '../src/services/rideLogService';
import { useCrewsStore } from '../src/store/crewsStore';
import { useProfileStore } from '../src/store/profileStore';
import { usePrefsStore } from '../src/store/prefsStore';
import { useRidesStore } from '../src/store/ridesStore';
import { useSessionStore } from '../src/store/sessionStore';
import { useToastStore } from '../src/store/toastStore';
import { ThemeContext, buildTheme } from '../src/theme/ThemeProvider';
import { THEMES } from '../src/theme/palettes';
import type { Crew, Ride, RideLog, UserProfile } from '../src/models/domain';

const svc = crewService as jest.Mocked<typeof crewService>;
const ALL = [['demo', 'light'], ['demo', 'dark'], ['ember', 'light'], ['ember', 'dark']] as const;

const mounted: ReactTestRenderer[] = [];
afterEach(() => {
  mounted.splice(0).forEach((t) => act(() => t.unmount()));
  jest.useRealTimers();
});
function mount(el: React.ReactElement, id: 'demo' | 'ember' = 'demo', scheme: 'light' | 'dark' = 'dark') {
  let t!: ReactTestRenderer;
  act(() => {
    t = create(<ThemeContext.Provider value={buildTheme(id, THEMES[id][scheme])}>{el}</ThemeContext.Provider>);
  });
  mounted.push(t);
  return t;
}
type J = { type: string; props?: any; children?: (J | string)[] | null };
const leaves = (n: J | string): string => (typeof n === 'string' ? n : (n.children ?? []).map(leaves).join(''));
const collect = (n: J | string | null, out: string[]) => {
  if (!n) return;
  if (Array.isArray(n)) return n.forEach((c) => collect(c, out));
  if (typeof n === 'string') return;
  if (n.type === 'Text') {
    out.push(leaves(n));
    return;
  }
  (n.children ?? []).forEach((c) => collect(c, out));
};
/** All rendered text, one entry per <Text> (nested spans joined), separated by " | ". */
const flat = (t: ReactTestRenderer) => {
  const out: string[] = [];
  collect(t.toJSON() as J, out);
  return out.join(' | ');
};
/** Host elements with this testID (composite wrappers share the prop even when they render nothing). */
const hostById = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => typeof n.type === 'string' && n.props.testID === id);
const press = async (t: ReactTestRenderer, where: { id?: string; label?: string }) => {
  const hits = t.root.findAll(
    (n) => typeof n.props.onPress === 'function' && (where.id ? n.props.testID === where.id : n.props.accessibilityLabel === where.label),
  );
  if (!hits.length) throw new Error(`nothing to press for ${JSON.stringify(where)}`);
  await act(async () => {
    await hits[0].props.onPress();
  });
};
const flush = () => act(async () => { await Promise.resolve(); });

const HOUR = 3_600_000;
const profile = (uid: string, name: string, bike: string, rides = 0, km = 0, tog = 0): UserProfile => ({ uid, name, bike, style: 'Steady', stats: { km, rides, together_sum: tog } });
const crew = (o: Partial<Crew> = {}): Crew => ({
  id: 'c1', name: 'Ghat Ghosts', created_by: 'meera', member_ids: ['me', 'meera', 'zoya'], roles: { meera: 'lead', zoya: 'sweep' }, join_code: 'GHST72',
  created_ms: new Date(2026, 2, 12).getTime(), ...o,
});
const ride = (o: Partial<Ride> = {}): Ride => ({
  id: 'r1', name: 'Sunrise Ghat Run', created_by: 'meera', member_ids: ['me', 'meera'], crew_id: 'c1', join_code: null, ride_type: null, pace: null,
  start_time_ms: Date.now() + 5 * HOUR, status: 'planned', started_ms: null, finished_ms: null, meetup: null, ride_plan: null, invited_ids: [], created_ms: null, ...o,
});
const log = (o: Partial<RideLog> = {}): RideLog => ({
  ride_id: 'g9', crew_id: 'c1', name: 'Mulshi loop', started_ms: new Date(2026, 8, 20, 6).getTime(), ended_ms: 0, km: 84, duration_s: 0, avg_kmh: 0, max_kmh: 0,
  together_pct: 92, longest_gap_m: 0, riders: 3, hazards_shared: 0, signals_sent: 0, track: [], events: [], rating: null, start: null, destination: null, ...o,
});

const nav = () => ({ navigate: jest.fn(), goBack: jest.fn(), canGoBack: jest.fn(() => true), reset: jest.fn() });

beforeEach(() => {
  jest.clearAllMocks();
  useCrewsStore.setState({ crews: [crew()], loaded: true, error: false, muted: {} });
  useRidesStore.setState({ rides: [], loaded: true });
  useSessionStore.setState({ uid: 'me', authKnown: true });
  useProfileStore.setState({
    me: null,
    byId: {
      me: profile('me', 'Arjun Rao', 'Himalayan 450'),
      meera: profile('meera', 'Meera', 'Interceptor 650', 31, 4210, 2945),
      zoya: profile('zoya', 'Zoya', 'Duke 390'),
    },
  });
  useToastStore.setState({ toasts: [] });
  (subscribeRideLogs as jest.Mock).mockImplementation(() => () => undefined);
  svc.getCrewNextRide.mockResolvedValue(null);
  svc.getCrew.mockResolvedValue(null);
});

describe('CrewsScreen', () => {
  it.each(ALL)('%s/%s: a card per real crew with riders, next ride and the Ride tomorrow pill', (id, scheme) => {
    useCrewsStore.setState({
      crews: [crew(), crew({ id: 'c2', name: 'Sunday Slow Rollers', member_ids: ['me'], join_code: 'SLOW22' })],
    });
    useRidesStore.setState({ rides: [ride({ start_time_ms: Date.now() + 5 * HOUR })] });
    const t = mount(<CrewsScreen navigation={nav()} />, id, scheme);
    const txt = flat(t);
    expect(txt).toContain('Ghat Ghosts');
    expect(txt).toContain('3 riders');
    expect(txt).toContain('Sunday Slow Rollers');
    expect(txt).toContain('1 rider');
    expect(txt).toContain('RIDE TOMORROW');
    expect(txt).toContain('Sunrise Ghat Run');
    expect(txt).toContain('No ride planned');
    expect(txt).toContain('Join with code');
    expect(txt).toContain('Start a crew');
    expect(hostById(t, 'crew-card-c1').length).toBeGreaterThan(0);
  });

  it('no Ride tomorrow pill when the next ride is more than a day away', () => {
    useRidesStore.setState({ rides: [ride({ start_time_ms: Date.now() + 40 * HOUR })] });
    const t = mount(<CrewsScreen navigation={nav()} />);
    expect(flat(t)).not.toContain('RIDE TOMORROW');
    expect(flat(t)).toContain('Sunrise Ghat Run');
  });

  it('shows a skeleton while loading', () => {
    useCrewsStore.setState({ crews: [], loaded: false });
    const t = mount(<CrewsScreen navigation={nav()} />);
    expect(hostById(t, 'crews-loading').length).toBeGreaterThan(0);
    expect(flat(t)).not.toContain('No crews yet');
  });

  it('empty: explains what a crew is and still offers both buttons', () => {
    useCrewsStore.setState({ crews: [], loaded: true });
    const t = mount(<CrewsScreen navigation={nav()} />);
    expect(flat(t)).toContain('No crews yet');
    expect(flat(t)).toContain('Join with code');
    expect(flat(t)).toContain('Start a crew');
  });

  it('error with nothing cached: honest message, buttons remain', () => {
    useCrewsStore.setState({ crews: [], loaded: true, error: true });
    const t = mount(<CrewsScreen navigation={nav()} />);
    expect(flat(t)).toContain("Can't load your crews");
    expect(flat(t)).not.toContain('No crews yet');
    expect(flat(t)).toContain('Start a crew');
  });

  it('error with cached crews keeps showing them', () => {
    useCrewsStore.setState({ error: true });
    const t = mount(<CrewsScreen navigation={nav()} />);
    expect(flat(t)).toContain('Ghat Ghosts');
    expect(flat(t)).not.toContain("Can't load your crews");
  });

  it('navigates: card -> Crew, Join with code -> Join', async () => {
    const n = nav();
    const t = mount(<CrewsScreen navigation={n} />);
    await press(t, { id: 'crew-card-c1' });
    expect(n.navigate).toHaveBeenCalledWith('Crew', { crewId: 'c1' });
    await press(t, { id: 'crews-join' });
    expect(n.navigate).toHaveBeenCalledWith('Join');
  });

  it('Start a crew opens the sheet; creating then continuing opens the new crew', async () => {
    const n = nav();
    svc.createCrew.mockResolvedValue(crew({ id: 'new1', name: 'Tuesday Throttle', join_code: 'TUES42', member_ids: ['me'] }));
    const t = mount(<CrewsScreen navigation={n} />);
    expect(hostById(t, 'sheet-NewCrew')).toHaveLength(0);
    await press(t, { id: 'crews-new' });
    expect(hostById(t, 'sheet-NewCrew').length).toBeGreaterThan(0);
    await act(async () => t.root.findAll((x) => x.props.testID === 'newcrew-name')[0].props.onChangeText('Tuesday Throttle'));
    await press(t, { id: 'newcrew-create' });
    expect(svc.createCrew).toHaveBeenCalledWith('Tuesday Throttle');
    expect(flat(t)).toContain('TUES42');
    expect(n.navigate).not.toHaveBeenCalledWith('Crew', expect.anything());
    await press(t, { id: 'newcrew-continue' });
    expect(n.navigate).toHaveBeenCalledWith('Crew', { crewId: 'new1' });
  });
});

describe('NewCrewSheet', () => {
  const open = (onCreated = jest.fn(), onClose = jest.fn()) => ({ t: mount(<NewCrewSheet visible onClose={onClose} onCreated={onCreated} />), onCreated, onClose });
  const type = async (t: ReactTestRenderer, v: string) => act(async () => t.root.findAll((x) => x.props.testID === 'newcrew-name')[0].props.onChangeText(v));

  it.each(ALL)('%s/%s: renders the demo copy', (id, scheme) => {
    const t = mount(<NewCrewSheet visible onClose={jest.fn()} />, id, scheme);
    expect(flat(t)).toContain('Start a crew');
    expect(flat(t)).toContain('Name it. We make a code. You invite.');
    expect(flat(t)).toContain('Create crew');
  });
  it('a name under 2 characters shows an inline error and calls nothing', async () => {
    const { t } = open();
    await type(t, 'A');
    await press(t, { id: 'newcrew-create' });
    expect(svc.createCrew).not.toHaveBeenCalled();
    expect(flat(t)).toContain('2 to 22 characters');
  });
  it('a failing create shows the error inline and can be retried', async () => {
    svc.createCrew.mockRejectedValueOnce(new crewService.CrewError('network', "Can't reach the server. Check your connection and try again."));
    const { t } = open();
    await type(t, 'Night Owls');
    await press(t, { id: 'newcrew-create' });
    expect(flat(t)).toContain("Can't reach the server");
    svc.createCrew.mockResolvedValueOnce(crew({ id: 'n', name: 'Night Owls', join_code: 'OWLS22' }));
    await press(t, { id: 'newcrew-create' });
    expect(flat(t)).toContain('OWLS22');
  });
  it('dismissing after creating still reports the crew exactly once', async () => {
    svc.createCrew.mockResolvedValue(crew({ id: 'n', name: 'Night Owls', join_code: 'OWLS22' }));
    const { t, onCreated, onClose } = open();
    await type(t, 'Night Owls');
    await press(t, { id: 'newcrew-create' });
    await press(t, { label: 'Close sheet' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onCreated.mock.calls[0][0]).toBe('n');
  });
  it('copy puts the new code on the clipboard', async () => {
    svc.createCrew.mockResolvedValue(crew({ id: 'n', name: 'Night Owls', join_code: 'OWLS22' }));
    const { t } = open();
    await type(t, 'Night Owls');
    await press(t, { id: 'newcrew-create' });
    await press(t, { label: 'Copy crew code' });
    expect(Clipboard.setString).toHaveBeenCalledWith('OWLS22');
  });
});

describe('InviteSheet', () => {
  it.each(ALL)('%s/%s: big code, QR drawn from the code, Copy and Share', (id, scheme) => {
    const t = mount(<InviteSheet visible onClose={jest.fn()} crew={crew()} />, id, scheme);
    expect(flat(t)).toContain('INVITE TO GHAT GHOSTS');
    expect(flat(t)).toContain('GHST72');
    expect(flat(t)).toContain('Anyone with this code can join');
    expect(flat(t)).not.toContain('Expires');
    const qr = hostById(t, 'invite-qr');
    expect(qr.length).toBeGreaterThan(0);
    const paths = t.root.findAllByType(Path).filter((p) => String(p.props.d).startsWith('M'));
    expect(paths.length).toBeGreaterThan(0);
    // dark modules on a light tile whichever scheme the app is in
    expect(paths.some((p) => p.props.fill === THEMES[id].light.ink)).toBe(true);
  });
  it('Copy writes the code to the clipboard and toasts', async () => {
    const t = mount(<InviteSheet visible onClose={jest.fn()} crew={crew()} />);
    await press(t, { id: 'invite-copy' });
    expect(Clipboard.setString).toHaveBeenCalledWith('GHST72');
    expect(useToastStore.getState().toasts.map((x) => x.message)).toContain('Code copied');
  });
  it('Share opens the system share sheet with the code', async () => {
    const spy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    const t = mount(<InviteSheet visible onClose={jest.fn()} crew={crew()} />);
    await press(t, { id: 'invite-share' });
    expect(spy).toHaveBeenCalledTimes(1);
    expect((spy.mock.calls[0][0] as { message: string }).message).toContain('GHST72');
    spy.mockRestore();
  });
});

describe('MemberSheet', () => {
  it.each(ALL)('%s/%s: name, bike, Verified GPS, Lead, and the public stats', (id, scheme) => {
    useProfileStore.setState({ byId: { ...useProfileStore.getState().byId } });
    const p = profile('meera', 'Meera', 'Interceptor 650', 31, 4210, 2945);
    const t = mount(<MemberSheet visible onClose={jest.fn()} uid="meera" profile={p} role="lead" />, id, scheme);
    const txt = flat(t);
    expect(txt).toContain('Meera');
    expect(txt).toContain('Interceptor 650');
    expect(txt).toContain('VERIFIED GPS');
    expect(txt).toContain('LEAD');
    expect(txt).toContain('4,210');
    expect(txt).toContain('31');
    expect(txt).toContain('95%');
    expect(txt).not.toMatch(/Call|Message/);
  });
  it('no logged rides: no Verified GPS pill and no invented percentage', () => {
    const t = mount(<MemberSheet visible onClose={jest.fn()} uid="zoya" profile={profile('zoya', 'Zoya', 'Duke 390')} />);
    expect(flat(t)).not.toContain('VERIFIED GPS');
    expect(flat(t)).toContain('--');
    expect(flat(t)).not.toContain('LEAD');
  });
  it('shows miles for a rider who prefers them', () => {
    usePrefsStore.setState({ prefs: { ...usePrefsStore.getState().prefs, units: 'mi' } });
    const t = mount(<MemberSheet visible onClose={jest.fn()} uid="meera" profile={profile('meera', 'Meera', 'x', 2, 160.9344, 150)} />);
    expect(flat(t)).toContain('100');
    expect(flat(t).toLowerCase()).toContain('mi logged');
    usePrefsStore.setState({ prefs: { ...usePrefsStore.getState().prefs, units: 'km' } });
  });
});

describe('CrewMenuSheet', () => {
  it('mute is a toggle that reports the new value', async () => {
    const onToggleMute = jest.fn();
    const t = mount(<CrewMenuSheet visible onClose={jest.fn()} crewName="Ghat Ghosts" muted={false} onToggleMute={onToggleMute} />);
    expect(flat(t)).toContain('Mute crew notifications');
    expect(flat(t)).toContain('On this phone only');
    expect(flat(t)).not.toContain('Crew settings');
    await press(t, { id: 'crewmenu-mute' });
    expect(onToggleMute).toHaveBeenCalledWith(true);
  });
  it('Leave asks to confirm first, then calls onLeave once', async () => {
    const onLeave = jest.fn().mockResolvedValue(undefined);
    const t = mount(<CrewMenuSheet visible onClose={jest.fn()} crewName="Ghat Ghosts" onLeave={onLeave} />);
    await press(t, { id: 'crewmenu-leave' });
    expect(onLeave).not.toHaveBeenCalled();
    expect(flat(t)).toContain('Leave Ghat Ghosts?');
    await press(t, { id: 'crewmenu-leave-confirm' });
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
  it('Stay backs out without leaving', async () => {
    const onLeave = jest.fn();
    const t = mount(<CrewMenuSheet visible onClose={jest.fn()} crewName="Ghat Ghosts" onLeave={onLeave} />);
    await press(t, { id: 'crewmenu-leave' });
    await press(t, { id: 'crewmenu-stay' });
    expect(onLeave).not.toHaveBeenCalled();
    expect(flat(t)).toContain('Mute crew notifications');
  });
  it('a failing leave shows the reason inline', async () => {
    const onLeave = jest.fn().mockRejectedValue(new Error("Can't reach the server."));
    const t = mount(<CrewMenuSheet visible onClose={jest.fn()} crewName="Ghat Ghosts" onLeave={onLeave} />);
    await press(t, { id: 'crewmenu-leave' });
    await press(t, { id: 'crewmenu-leave-confirm' });
    expect(flat(t)).toContain("Can't reach the server.");
  });
});

describe('CrewScreen', () => {
  const route = { params: { crewId: 'c1' } } as never;
  const open = (n = nav()) => ({ t: mount(<CrewScreen navigation={n as never} route={route} />), n });

  it.each(ALL)('%s/%s: hero, riders with roles and the you marker', (id, scheme) => {
    const t = mount(<CrewScreen navigation={nav() as never} route={route} />, id, scheme);
    const txt = flat(t);
    expect(txt).toContain('CREW ∙ EST. MARCH');
    expect(txt).toContain('Ghat Ghosts');
    expect(txt).toContain('3 riders');
    expect(txt).not.toContain('km together');
    expect(txt).toContain('Invite riders');
    expect(txt).toContain('Arjun Rao (you)');
    expect(txt).toContain('Interceptor 650');
    expect(txt).toContain('LEAD');
    expect(txt).toContain('SWEEP');
    // me first
    expect(txt.indexOf('Arjun Rao')).toBeLessThan(txt.indexOf('Meera'));
    // no mic / call buttons
    expect(t.root.findAll((n) => n.props.accessibilityLabel && /mic|call/i.test(String(n.props.accessibilityLabel)))).toHaveLength(0);
    const hero = hostById(t, 'crew-hero')[0];
    expect(StyleSheet.flatten(hero.props.style).backgroundColor).toBe(THEMES[id][scheme].ink);
  });

  it('omits the EST. month when the creation time is unknown', () => {
    useCrewsStore.setState({ crews: [crew({ created_ms: null })] });
    const t = mount(<CrewScreen navigation={nav() as never} route={route} />);
    expect(flat(t)).toContain('CREW');
    expect(flat(t)).not.toContain('EST.');
  });

  it('tapping a rider opens the member sheet with their public stats', async () => {
    const { t } = open();
    await press(t, { id: 'rider-meera' });
    expect(hostById(t, 'sheet-Member').length).toBeGreaterThan(0);
    expect(flat(t)).toContain('VERIFIED GPS');
    expect(flat(t)).toContain('4,210');
  });

  it('Invite riders opens the invite sheet with this crew\'s code', async () => {
    const { t } = open();
    await press(t, { id: 'crew-invite' });
    expect(hostById(t, 'sheet-Invite').length).toBeGreaterThan(0);
    expect(flat(t)).toContain('GHST72');
  });

  it('Rides tab: upcoming crew rides first, then my logged rides for this crew -> Recap', async () => {
    useRidesStore.setState({ rides: [ride(), ride({ id: 'r2', crew_id: 'other', name: 'Not mine' })] });
    (subscribeRideLogs as jest.Mock).mockImplementation((_uid: string, on: (l: RideLog[]) => void) => {
      on([log(), log({ ride_id: 'g10', crew_id: 'someone-else', name: 'Other crew ride' }), log({ ride_id: 'g11', crew_id: null, name: 'Solo ride' })]);
      return () => undefined;
    });
    const n = nav();
    const { t } = open(n);
    await press(t, { label: 'Rides' });
    const txt = flat(t);
    expect(txt).toContain('Sunrise Ghat Run');
    expect(txt).toContain('Mulshi loop');
    expect(txt).toContain('84 km');
    expect(txt).toContain('92% together');
    expect(txt).not.toContain('Not mine');
    expect(txt).not.toContain('Other crew ride');
    expect(txt).not.toContain('Solo ride');
    expect(txt.indexOf('Sunrise Ghat Run')).toBeLessThan(txt.indexOf('Mulshi loop'));
    await press(t, { id: 'crew-log-g9' });
    expect(n.navigate).toHaveBeenCalledWith('Recap', { rideId: 'g9' });
  });

  it('a live ride opens Live, a meetup ride opens Meetup', async () => {
    useRidesStore.setState({ rides: [ride({ id: 'live1', status: 'live', name: 'Now' }), ride({ id: 'meet1', status: 'meetup', name: 'Soon' })] });
    const n = nav();
    const { t } = open(n);
    await press(t, { label: 'Rides' });
    await press(t, { id: 'crew-ride-live1' });
    expect(n.navigate).toHaveBeenCalledWith('Live', { groupId: 'live1' });
    await press(t, { id: 'crew-ride-meet1' });
    expect(n.navigate).toHaveBeenCalledWith('Meetup', { groupId: 'meet1' });
  });

  it('Rides tab with nothing: an honest empty state', async () => {
    (subscribeRideLogs as jest.Mock).mockImplementation((_u: string, on: (l: RideLog[]) => void) => {
      on([]);
      return () => undefined;
    });
    const { t } = open();
    await press(t, { label: 'Rides' });
    expect(flat(t)).toContain('No rides yet');
  });

  it('menu -> Leave crew asks first, then leaves, toasts and goes back', async () => {
    svc.leaveCrew.mockResolvedValue(undefined);
    const n = nav();
    const { t } = open(n);
    await press(t, { id: 'crew-menu' });
    await press(t, { id: 'crewmenu-leave' });
    expect(svc.leaveCrew).not.toHaveBeenCalled();
    await press(t, { id: 'crewmenu-leave-confirm' });
    expect(svc.leaveCrew).toHaveBeenCalledWith('c1');
    expect(n.goBack).toHaveBeenCalled();
    expect(useToastStore.getState().toasts.map((x) => x.message)).toContain('You left Ghat Ghosts');
  });

  it('mute is stored per crew on this device', async () => {
    const { t } = open();
    await press(t, { id: 'crew-menu' });
    await press(t, { id: 'crewmenu-mute' });
    expect(useCrewsStore.getState().muted).toEqual({ c1: true });
  });

  it('a crew the store does not have is read once; unknown -> "isn\'t available"', async () => {
    useCrewsStore.setState({ crews: [], loaded: true });
    svc.getCrew.mockResolvedValue(null);
    const { t } = open();
    await flush();
    expect(svc.getCrew).toHaveBeenCalledWith('c1');
    expect(flat(t)).toContain("This crew isn't available");
  });

  it('a crew found by the one-off read is shown', async () => {
    useCrewsStore.setState({ crews: [], loaded: true });
    svc.getCrew.mockResolvedValue(crew({ name: 'Fresh Crew' }));
    const { t } = open();
    await flush();
    expect(flat(t)).toContain('Fresh Crew');
  });
});

describe('JoinScreen', () => {
  const route = (code?: string) => ({ params: code ? { code } : undefined }) as never;
  const typeCode = async (t: ReactTestRenderer, code: string) => {
    for (const ch of code) await press(t, { label: ch });
  };
  const boxes = (t: ReactTestRenderer) => hostById(t, 'join-boxes')[0].props.accessibilityLabel as string;

  it.each(ALL)('%s/%s: six boxes, the demo copy, the letter pad and the Join crew button', (id, scheme) => {
    const t = mount(<JoinScreen navigation={nav() as never} route={route()} />, id, scheme);
    const txt = flat(t);
    expect(txt).toContain('JOIN A CREW');
    expect(txt).toContain('crew code.');
    expect(txt).toContain('Codes are six letters or digits.');
    expect(txt).toContain('Join crew');
    expect(txt).not.toMatch(/GHOST7|wrong code/);
    expect(hostById(t, 'letter-keypad').length).toBeGreaterThan(0);
  });

  it('typing fills the boxes, delete removes, and it stops at six', async () => {
    const t = mount(<JoinScreen navigation={nav() as never} route={route()} />);
    await typeCode(t, 'K4N');
    expect(boxes(t)).toContain('3 of 6');
    await press(t, { label: 'Delete' });
    expect(boxes(t)).toContain('2 of 6');
    await typeCode(t, 'QWERTY');
    expect(boxes(t)).toContain('6 of 6');
  });

  it('prefills from route.params.code (cleaned to the code alphabet)', () => {
    const t = mount(<JoinScreen navigation={nav() as never} route={route('ghst-72x')} />);
    expect(boxes(t)).toContain('6 of 6');
  });

  it('a short code says so and does not call the service', async () => {
    const t = mount(<JoinScreen navigation={nav() as never} route={route()} />);
    await typeCode(t, 'K4N');
    await press(t, { id: 'join-go' });
    expect(flat(t)).toContain('Codes have six characters.');
    expect(svc.joinCrewByCode).not.toHaveBeenCalled();
  });

  it('unknown code: not a crew and not a ride -> the demo message', async () => {
    svc.joinCrewByCode.mockRejectedValue(new crewService.CrewError('not-found', 'x'));
    svc.findRideByCode.mockResolvedValue(null);
    const t = mount(<JoinScreen navigation={nav() as never} route={route('K4N9TZ')} />);
    await press(t, { id: 'join-go' });
    expect(svc.joinCrewByCode).toHaveBeenCalledWith('K4N9TZ');
    expect(flat(t)).toContain('No crew uses K4N9TZ. Check with whoever sent it.');
    expect(mockJoinGroup).not.toHaveBeenCalled();
    // typing again clears the message
    await press(t, { label: 'Delete' });
    expect(flat(t)).not.toContain('No crew uses');
  });

  it('offline: says so instead of "no crew uses"', async () => {
    svc.joinCrewByCode.mockRejectedValue(new crewService.CrewError('network', 'x'));
    const t = mount(<JoinScreen navigation={nav() as never} route={route('K4N9TZ')} />);
    await press(t, { id: 'join-go' });
    expect(flat(t)).toContain("You're offline");
    expect(flat(t)).not.toContain('No crew uses');
  });

  it('crew code: YOU\'RE IN overlay with the real crew, then onboarded + reset to GarageTabs after 2.4 s', async () => {
    jest.useFakeTimers();
    svc.joinCrewByCode.mockResolvedValue(crew());
    svc.getCrewNextRide.mockResolvedValue({ id: 'r1', name: 'Sunrise Ghat Run', start_time_ms: Date.now() + 20 * HOUR });
    const setOnboarded = jest.spyOn(usePrefsStore.getState(), 'setOnboarded').mockResolvedValue(undefined);
    const n = nav();
    const t = mount(<JoinScreen navigation={n as never} route={route('GHST72')} />);
    await press(t, { id: 'join-go' });
    expect(svc.joinCrewByCode).toHaveBeenCalledWith('GHST72');
    expect(hostById(t, 'join-success').length).toBeGreaterThan(0);
    const txt = flat(t);
    expect(txt).toContain("YOU'RE IN");
    expect(txt).toContain('Ghat Ghosts');
    expect(txt).toContain('3 riders');
    expect(txt).toContain('next ride');
    expect(txt).toContain('Sunrise Ghat Run');
    expect(n.reset).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(2300);
    });
    expect(n.reset).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(setOnboarded).toHaveBeenCalledWith(true);
    expect(n.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'GarageTabs' }] });
    setOnboarded.mockRestore();
  });

  it('a crew with no ride yet says so, and tapping skips the wait', async () => {
    svc.joinCrewByCode.mockResolvedValue(crew());
    const setOnboarded = jest.spyOn(usePrefsStore.getState(), 'setOnboarded').mockResolvedValue(undefined);
    const n = nav();
    const t = mount(<JoinScreen navigation={n as never} route={route('GHST72')} />);
    await press(t, { id: 'join-go' });
    expect(flat(t)).toContain('no ride planned yet');
    await press(t, { label: "You're in Ghat Ghosts. Continue" });
    expect(n.reset).toHaveBeenCalledTimes(1);
    await press(t, { label: "You're in Ghat Ghosts. Continue" });
    expect(n.reset).toHaveBeenCalledTimes(1);
    setOnboarded.mockRestore();
  });

  it('falls back to a RIDE code via GroupService.joinGroup', async () => {
    svc.joinCrewByCode.mockRejectedValue(new crewService.CrewError('not-found', 'x'));
    svc.findRideByCode.mockResolvedValue({ id: 'g1', name: 'Sunday Mulshi', member_ids: ['meera'], start_time_ms: Date.now() + 2 * HOUR });
    mockJoinGroup.mockResolvedValue(undefined);
    const setOnboarded = jest.spyOn(usePrefsStore.getState(), 'setOnboarded').mockResolvedValue(undefined);
    const t = mount(<JoinScreen navigation={nav() as never} route={route('RYDE22')} />);
    await press(t, { id: 'join-go' });
    expect(mockJoinGroup).toHaveBeenCalledWith('RYDE22');
    expect(flat(t)).toContain("YOU'RE IN");
    expect(flat(t)).toContain('Sunday Mulshi');
    expect(flat(t)).toContain('2 riders');
    setOnboarded.mockRestore();
  });

  it('a ride-code join that fails shows a retryable message', async () => {
    svc.joinCrewByCode.mockRejectedValue(new crewService.CrewError('not-found', 'x'));
    svc.findRideByCode.mockResolvedValue({ id: 'g1', name: 'Sunday Mulshi', member_ids: [], start_time_ms: null });
    mockJoinGroup.mockRejectedValue(new Error('permission-denied'));
    const t = mount(<JoinScreen navigation={nav() as never} route={route('RYDE22')} />);
    await press(t, { id: 'join-go' });
    expect(flat(t)).toContain("Couldn't join");
    expect(hostById(t, 'join-success')).toHaveLength(0);
  });

  it('back leaves the screen', async () => {
    const n = nav();
    const t = mount(<JoinScreen navigation={n as never} route={route()} />);
    await press(t, { id: 'topbar-back' });
    expect(n.goBack).toHaveBeenCalled();
  });
});
