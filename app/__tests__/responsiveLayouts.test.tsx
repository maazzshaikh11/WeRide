/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories need require */
/**
 * Whole screens rendered at compact / short / tablet window sizes (useWindowDimensions mocked): they must render, sit in
 * the centred column on tablets, use the compact gutter, keep every scroller and keep their text policy. Pixel-level
 * clipping / overlap / touch-target checks run in a browser engine (scripts/screenshots/matrix.sh, docs/RESPONSIVE.md).
 */
const mockDims = { width: 390, height: 844, fontScale: 1, scale: 2 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims }));
jest.mock('react-native-safe-area-context', () => require('./onboardingTestUtils').safeAreaMock());
jest.mock('react-native-mmkv', () => ({ MMKV: jest.fn().mockImplementation(() => ({ getString: jest.fn(), set: jest.fn(), delete: jest.fn() })) }));
jest.mock('../src/services/userService', () => ({ ...jest.requireActual('../src/services/userService'), saveContacts: jest.fn().mockResolvedValue(undefined) }));

import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import PromiseScreen from '../src/screens/onboarding/PromiseScreen';
import SplashScreen from '../src/screens/onboarding/SplashScreen';
import ContactScreen from '../src/screens/onboarding/ContactScreen';
import AddContactSheet from '../src/sheets/AddContactSheet';
import { usePrefsStore } from '../src/store/prefsStore';
import { useSessionStore } from '../src/store/sessionStore';
import { DEFAULT_PREFS } from '../src/models/domain';
import { hostStyles, mount, unmountAll } from './onboardingTestUtils';

const SIZES = { se: [375, 667], xs: [320, 568], phone: [390, 844], ipad: [768, 1024], land: [1024, 768], fold: [673, 841] } as Record<string, [number, number]>;
const at = (d: string, fontScale = 1) => Object.assign(mockDims, { width: SIZES[d][0], height: SIZES[d][1], fontScale });
const nav = () => ({ navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn() });

beforeEach(() => {
  jest.useFakeTimers();
  useSessionStore.setState({ uid: null, authKnown: true });
  usePrefsStore.setState({ contacts: [], uid: 'u1', prefs: DEFAULT_PREFS, onboarded: false });
});
afterEach(() => {
  unmountAll();
  jest.useRealTimers();
  at('phone');
});

describe.each(Object.keys(SIZES))('screens at %s', (d) => {
  it('Promise: renders, scrolls, with the CTA pinned in the column', () => {
    at(d);
    const t = mount(<PromiseScreen navigation={nav()} />);
    expect(t.root.findAllByType(ScrollView).length).toBeGreaterThan(0);
    const [w] = SIZES[d];
    const cols = hostStyles(t).filter((s) => s.maxWidth === 560 && s.width === '100%');
    expect(cols.length).toBe(2); // content + CTA are always in the column wrapper; on phones it is simply as wide as the screen
    const content = StyleSheet.flatten(t.root.findByType(ScrollView).props.contentContainerStyle);
    expect(content.paddingHorizontal).toBe(w < 360 ? 16 : 20);
    expect(content.alignItems).toBe('center');
    // the headline is scaled moderately (never below 0.9 x, exactly the demo's 44 on a tablet)
    const head = t.root.findAll((n) => n.type === Text && String(n.props.accessibilityRole) === 'header')[0];
    const size = StyleSheet.flatten(head.props.style).fontSize as number;
    expect(size).toBeGreaterThanOrEqual(Math.round(44 * 0.9));
    expect(size).toBeLessThanOrEqual(w >= 600 ? 44 : 46);
  });

  it('Splash: renders with a scaled, non-scaling wordmark', () => {
    at(d);
    const t = mount(<SplashScreen navigation={nav()} />);
    const mark = t.root.findAll((n) => n.type === Text && n.props.children === 'WeRide')[0];
    expect(mark.props.maxFontSizeMultiplier).toBe(1);
  });

  it('Contact: renders with a list, a sheet entry point and a pinned Continue', () => {
    at(d);
    usePrefsStore.setState({ contacts: [{ id: 'c1', name: 'Mom', number: '+919800021034' }] });
    const t = mount(<ContactScreen navigation={nav()} />);
    expect(t.root.findAll((n) => n.props.testID === 'contact-continue').length).toBeGreaterThan(0);
    expect(t.root.findAll((n) => n.props.testID === 'remove-c1' && typeof n.props.onPress === 'function').length).toBeGreaterThan(0);
    const remove = t.root.findAll((n) => typeof n.type === 'string' && n.props.testID === 'remove-c1')[0];
    expect(StyleSheet.flatten(remove.props.style)).toMatchObject({ width: 44, height: 44 });
  });
});

describe('AddContactSheet with the keyboard open', () => {
  const orig = Platform.OS;
  afterEach(() => {
    (Platform as any).OS = orig;
  });
  it('is wrapped so the form lifts above the iOS keyboard, and taps (Save) pass through the scroller', () => {
    (Platform as any).OS = 'ios';
    at('xs');
    const t = mount(<AddContactSheet visible onClose={() => {}} />);
    const kav = t.root.findByType(KeyboardAvoidingView);
    expect(kav.props.behavior).toBe('padding');
    expect(t.root.findByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
    expect(t.root.findAll((n) => n.props.testID === 'contact-save').length).toBeGreaterThan(0);
  });
  it('leaves resizing to the window on Android (adjustResize)', () => {
    (Platform as any).OS = 'android';
    at('xs');
    const t = mount(<AddContactSheet visible onClose={() => {}} />);
    expect(t.root.findByType(KeyboardAvoidingView).props.behavior).toBeUndefined();
  });
  it('the sheet is a centred card on a tablet', () => {
    at('ipad');
    const t = mount(<AddContactSheet visible onClose={() => {}} />);
    expect(hostStyles(t).some((s) => s.maxWidth === 560 && s.alignSelf === 'center')).toBe(true);
  });
});
