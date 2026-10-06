/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories need require */
/**
 * Splash (brand plate, 2.3 s → Promise) and Promise (three proofs, routes to sign-in or Profile).
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { act } from 'react-test-renderer';
import SplashScreen, { SPLASH_MS } from '../src/screens/onboarding/SplashScreen';
import PromiseScreen, { PROOFS } from '../src/screens/onboarding/PromiseScreen';
import { Plates, THEMES } from '../src/theme/palettes';
import { useSessionStore } from '../src/store/sessionStore';
import { ALL_PALETTES, hostById, hasText, hasTestId, hostStyles, mount, pressId, texts, unmountAll } from './onboardingTestUtils';

jest.mock('react-native-safe-area-context', () => require('./onboardingTestUtils').safeAreaMock());

beforeEach(() => {
  jest.useFakeTimers();
  useSessionStore.setState({ uid: null, authKnown: true });
});
afterEach(() => {
  unmountAll();
  jest.useRealTimers();
});

describe('SplashScreen', () => {
  it.each(ALL_PALETTES)('%s/%s: dark whatever the garage mode, real logo, wordmark and tagline', (id, scheme) => {
    const t = mount(<SplashScreen navigation={{ replace: jest.fn() }} />, id, scheme);
    expect(StyleSheet.flatten(hostById(t, 'screen-Splash').props.style).backgroundColor).toBe(THEMES[id].dark.bg);
    expect(hasTestId(t, 'weride-logo')).toBe(true);
    expect(hasTestId(t, 'moving-dashes')).toBe(true);
    expect(texts(t)).toEqual(expect.arrayContaining(['WeRide', 'EVERYONE HOME']));
  });

  it('the logo sits on the road-yellow plate tile', () => {
    const t = mount(<SplashScreen navigation={{ replace: jest.fn() }} />);
    expect(hostStyles(t).some((s) => s.backgroundColor === Plates.yellow.bg && s.width === 116)).toBe(true);
  });

  it('replaces itself with Promise after 2.3 s, exactly once', () => {
    const replace = jest.fn();
    mount(<SplashScreen navigation={{ replace }} />);
    act(() => { jest.advanceTimersByTime(SPLASH_MS - 1); });
    expect(replace).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(1); });
    expect(replace).toHaveBeenCalledWith('Promise');
    act(() => { jest.advanceTimersByTime(5000); });
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('leaving early cancels the timer', () => {
    const replace = jest.fn();
    const t = mount(<SplashScreen navigation={{ replace }} />);
    act(() => t.unmount());
    act(() => { jest.advanceTimersByTime(SPLASH_MS * 2); });
    expect(replace).not.toHaveBeenCalled();
  });
});

describe('PromiseScreen', () => {
  it.each(ALL_PALETTES)('%s/%s: dark page, the headline and the three proofs with the demo copy', (id, scheme) => {
    const t = mount(<PromiseScreen navigation={{ navigate: jest.fn() }} />, id, scheme);
    expect(StyleSheet.flatten(hostById(t, 'screen-Promise').props.style).backgroundColor).toBe(THEMES[id].dark.bg);
    expect(hasText(t, 'Ride together.')).toBe(true);
    expect(hasText(t, 'Everyone home.')).toBe(true);
    expect(PROOFS).toHaveLength(3);
    for (const p of PROOFS) {
      expect(hasText(t, p.title)).toBe(true);
      expect(hasText(t, p.body)).toBe(true);
    }
    expect(texts(t)).toEqual(expect.arrayContaining(['1', '2', '3']));
    // "Everyone home." is the accent
    const accent = t.root.findAll((n) => typeof n.type !== 'string' && n.props.children === 'Everyone home.' && n.props.style?.color);
    expect(accent[0].props.style.color).toBe(THEMES[id].dark.pri);
  });

  it('numbers are yellow rotated squares on a dashed rail', () => {
    const t = mount(<PromiseScreen navigation={{ navigate: jest.fn() }} />);
    const squares = hostStyles(t).filter((s) => s.backgroundColor === Plates.yellow.bg && s.width === 44);
    expect(squares).toHaveLength(3);
    expect(squares[0].transform).toEqual([{ rotate: '45deg' }, { scale: 0.82 }]);
    expect(hasTestId(t, 'vdashes')).toBe(true);
  });

  it('"Get started" and "I have a crew code" both go to AuthPhone when signed out', async () => {
    const navigate = jest.fn();
    const t = mount(<PromiseScreen navigation={{ navigate }} />);
    await pressId(t, 'promise-start');
    await pressId(t, 'promise-code');
    expect(navigate.mock.calls).toEqual([['AuthPhone'], ['AuthPhone']]);
  });

  it('a rider who is already signed in goes straight to Profile (Replay onboarding)', async () => {
    useSessionStore.setState({ uid: 'u1' });
    const navigate = jest.fn();
    const t = mount(<PromiseScreen navigation={{ navigate }} />);
    await pressId(t, 'promise-start');
    await pressId(t, 'promise-code');
    expect(navigate.mock.calls).toEqual([['Profile'], ['Profile']]);
  });

  it('the buttons are labelled for screen readers', () => {
    const t = mount(<PromiseScreen navigation={{ navigate: jest.fn() }} />);
    const labels = t.root.findAll((n) => typeof n.props.onPress === 'function').map((n) => n.props.accessibilityLabel);
    expect(labels).toEqual(expect.arrayContaining(['Get started', 'I have a crew code']));
  });
});
