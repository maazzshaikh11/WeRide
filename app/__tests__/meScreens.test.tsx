/**
 * The Me tab and its sub-screens: Me, Safety, Display, Privacy and the Family / Voice / Permissions sheets.
 * Render under the 4 palettes, every control writes the right pref, real subtitles, navigation, honest copy.
 */
import React from 'react';
import { Alert, Share, StyleSheet, Text } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';

import MeScreen from '../src/screens/garage/MeScreen';
import SafetyScreen from '../src/screens/garage/SafetyScreen';
import DisplayScreen from '../src/screens/garage/DisplayScreen';
import PrivacyScreen from '../src/screens/garage/PrivacyScreen';
import FamilySheet from '../src/sheets/FamilySheet';
import VoicePrefsSheet from '../src/sheets/VoicePrefsSheet';
import PermsSheet from '../src/sheets/PermsSheet';
import { ThemeContext, buildTheme } from '../src/theme/ThemeProvider';
import { THEMES } from '../src/theme/palettes';
import { useThemeStore } from '../src/theme/themeStore';
import { usePrefsStore } from '../src/store/prefsStore';
import { useProfileStore } from '../src/store/profileStore';
import { useToastStore } from '../src/store/toastStore';
import { DEFAULT_PREFS } from '../src/models/domain';
import { useRouteStore } from '@routing/client/routeStore';
import * as perms from '../src/services/permissionsService';
import * as auth from '../src/services/authService';
import * as userService from '../src/services/userService';
import * as navRef from '../src/navigation/navigationRef';
import { APP_VERSION } from '../src/screens/garage/parts/appVersion';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SafeAreaInsetsContext: require('react').createContext(null),
}));
jest.mock('../src/services/permissionsService', () => ({
  getPermissionStatus: jest.fn(),
  requestPermission: jest.fn(),
  openSystemSettings: jest.fn(),
}));
jest.mock('../src/services/authService', () => ({ signOut: jest.fn() }));
jest.mock('../src/navigation/navigationRef', () => ({
  navigationRef: { isReady: jest.fn(() => true) },
  resetRoot: jest.fn(),
}));
jest.mock('../src/sheets/AddContactSheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text: T } = require('react-native');
  return { __esModule: true, default: ({ visible }: { visible: boolean }) => (visible ? <T testID="add-contact-open">add</T> : null) };
});

const mPerms = perms as jest.Mocked<typeof perms>;
const mAuth = auth as jest.Mocked<typeof auth>;
const mNav = navRef as jest.Mocked<typeof navRef>;

const ALL = [['demo', 'light'], ['demo', 'dark'], ['ember', 'light'], ['ember', 'dark']] as const;
const mounted: ReactTestRenderer[] = [];
async function mount(el: React.ReactElement, id: 'demo' | 'ember' = 'demo', scheme: 'light' | 'dark' = 'light') {
  let t!: ReactTestRenderer;
  await act(async () => {
    t = create(<ThemeContext.Provider value={buildTheme(id, THEMES[id][scheme])}>{el}</ThemeContext.Provider>);
  });
  mounted.push(t);
  return t;
}
const texts = (t: ReactTestRenderer) => t.root.findAllByType(Text).map((n) => [n.props.children].flat(3).join(''));
const hasText = (t: ReactTestRenderer, s: string | RegExp) => texts(t).some((x) => (typeof s === 'string' ? x === s : s.test(x)));
const find = (t: ReactTestRenderer, match: string | RegExp) =>
  t.root.findAll((n) => {
    if (typeof n.props.onPress !== 'function') return false;
    const l = n.props.accessibilityLabel ?? n.props.testID;
    return typeof l === 'string' && (typeof match === 'string' ? l === match : match.test(l));
  })[0];
const press = (t: ReactTestRenderer, match: string | RegExp) => {
  const n = find(t, match);
  if (!n) throw new Error(`no pressable ${String(match)}`);
  act(() => { n.props.onPress(); });
};
const pressAsync = async (t: ReactTestRenderer, match: string | RegExp) => {
  const n = find(t, match);
  if (!n) throw new Error(`no pressable ${String(match)}`);
  await act(async () => { await n.props.onPress(); });
};
const hostStyles = (t: ReactTestRenderer) =>
  t.root.findAll((n) => typeof n.type === 'string' && n.props.style).map((n) => StyleSheet.flatten(n.props.style));
const sheetOpen = (t: ReactTestRenderer, id: string) => t.root.findAll((x) => typeof x.type === 'string' && x.props.testID === id).length > 0;
const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), reset: jest.fn() });

const ME = { uid: 'u1', name: 'Arjun Rao', bike: 'Himalayan 450', style: 'Steady' as const, stats: { km: 0, rides: 0, together_sum: 0 } };

beforeEach(() => {
  jest.clearAllMocks();
  mPerms.getPermissionStatus.mockResolvedValue('granted');
  mPerms.requestPermission.mockResolvedValue('granted');
  mPerms.openSystemSettings.mockResolvedValue(undefined);
  mAuth.signOut.mockResolvedValue(undefined);
  (mNav.navigationRef.isReady as jest.Mock).mockReturnValue(true);
  act(() => {
    usePrefsStore.setState({ prefs: { ...DEFAULT_PREFS }, contacts: [], onboarded: true, uid: null });
    useProfileStore.setState({ me: ME, byId: {} });
    useThemeStore.setState({ themeId: 'demo', mode: 'system' });
    useToastStore.setState({ toasts: [] });
    useRouteStore.setState({ currentLocation: null });
  });
});
afterEach(() => mounted.splice(0).forEach((t) => act(() => t.unmount())));

describe('Me', () => {
  it.each(ALL)('%s/%s: plate, sections and rows from real data', async (id, scheme) => {
    act(() => usePrefsStore.setState({ contacts: [{ id: 'c1', name: 'Mom', number: '+919800021034' }] }));
    const t = await mount(<MeScreen navigation={nav()} />, id, scheme);
    expect(hasText(t, 'ACCOUNT')).toBe(true);
    expect(hasText(t, 'Me')).toBe(true);
    expect(hasText(t, 'ARJUN RAO')).toBe(true);
    expect(hasText(t, 'Himalayan 450 · Steady')).toBe(true);
    expect(t.root.findByProps({ testID: 'weride-logo' })).toBeTruthy();
    for (const s of ['SOS & emergency', 'Family sharing', 'Road screen & controls', 'Voice & signals', 'Privacy & learning', 'Permissions', 'Replay onboarding', 'Sign out']) {
      expect(hasText(t, s)).toBe(true);
    }
    expect(hasText(t, '1 contact · crash detection on')).toBe(true);
    expect(hasText(t, 'Sunset auto theme · glove mode off')).toBe(true);
    expect(hasText(t, 'All set')).toBe(true);
    // the plate is always road-sign yellow, the sign-out title uses the theme's `bad`
    expect(hostStyles(t).some((s) => s.backgroundColor === '#FFC20E' && s.borderRadius === 18)).toBe(true);
    const out = t.root.findAllByType(Text).find((n) => [n.props.children].flat().join('') === 'Sign out')!;
    expect(StyleSheet.flatten(out.props.style).color).toBe(THEMES[id][scheme].bad);
  });

  it('footer is WeRide + the package.json version, no prototype text', async () => {
    const t = await mount(<MeScreen navigation={nav()} />);
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
    expect(hasText(t, `WeRide ${APP_VERSION}`)).toBe(true);
    expect(texts(t).join(' ')).not.toMatch(/prototype|fictional/i);
  });

  it('subtitles follow the prefs and contacts', async () => {
    act(() => usePrefsStore.setState({ prefs: { ...DEFAULT_PREFS, road: 'night', glove: true, crash: false }, contacts: [] }));
    const t = await mount(<MeScreen navigation={nav()} />);
    expect(hasText(t, '0 contacts · crash detection off')).toBe(true);
    expect(hasText(t, 'Night theme · glove mode on')).toBe(true);
    act(() => usePrefsStore.setState({ prefs: { ...DEFAULT_PREFS, road: 'day' }, contacts: [{ id: 'a', name: 'A', number: '+911' }, { id: 'b', name: 'B', number: '+912' }] }));
    expect(hasText(t, '2 contacts · crash detection on')).toBe(true);
    expect(hasText(t, 'Day theme · glove mode off')).toBe(true);
  });

  it('permissions subtitle comes from the real OS status', async () => {
    mPerms.getPermissionStatus.mockImplementation(async (k) => (k === 'notifications' ? 'denied' : 'granted'));
    const t = await mount(<MeScreen navigation={nav()} />);
    expect(hasText(t, 'Needs attention')).toBe(true);
    expect(hasText(t, 'All set')).toBe(false);
  });

  it('a missing profile shows no invented name', async () => {
    act(() => useProfileStore.setState({ me: null }));
    const t = await mount(<MeScreen navigation={nav()} />);
    expect(hasText(t, 'RIDER')).toBe(true);
    expect(texts(t).join(' ')).not.toMatch(/Arjun|Himalayan/);
  });

  it('rows navigate: Safety, Display, Privacy; sheets open for family, voice and permissions', async () => {
    const n = nav();
    const t = await mount(<MeScreen navigation={n} />);
    press(t, /^SOS & emergency/);
    press(t, /^Road screen & controls/);
    press(t, /^Privacy & learning/);
    expect(n.navigate.mock.calls.map((c) => c[0])).toEqual(['Safety', 'Display', 'Privacy']);

    expect(sheetOpen(t, 'sheet-Family')).toBe(false);
    press(t, /^Family sharing/);
    expect(sheetOpen(t, 'sheet-Family')).toBe(true);
    await pressAsync(t, 'Close sheet');
    press(t, /^Voice & signals/);
    expect(sheetOpen(t, 'sheet-VoicePrefs')).toBe(true);
    await pressAsync(t, 'Close sheet');
    await pressAsync(t, /^Permissions/);
    expect(sheetOpen(t, 'sheet-Perms')).toBe(true);
  });

  it('Replay onboarding clears onboarded then resets to Promise', async () => {
    const t = await mount(<MeScreen navigation={nav()} />);
    await pressAsync(t, /^Replay onboarding/);
    expect(usePrefsStore.getState().onboarded).toBe(false);
    expect(mNav.resetRoot).toHaveBeenCalledWith('Promise');
  });

  it('Sign out calls authService.signOut then resets to Splash', async () => {
    const t = await mount(<MeScreen navigation={nav()} />);
    await pressAsync(t, 'Sign out');
    expect(mAuth.signOut).toHaveBeenCalledTimes(1);
    expect(mNav.resetRoot).toHaveBeenCalledWith('Splash');
    expect(useToastStore.getState().toasts.map((x) => x.message)).toContain('Signed out');
  });

  it('a failed sign-out stays put and says so', async () => {
    mAuth.signOut.mockRejectedValueOnce(new Error('offline'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const t = await mount(<MeScreen navigation={nav()} />);
    await pressAsync(t, 'Sign out');
    expect(mNav.resetRoot).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts.some((x) => x.variant === 'error')).toBe(true);
    warn.mockRestore();
  });

  it('falls back to the screen navigation when the root ref is not ready', async () => {
    (mNav.navigationRef.isReady as jest.Mock).mockReturnValue(false);
    const n = nav();
    const t = await mount(<MeScreen navigation={n} />);
    await pressAsync(t, 'Sign out');
    expect(n.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Splash' }] });
  });
});

describe('Safety', () => {
  it.each(ALL)('%s/%s: how SOS works card, contacts, triggers, hold time, drill', async (id, scheme) => {
    act(() => usePrefsStore.setState({ contacts: [{ id: 'c1', name: 'Mom', number: '+919800021034' }] }));
    const t = await mount(<SafetyScreen navigation={nav()} />, id, scheme);
    expect(hasText(t, 'How SOS works')).toBe(true);
    expect(hasText(t, 'Hold for 1.5 s')).toBe(true);
    expect(hasText(t, /ready-to-send text with your live location/)).toBe(true);
    expect(texts(t).join(' ')).not.toMatch(/SMS to your contacts|Sent instantly/);
    expect(hasText(t, 'Mom')).toBe(true);
    expect(hasText(t, '+919800021034')).toBe(true);
    expect(hasText(t, 'Crash detection')).toBe(true);
    expect(hasText(t, 'Run an SOS drill')).toBe(true);
    expect(hostStyles(t).some((s) => s.backgroundColor === THEMES[id][scheme].ink && s.borderRadius === 22)).toBe(true);
  });

  it('hold time text follows prefs', async () => {
    act(() => usePrefsStore.setState({ prefs: { ...DEFAULT_PREFS, hold_ms: 2000 } }));
    const t = await mount(<SafetyScreen navigation={nav()} />);
    expect(hasText(t, 'Hold for 2.0 s')).toBe(true);
  });

  it('crash toggle writes prefs.crash', async () => {
    const t = await mount(<SafetyScreen navigation={nav()} />);
    press(t, 'Crash detection');
    expect(usePrefsStore.getState().prefs.crash).toBe(false);
    press(t, 'Crash detection');
    expect(usePrefsStore.getState().prefs.crash).toBe(true);
  });

  it.each([['1.0 s', 1000], ['2.0 s', 2000]] as const)('hold segment %s writes hold_ms and toasts', async (label, ms) => {
    const t = await mount(<SafetyScreen navigation={nav()} />);
    press(t, label);
    expect(usePrefsStore.getState().prefs.hold_ms).toBe(ms);
    expect(useToastStore.getState().toasts.map((x) => x.message)).toContain(`SOS hold set to ${(ms / 1000).toFixed(1)} s`);
  });

  it('delete asks first, then removes the contact', async () => {
    act(() => usePrefsStore.setState({ contacts: [{ id: 'c1', name: 'Mom', number: '+911' }, { id: 'c2', name: 'Dad', number: '+912' }] }));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const t = await mount(<SafetyScreen navigation={nav()} />);
    press(t, 'Remove Mom');
    expect(usePrefsStore.getState().contacts).toHaveLength(2); // nothing yet
    const buttons = alert.mock.calls[0][2]!;
    expect(alert.mock.calls[0][0]).toBe('Remove Mom?');
    await act(async () => { buttons.find((b) => b.text === 'Cancel')!.onPress?.(); });
    expect(usePrefsStore.getState().contacts).toHaveLength(2);
    await act(async () => { buttons.find((b) => b.text === 'Remove')!.onPress?.(); });
    expect(usePrefsStore.getState().contacts.map((c) => c.id)).toEqual(['c2']);
    alert.mockRestore();
  });

  it('Add a contact opens the sheet; the drill opens Drill from settings; back goes back', async () => {
    const n = nav();
    const t = await mount(<SafetyScreen navigation={n} />);
    expect(t.root.findAll((x) => x.props.testID === 'add-contact-open')).toHaveLength(0);
    press(t, 'Add a contact');
    expect(t.root.findAll((x) => x.props.testID === 'add-contact-open').length).toBeGreaterThan(0);
    press(t, 'Run an SOS drill');
    expect(n.navigate).toHaveBeenCalledWith('Drill', { fromSettings: true });
    press(t, 'Back');
    expect(n.goBack).toHaveBeenCalled();
  });

  it('no contacts: just the add row', async () => {
    const t = await mount(<SafetyScreen navigation={nav()} />);
    expect(hasText(t, 'Add a contact')).toBe(true);
    expect(find(t, /^Remove /)).toBeUndefined();
  });
});

describe('Display', () => {
  it.each(ALL)('%s/%s: every control, no spoken alerts, no preview', async (id, scheme) => {
    const t = await mount(<DisplayScreen navigation={nav()} />, id, scheme);
    for (const s of ['GARAGE THEME', 'THEME', 'ROAD THEME', 'UNITS', 'Glove mode', 'Light', 'Dark', 'Auto', 'Demo', 'Ember', 'Night', 'Day', 'Sunset auto', 'Kilometres', 'Miles', 'Design rules for the Road screen', 'Nothing under 24 pt']) {
      expect(hasText(t, s)).toBe(true);
    }
    expect(texts(t).join(' ')).not.toMatch(/Spoken alerts|Preview Road/);
    expect(t.root.findByProps({ testID: 'rail' })).toBeTruthy();
  });

  it('garage theme segmented writes themeStore.mode (Auto = system)', async () => {
    const t = await mount(<DisplayScreen navigation={nav()} />);
    expect(useThemeStore.getState().mode).toBe('system');
    press(t, 'Light');
    expect(useThemeStore.getState().mode).toBe('light');
    press(t, 'Dark');
    expect(useThemeStore.getState().mode).toBe('dark');
    press(t, 'Auto');
    expect(useThemeStore.getState().mode).toBe('system');
  });

  it('theme segmented writes themeStore.themeId and previews it', async () => {
    const t = await mount(<DisplayScreen navigation={nav()} />);
    expect(t.root.findAll((x) => x.props.testID === 'swatch-demo').length).toBeGreaterThan(0);
    press(t, 'Ember');
    expect(useThemeStore.getState().themeId).toBe('ember');
    press(t, 'Demo');
    expect(useThemeStore.getState().themeId).toBe('demo');
  });

  it.each([['Night', 'night'], ['Day', 'day'], ['Sunset auto', 'auto']] as const)('road theme %s writes prefs.road=%s', async (label, value) => {
    act(() => usePrefsStore.setState({ prefs: { ...DEFAULT_PREFS, road: value === 'night' ? 'day' : 'night' } }));
    const t = await mount(<DisplayScreen navigation={nav()} />);
    press(t, label);
    expect(usePrefsStore.getState().prefs.road).toBe(value);
  });

  it('glove mode toggles prefs.glove and toasts', async () => {
    const t = await mount(<DisplayScreen navigation={nav()} />);
    press(t, 'Glove mode');
    expect(usePrefsStore.getState().prefs.glove).toBe(true);
    expect(useToastStore.getState().toasts.map((x) => x.message)).toContain('Glove mode on');
    press(t, 'Glove mode');
    expect(usePrefsStore.getState().prefs.glove).toBe(false);
  });

  it('units segmented writes prefs.units', async () => {
    const t = await mount(<DisplayScreen navigation={nav()} />);
    press(t, 'Miles');
    expect(usePrefsStore.getState().prefs.units).toBe('mi');
    press(t, 'Kilometres');
    expect(usePrefsStore.getState().prefs.units).toBe('km');
  });

  it('every Display pref is persisted through the prefs store (synced for a signed-in rider)', async () => {
    const save = jest.spyOn(userService, 'savePrefs').mockResolvedValue(undefined as any);
    act(() => usePrefsStore.setState({ uid: 'u1' }));
    const t = await mount(<DisplayScreen navigation={nav()} />);
    await pressAsync(t, 'Miles');
    await pressAsync(t, 'Glove mode');
    await pressAsync(t, 'Day');
    expect(save.mock.calls).toEqual([
      ['u1', { units: 'mi' }],
      ['u1', { glove: true }],
      ['u1', { road: 'day' }],
    ]);
    save.mockRestore();
  });

  it('reflects the stored choices as selected', async () => {
    act(() => {
      usePrefsStore.setState({ prefs: { ...DEFAULT_PREFS, road: 'day', units: 'mi', glove: true } });
      useThemeStore.setState({ mode: 'dark', themeId: 'ember' });
    });
    const t = await mount(<DisplayScreen navigation={nav()} />);
    const selected = (label: string) =>
      t.root.findAll((n) => typeof n.type === 'string' && n.props.accessibilityRole === 'radio' && n.props.accessibilityLabel === label)[0].props.accessibilityState.selected;
    expect(selected('Dark')).toBe(true);
    expect(selected('Light')).toBe(false);
    expect(selected('Ember')).toBe(true);
    expect(selected('Day')).toBe(true);
    expect(selected('Miles')).toBe(true);
    const glove = t.root.findAll((n) => typeof n.type === 'string' && n.props.accessibilityLabel === 'Glove mode')[0];
    expect(glove.props.accessibilityState.checked).toBe(true);
  });
});

describe('Privacy', () => {
  it.each(ALL)('%s/%s: diagram, learn toggle, share control, dot legend', async (id, scheme) => {
    const t = await mount(<PrivacyScreen navigation={nav()} />, id, scheme);
    for (const s of ['Your phone', 'Masked update', 'Shared model', 'Improve ETAs for everyone', 'Crew only', 'Crew + family', 'Verified', 'Stale', 'Unverified']) {
      expect(hasText(t, s)).toBe(true);
    }
    expect(hasText(t, 'WHO SEES MY LIVE POSITION')).toBe(true);
    expect(hasText(t, 'HOW WE KNOW A DOT IS REAL')).toBe(true);
    expect(hasText(t, /not available yet/)).toBe(true);
    const p = THEMES[id][scheme];
    const dots = hostStyles(t).filter((s) => s.width === 22 && s.height === 22 && s.borderRadius === 11).map((s) => s.backgroundColor);
    expect(dots).toEqual([p.ok, p.pri, p.bad]);
  });

  it('learn toggle writes prefs.learn and the sub line says what is real', async () => {
    const t = await mount(<PrivacyScreen navigation={nav()} />);
    expect(hasText(t, 'Shares masked numbers only, never routes')).toBe(true);
    expect(texts(t).join(' ')).not.toMatch(/Round 14|38 riders/);
    press(t, 'Improve ETAs for everyone');
    expect(usePrefsStore.getState().prefs.learn).toBe(false);
    expect(hasText(t, 'Off. Nothing is shared for learning.')).toBe(true);
    press(t, 'Improve ETAs for everyone');
    expect(usePrefsStore.getState().prefs.learn).toBe(true);
  });

  it('Crew + family is disabled and cannot be chosen; Crew only is selected', async () => {
    const t = await mount(<PrivacyScreen navigation={nav()} />);
    const crew = t.root.findAll((n) => typeof n.type === 'string' && n.props.accessibilityLabel === 'Crew only')[0];
    const family = t.root.findAll((n) => typeof n.type === 'string' && /^Crew plus family/.test(n.props.accessibilityLabel ?? ''))[0];
    expect(crew.props.accessibilityState.selected).toBe(true);
    expect(family.props.accessibilityState).toMatchObject({ selected: false, disabled: true });
    expect(family.props.onPress).toBeUndefined();
    expect(usePrefsStore.getState().prefs.share).toBe('crew');
  });

  it('back goes back', async () => {
    const n = nav();
    const t = await mount(<PrivacyScreen navigation={n} />);
    press(t, 'Back');
    expect(n.goBack).toHaveBeenCalled();
  });
});

describe('FamilySheet', () => {
  const share = jest.spyOn(Share, 'share');
  beforeEach(() => share.mockReset());

  it.each(ALL)('%s/%s: honest copy, no watchers or toggles', async (id, scheme) => {
    const t = await mount(<FamilySheet visible onClose={jest.fn()} />, id, scheme);
    expect(hasText(t, 'FAMILY SHARING')).toBe(true);
    expect(hasText(t, /Live family links aren't available yet/)).toBe(true);
    expect(texts(t).join(' ')).not.toMatch(/Mom|Priya|follow link/);
    expect(t.root.findAll((n) => n.props.accessibilityRole === 'switch')).toHaveLength(0);
  });

  it('Send my location shares a map pin of the verified fix', async () => {
    share.mockResolvedValue({ action: Share.sharedAction } as any);
    act(() => useRouteStore.setState({ currentLocation: { lat: 18.52, lng: 73.85 } as any }));
    const t = await mount(<FamilySheet visible onClose={jest.fn()} />);
    await pressAsync(t, 'Send my location');
    expect(share).toHaveBeenCalledTimes(1);
    expect((share.mock.calls[0][0] as any).message).toContain('query=18.520000,73.850000');
  });

  it('without a fix it asks the rider to wait instead of sharing nothing', async () => {
    const t = await mount(<FamilySheet visible onClose={jest.fn()} />);
    await pressAsync(t, 'Send my location');
    expect(share).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts[0].variant).toBe('warn');
  });

  it('a failing share sheet is reported', async () => {
    share.mockRejectedValue(new Error('x'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    act(() => useRouteStore.setState({ currentLocation: { lat: 1, lng: 2 } as any }));
    const t = await mount(<FamilySheet visible onClose={jest.fn()} />);
    await pressAsync(t, 'Send my location');
    expect(useToastStore.getState().toasts[0].variant).toBe('error');
    warn.mockRestore();
  });
});

describe('VoicePrefsSheet', () => {
  it.each(ALL)('%s/%s: only real things, no spoken-alerts toggle', async (id, scheme) => {
    const t = await mount(<VoicePrefsSheet visible onClose={jest.fn()} />, id, scheme);
    expect(hasText(t, 'Voice & signals')).toBe(true);
    expect(hasText(t, 'Push-to-talk with crew')).toBe(true);
    expect(hasText(t, 'Hold the mic on the live screen')).toBe(true);
    expect(hasText(t, /Audio between riders isn't live yet/)).toBe(true);
    expect(hasText(t, 'Spoken alerts')).toBe(false);
    expect(t.root.findAll((n) => n.props.accessibilityRole === 'switch')).toHaveLength(0);
  });
});

describe('PermsSheet', () => {
  it.each(ALL)('%s/%s: three rows with the real status', async (id, scheme) => {
    mPerms.getPermissionStatus.mockImplementation(async (k) => (k === 'location' ? 'granted' : k === 'notifications' ? 'denied' : 'undetermined'));
    const t = await mount(<PermsSheet visible onClose={jest.fn()} />, id, scheme);
    expect(hasText(t, 'Location')).toBe(true);
    expect(hasText(t, 'Allowed')).toBe(true);
    expect(hasText(t, 'Notifications')).toBe(true);
    expect(hasText(t, 'Not allowed')).toBe(true);
    expect(hasText(t, 'Microphone')).toBe(true);
    expect(hasText(t, 'Off · optional · tap to allow')).toBe(true);
  });

  it('only a never-asked row is tappable, and it requests that permission then refreshes', async () => {
    let mic: perms.PermStatus = 'undetermined';
    mPerms.getPermissionStatus.mockImplementation(async (k) => (k === 'microphone' ? mic : 'granted'));
    mPerms.requestPermission.mockImplementation(async () => { mic = 'granted'; return 'granted'; });
    const onChanged = jest.fn();
    const t = await mount(<PermsSheet visible onClose={jest.fn()} onChanged={onChanged} />);
    expect(find(t, /^Location/)).toBeUndefined();
    await pressAsync(t, /^Microphone/);
    expect(mPerms.requestPermission).toHaveBeenCalledWith('microphone', undefined);
    expect(onChanged).toHaveBeenCalled();
    expect(find(t, /^Microphone/)).toBeUndefined(); // granted now: no longer a request row
  });

  it('location is requested for Always', async () => {
    mPerms.getPermissionStatus.mockResolvedValue('undetermined');
    const t = await mount(<PermsSheet visible onClose={jest.fn()} />);
    await pressAsync(t, /^Location/);
    expect(mPerms.requestPermission).toHaveBeenCalledWith('location', { always: true });
  });

  it('Open system settings calls the service and closes', async () => {
    const onClose = jest.fn();
    const t = await mount(<PermsSheet visible onClose={onClose} />);
    await pressAsync(t, 'Open system settings');
    expect(mPerms.openSystemSettings).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  it('blocked permissions are not askable', async () => {
    mPerms.getPermissionStatus.mockResolvedValue('blocked');
    const t = await mount(<PermsSheet visible onClose={jest.fn()} />);
    expect(find(t, /^Location/)).toBeUndefined();
    expect(hasText(t, 'Not allowed')).toBe(true);
  });
});
