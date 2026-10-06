/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories need require */
/**
 * Drill: the SOS practice. Hold time = prefs.hold_ms, early release, completion plate, fromSettings routing.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { act } from 'react-test-renderer';
import { Plates, THEMES } from '../src/theme/palettes';
import { DEFAULT_PREFS } from '../src/models/domain';
import { usePrefsStore } from '../src/store/prefsStore';
import { ALL_PALETTES, byTestId, hasText, hasTestId, hostById, hostStyles, isDisabled, mount, pressId, texts, unmountAll } from './onboardingTestUtils';

jest.mock('react-native-safe-area-context', () => require('./onboardingTestUtils').safeAreaMock());

import DrillScreen, { holdHint } from '../src/screens/onboarding/DrillScreen';

const nav = () => ({ navigate: jest.fn(), goBack: jest.fn() });
const down = (t: ReturnType<typeof mount>) => act(() => { byTestId(t, 'drill-button').props.onPressIn({ nativeEvent: {} }); });
const up = (t: ReturnType<typeof mount>) => act(() => { byTestId(t, 'drill-button').props.onPressOut({ nativeEvent: {} }); });
const hint = (t: ReturnType<typeof mount>) => byTestId(t, 'drill-hint').props.children;
const ring = (t: ReturnType<typeof mount>) => t.root.findAll((n) => n.props.accessibilityRole === 'progressbar' && typeof n.type === 'string')[0].props.accessibilityValue.now;

beforeEach(() => {
  jest.useFakeTimers();
  usePrefsStore.setState({ prefs: { ...DEFAULT_PREFS, hold_ms: 1500 }, contacts: [{ id: 'c1', name: 'Mom', number: '+919800021034' }] });
});
afterEach(() => {
  unmountAll();
  jest.useRealTimers();
});

describe('holdHint', () => {
  it('walks through the demo wording', () => {
    expect([holdHint(0.1), holdHint(0.5), holdHint(0.9)]).toEqual(['KEEP HOLDING', 'ALMOST', 'HOLD…']);
  });
});

describe('DrillScreen', () => {
  it.each(ALL_PALETTES)('%s/%s: always the dark palette, DRILL banner, red SOS button in the ring', (id, scheme) => {
    const t = mount(<DrillScreen navigation={nav()} route={{}} />, id, scheme);
    expect(StyleSheet.flatten(hostById(t, 'screen-Drill').props.style).backgroundColor).toBe(THEMES[id].dark.bg);
    expect(hasTestId(t, 'drill-banner')).toBe(true);
    expect(hasText(t, 'DRILL · NOBODY IS ALERTED')).toBe(true);
    expect(hasText(t, 'Practice your SOS.')).toBe(true);
    expect(hasText(t, "Hold the button. Keep holding until it fills. That's the whole thing.")).toBe(true);
    expect(hasText(t, "A tap does nothing. Gloves, vibration and a bumpy road can't set it off.")).toBe(true);
    expect(hostStyles(t).some((s) => s.backgroundColor === Plates.red.bg && s.width === 184)).toBe(true);
    expect(hint(t)).toBe('HOLD');
    expect(isDisabled(byTestId(t, 'drill-next'))).toBe(true);
  });

  it('a tap does nothing: releasing early shows "RELEASED · NOTHING SENT", resets the ring, then goes back to HOLD', () => {
    const t = mount(<DrillScreen navigation={nav()} route={{}} />);
    down(t);
    expect(hint(t)).toBe('KEEP HOLDING');
    act(() => { jest.advanceTimersByTime(600); });
    expect(ring(t)).toBeGreaterThan(0);
    up(t);
    expect(hint(t)).toBe('RELEASED · NOTHING SENT');
    expect(ring(t)).toBe(0);
    expect(isDisabled(byTestId(t, 'drill-next'))).toBe(true);
    act(() => { jest.advanceTimersByTime(1400); });
    expect(hint(t)).toBe('HOLD');
    // the early release never completes later
    act(() => { jest.advanceTimersByTime(5000); });
    expect(hasTestId(t, 'drill-done-plate')).toBe(false);
  });

  it('progress and hint advance while holding (ALMOST past a third of the hold time)', () => {
    const t = mount(<DrillScreen navigation={nav()} route={{}} />);
    down(t);
    act(() => { jest.advanceTimersByTime(700); });
    expect(hint(t)).toBe('ALMOST');
    expect(ring(t)).toBeGreaterThan(40);
    expect(ring(t)).toBeLessThan(60);
  });

  it('holding for prefs.hold_ms completes: green button, "SOS sent in 1.5 s", real first contact name, Continue enabled', () => {
    const t = mount(<DrillScreen navigation={nav()} route={{}} />);
    down(t);
    act(() => { jest.advanceTimersByTime(1499); });
    expect(hasTestId(t, 'drill-done-plate')).toBe(false);
    act(() => { jest.advanceTimersByTime(40); });
    expect(hasTestId(t, 'drill-done-plate')).toBe(true);
    expect(hasText(t, 'SOS SENT IN 1.5 S')).toBe(true);
    expect(hasText(t, 'In a real SOS: your crew and Mom get an alert with your live location. It queues and sends the moment you have signal.')).toBe(true);
    expect(hint(t)).toBe('SENT');
    expect(ring(t)).toBe(100);
    expect(hostStyles(t).some((s) => s.backgroundColor === Plates.green.bg && s.width === 184)).toBe(true);
    expect(isDisabled(byTestId(t, 'drill-next'))).toBe(false);
  });

  it.each([[1000, '1.0'], [2000, '2.0']] as const)('the hold time follows the rider\'s setting (%i ms)', (ms, label) => {
    usePrefsStore.setState({ prefs: { ...DEFAULT_PREFS, hold_ms: ms } });
    const t = mount(<DrillScreen navigation={nav()} route={{}} />);
    down(t);
    act(() => { jest.advanceTimersByTime(ms - 100); });
    expect(hasTestId(t, 'drill-done-plate')).toBe(false);
    act(() => { jest.advanceTimersByTime(140); });
    expect(hasText(t, `SOS SENT IN ${label} S`)).toBe(true);
  });

  it('without contacts the copy says "your contact" (nothing invented)', () => {
    usePrefsStore.setState({ contacts: [] });
    const t = mount(<DrillScreen navigation={nav()} route={{}} />);
    down(t);
    act(() => { jest.advanceTimersByTime(1600); });
    expect(hasText(t, 'your crew and your contact get an alert')).toBe(true);
    expect(texts(t).join(' ')).not.toContain('Mom');
  });

  it('once done, further presses do nothing', () => {
    const t = mount(<DrillScreen navigation={nav()} route={{}} />);
    down(t);
    act(() => { jest.advanceTimersByTime(1600); });
    up(t);
    down(t);
    up(t);
    expect(hint(t)).toBe('SENT');
  });

  it('screen-reader users can practise with the activate action', () => {
    const t = mount(<DrillScreen navigation={nav()} route={{}} />);
    const btn = byTestId(t, 'drill-button');
    expect(btn.props.accessibilityActions).toEqual([{ name: 'activate', label: 'Practise SOS' }]);
    expect(btn.props.accessibilityHint).toContain('1.5 seconds');
    act(() => btn.props.onAccessibilityAction());
    expect(hasTestId(t, 'drill-done-plate')).toBe(true);
  });

  it('first launch: Continue → CrewStart (only after the drill)', async () => {
    const n = nav();
    const t = mount(<DrillScreen navigation={n} route={{}} />);
    expect(byTestId(t, 'drill-next').props.label).toBe('Continue');
    expect(isDisabled(byTestId(t, 'drill-next'))).toBe(true);
    down(t);
    act(() => { jest.advanceTimersByTime(1600); });
    await pressId(t, 'drill-next');
    expect(n.navigate).toHaveBeenCalledWith('CrewStart');
  });

  it('from Settings: "Done" goes back', async () => {
    const n = nav();
    const t = mount(<DrillScreen navigation={n} route={{ params: { fromSettings: true } }} />);
    expect(byTestId(t, 'drill-next').props.label).toBe('Done');
    down(t);
    act(() => { jest.advanceTimersByTime(1600); });
    await pressId(t, 'drill-next');
    expect(n.goBack).toHaveBeenCalled();
    expect(n.navigate).not.toHaveBeenCalled();
  });

  it('leaving mid-hold stops the timer', () => {
    const t = mount(<DrillScreen navigation={nav()} route={{}} />);
    down(t);
    act(() => t.unmount());
    expect(() => act(() => { jest.advanceTimersByTime(3000); })).not.toThrow();
  });
});
