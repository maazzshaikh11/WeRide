/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories need require */
/**
 * Profile: name, bike chips, riding-style segmented, live yellow rider plate, prefill, save + Continue.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { act } from 'react-test-renderer';
import { BIKES } from '../src/models/domain';
import { Plates, THEMES } from '../src/theme/palettes';
import { useProfileStore } from '../src/store/profileStore';
import { useSessionStore } from '../src/store/sessionStore';
import { ALL_PALETTES, byLabel, byTestId, hasText, hasTestId, hostById, hostStyles, isDisabled, mount, press, pressId, texts, typeInto, unmountAll } from './onboardingTestUtils';

const mockSaveProfile = jest.fn();
jest.mock('../src/services/userService', () => ({
  ...jest.requireActual('../src/services/userService'),
  saveProfile: (...a: unknown[]) => mockSaveProfile(...a),
}));
jest.mock('react-native-safe-area-context', () => require('./onboardingTestUtils').safeAreaMock());

import ProfileScreen, { SAVE_WAIT_MS } from '../src/screens/onboarding/ProfileScreen';

const nav = () => ({ navigate: jest.fn(), goBack: jest.fn() });
const me = (over: object = {}) => ({ uid: 'u1', name: 'Arjun Rao', bike: 'Duke 390', style: 'Spirited' as const, stats: { km: 0, rides: 0, together_sum: 0 }, ...over });

beforeEach(() => {
  mockSaveProfile.mockReset().mockResolvedValue(undefined);
  useSessionStore.setState({ uid: 'u1', authKnown: true });
  useProfileStore.setState({ me: null, byId: {} });
});
afterEach(unmountAll);

describe('ProfileScreen', () => {
  it.each(ALL_PALETTES)('%s/%s: palette, step 3 of 5, chips, segmented and the yellow rider plate with the real logo', (id, scheme) => {
    const t = mount(<ProfileScreen navigation={nav()} />, id, scheme);
    const p = THEMES[id][scheme];
    expect(StyleSheet.flatten(hostById(t, 'screen-Profile').props.style).backgroundColor).toBe(p.bg);
    expect(byTestId(t, 'stepper').props.accessibilityLabel).toBe('Step 3 of 5');
    expect(hasText(t, "Who's riding?")).toBe(true);
    for (const b of BIKES) expect(hasText(t, b)).toBe(true);
    for (const s of ['Relaxed', 'Steady', 'Spirited']) expect(hasText(t, s)).toBe(true);
    // selected bike chip is an ink pill
    const on = hostStyles(t).filter((s) => s.backgroundColor === p.ink && s.minHeight === 44);
    expect(on).toHaveLength(1);
    // plate: road yellow in every theme, the real logo inside
    expect(hostStyles(t).some((s) => s.backgroundColor === Plates.yellow.bg && s.borderRadius === 18)).toBe(true);
    expect(hasTestId(t, 'weride-logo')).toBe(true);
    expect(hasText(t, 'RIDER PLATE')).toBe(true);
  });

  it('starts with the demo defaults (Himalayan 450, Steady) and Continue disabled until a name is typed', () => {
    const t = mount(<ProfileScreen navigation={nav()} />);
    expect(byLabel(t, 'Himalayan 450').props.accessibilityState.selected).toBe(true);
    expect(byLabel(t, 'Steady').props.accessibilityState.selected).toBe(true);
    expect(byTestId(t, 'plate-name').props.children).toBe('RIDER');
    expect(isDisabled(byTestId(t, 'profile-continue'))).toBe(true);
  });

  it('the plate follows the name, bike and style live', async () => {
    const t = mount(<ProfileScreen navigation={nav()} />);
    typeInto(t, 'Name input', 'Meera Iyer');
    await press(t, 'Interceptor 650');
    await press(t, 'Spirited');
    expect(byTestId(t, 'plate-name').props.children).toBe('MEERA IYER');
    expect(byTestId(t, 'plate-sub').props.children).toBe('Interceptor 650 ∙ Spirited');
    expect(byLabel(t, 'Interceptor 650').props.accessibilityState.selected).toBe(true);
    expect(byLabel(t, 'Himalayan 450').props.accessibilityState.selected).toBe(false);
  });

  it('limits the name to 24 characters', () => {
    const t = mount(<ProfileScreen navigation={nav()} />);
    expect(byLabel(t, 'Name input').props.maxLength).toBe(24);
  });

  it('is prefilled from the saved profile', () => {
    useProfileStore.setState({ me: me() });
    const t = mount(<ProfileScreen navigation={nav()} />);
    expect(byLabel(t, 'Name input').props.value).toBe('Arjun Rao');
    expect(byLabel(t, 'Duke 390').props.accessibilityState.selected).toBe(true);
    expect(byLabel(t, 'Spirited').props.accessibilityState.selected).toBe(true);
    expect(isDisabled(byTestId(t, 'profile-continue'))).toBe(false);
  });

  it('a profile that arrives after the screen opened fills the form, but never overwrites typing', async () => {
    const t = mount(<ProfileScreen navigation={nav()} />);
    await act(async () => { useProfileStore.setState({ me: me() }); });
    expect(byLabel(t, 'Name input').props.value).toBe('Arjun Rao');
    typeInto(t, 'Name input', 'Typed');
    await act(async () => { useProfileStore.setState({ me: me({ name: 'Server Name' }) }); });
    expect(byLabel(t, 'Name input').props.value).toBe('Typed');
  });

  it('a bike that is not a chip is kept and shown under "Other"', () => {
    useProfileStore.setState({ me: me({ bike: 'Royal Enfield GT' }) });
    const t = mount(<ProfileScreen navigation={nav()} />);
    expect(byLabel(t, 'Other').props.accessibilityState.selected).toBe(true);
    expect(byTestId(t, 'plate-sub').props.children).toBe('Royal Enfield GT ∙ Spirited');
  });

  it('Continue saves users/{uid} through userService and opens Perms', async () => {
    const n = nav();
    const t = mount(<ProfileScreen navigation={n} />);
    typeInto(t, 'Name input', '  Meera Iyer ');
    await press(t, 'Meteor 350');
    await press(t, 'Relaxed');
    await pressId(t, 'profile-continue');
    expect(mockSaveProfile).toHaveBeenCalledWith('u1', { name: 'Meera Iyer', bike: 'Meteor 350', style: 'Relaxed' });
    expect(n.navigate).toHaveBeenCalledWith('Perms');
  });

  it('a failed save shows the error live and stays on the screen', async () => {
    mockSaveProfile.mockRejectedValue(new Error('permission-denied'));
    const n = nav();
    const t = mount(<ProfileScreen navigation={n} />);
    typeInto(t, 'Name input', 'Meera');
    await pressId(t, 'profile-continue');
    expect(byTestId(t, 'profile-error').props.accessibilityLiveRegion).toBe('polite');
    expect(hasText(t, 'Could not save your profile.')).toBe(true);
    expect(n.navigate).not.toHaveBeenCalled();
  });

  it('signed out: asks to sign in again and saves nothing', async () => {
    useSessionStore.setState({ uid: null });
    const n = nav();
    const t = mount(<ProfileScreen navigation={n} />);
    typeInto(t, 'Name input', 'Meera');
    await pressId(t, 'profile-continue');
    expect(mockSaveProfile).not.toHaveBeenCalled();
    expect(hasText(t, 'You are signed out.')).toBe(true);
  });

  it('an offline save (never acknowledged) does not trap the rider: it moves on after a wait', async () => {
    jest.useFakeTimers();
    try {
      mockSaveProfile.mockReturnValue(new Promise(() => undefined));
      const n = nav();
      const t = mount(<ProfileScreen navigation={n} />);
      typeInto(t, 'Name input', 'Meera');
      let p: Promise<void> = Promise.resolve();
      act(() => { p = byTestId(t, 'profile-continue').props.onPress({ nativeEvent: {} }); });
      expect(n.navigate).not.toHaveBeenCalled();
      await act(async () => { jest.advanceTimersByTime(SAVE_WAIT_MS); await p; });
      expect(n.navigate).toHaveBeenCalledWith('Perms');
    } finally {
      jest.useRealTimers();
    }
  });

  it('back goes back; no stray texts like demo names', async () => {
    const n = nav();
    const t = mount(<ProfileScreen navigation={n} />);
    await press(t, 'Back');
    expect(n.goBack).toHaveBeenCalled();
    expect(texts(t).join(' ')).not.toContain('Arjun');
  });
});
