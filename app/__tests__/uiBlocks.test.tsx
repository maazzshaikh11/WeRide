/**
 * The shared demo building blocks render under all four palettes with the demo's numbers.
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Path } from 'react-native-svg';

import { Avatar, Bars, CodeBoxes, KV, Keypad, LetterKeypad, MapSketch, Rail, Ring, RiderTile, Stepper, Ticket, TopBar } from '../src/ui';
import { ThemeContext, buildTheme } from '../src/theme/ThemeProvider';
import { THEMES } from '../src/theme/palettes';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaInsetsContext: require('react').createContext(null),
}));

const ALL = [['demo', 'light'], ['demo', 'dark'], ['ember', 'light'], ['ember', 'dark']] as const;
const mounted: ReactTestRenderer[] = [];
afterEach(() => mounted.splice(0).forEach((t) => act(() => t.unmount())));
function mount(el: React.ReactElement, id: 'demo' | 'ember' = 'demo', scheme: 'light' | 'dark' = 'dark') {
  let t!: ReactTestRenderer;
  act(() => {
    t = create(<ThemeContext.Provider value={buildTheme(id, THEMES[id][scheme])}>{el}</ThemeContext.Provider>);
  });
  mounted.push(t);
  return t;
}
const hostStyles = (t: ReactTestRenderer) =>
  t.root.findAll((n) => typeof n.type === 'string' && n.props.style).map((n) => StyleSheet.flatten(n.props.style));
const texts = (t: ReactTestRenderer) => t.root.findAllByType(Text).map((n) => [n.props.children].flat(3).join(''));

describe('Avatar in an overlapping stack', () => {
  const padRight = (t: ReactTestRenderer) => hostStyles(t).map((s) => s.paddingRight).find((v) => v !== undefined);
  it('shifts the initials left by half the covered width (demo .avs .av:not(:last-child){padding-right:9px})', () => {
    const covered = mount(<Avatar initials="ME" size={28} covered={9} />);
    expect(padRight(covered)).toBe(9);
    const last = mount(<Avatar initials="ME" size={28} />);
    expect(padRight(last)).toBeUndefined();
  });
});

describe('KV key lines', () => {
  it('lets keys wrap to two lines by default (no clipped labels) and can be held to one', () => {
    const lines = (t: ReactTestRenderer) => t.root.findAllByType(Text).find((n) => [n.props.children].flat(3).join('') === 'HAZARDS SHARED')?.props.numberOfLines;
    expect(lines(mount(<KV items={[{ value: '1', label: 'hazards shared' }]} />))).toBe(2);
    expect(lines(mount(<KV keyLines={1} items={[{ value: '1', label: 'hazards shared' }]} />))).toBe(1);
  });
});

describe('Stepper', () => {
  it('fills `step` of `of` bars with ink', () => {
    const t = mount(<Stepper step={3} of={5} />);
    expect(t.root.findAll((n) => n.props.testID === 'step-on' && typeof n.type === 'string')).toHaveLength(3);
    expect(t.root.findAll((n) => n.props.testID === 'step-off' && typeof n.type === 'string')).toHaveLength(2);
    expect(t.root.findByProps({ testID: 'stepper' }).props.accessibilityLabel).toBe('Step 3 of 5');
  });
});

describe('CodeBoxes', () => {
  it.each(ALL)('%s/%s: shows the digits typed and rings the next box in ink', (id, scheme) => {
    const t = mount(<CodeBoxes value="48" />, id, scheme);
    expect(texts(t).slice(0, 2)).toEqual(['4', '8']);
    expect(hostStyles(t).filter((s) => s.borderColor === THEMES[id][scheme].ink && s.borderWidth === 3)).toHaveLength(1);
  });
});

describe('Keypads', () => {
  it('Keypad types digits and deletes', () => {
    const onKey = jest.fn(), onBack = jest.fn();
    const t = mount(<Keypad onKey={onKey} onBackspace={onBack} />);
    const press = (label: string) => act(() => t.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0].props.onPress());
    press('7');
    press('0');
    press('Delete');
    expect(onKey.mock.calls.map((c) => c[0])).toEqual(['7', '0']);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
  it('LetterKeypad has the code digits 2-9 and ignores the letters codes never contain', () => {
    const onKey = jest.fn();
    const t = mount(<LetterKeypad onKey={onKey} onBackspace={jest.fn()} />);
    const press = (label: string) => act(() => t.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0].props.onPress());
    ['K', '7', 'O', 'I', 'L', 'Q'].forEach(press);
    expect(onKey.mock.calls.map((c) => c[0])).toEqual(['K', '7', 'Q']);
    ['2', '9'].forEach((d) => expect(texts(t)).toContain(d));
    expect(texts(t)).not.toContain('0');
    expect(texts(t)).not.toContain('1');
  });
});

describe('KV / Ring / Bars / Rail / RiderTile / Ticket / TopBar / MapSketch', () => {
  it('KV uppercases keys and shows units', () => {
    const t = mount(<KV items={[{ value: '84', unit: 'km', label: 'Distance' }, { value: '91', label: 'Safety score' }]} />);
    expect(texts(t)).toEqual(expect.arrayContaining(['DISTANCE', 'SAFETY SCORE']));
    expect(texts(t).join('|')).toContain('84');
  });
  it('Ring exposes its percentage', () => {
    const t = mount(<Ring value={0.93}><Text>93</Text></Ring>);
    expect(t.root.findByProps({ accessibilityRole: 'progressbar' }).props.accessibilityValue.now).toBe(93);
    expect(mount(<Ring value={7} />).root.findByProps({ accessibilityRole: 'progressbar' }).props.accessibilityValue.now).toBe(100);
  });
  it('Bars: the last bar is the accent and the tallest is full height', () => {
    const t = mount(<Bars values={[10, 0, 40]} labels={['W1', 'W2', 'W3']} height={80} />);
    const bars = hostStyles(t).filter((s) => s.borderRadius === 6);
    expect(bars.map((s) => s.height)).toEqual([20, 6, 80]);
    expect(bars[2].backgroundColor).toBe(THEMES.demo.dark.pri);
    expect(bars[0].backgroundColor).toBe(THEMES.demo.dark.line2);
  });
  it('Rail renders every item with its tone', () => {
    const t = mount(<Rail items={[{ title: 'Rolled out', tone: 'ok' }, { title: 'Gap', sub: '0.4 km', tone: 'bad' }]} />);
    expect(texts(t)).toEqual(['Rolled out', 'Gap', '0.4 km']);
  });
  it.each(ALL)('%s/%s: RiderTile ready rims the tile in ok', (id, scheme) => {
    const t = mount(<RiderTile name="Meera" initials="ME" status="ready" ready />, id, scheme);
    expect(hostStyles(t).some((s) => s.borderColor === THEMES[id][scheme].ok && s.borderWidth === 3)).toBe(true);
    expect(texts(t)).toEqual(expect.arrayContaining(['Meera', 'READY']));
  });
  it('RiderTile status line uses the demo .1em tracking and shrinks to fit instead of clipping ("ON A BREAK")', () => {
    const t = mount(<RiderTile name="You" initials="AR" status="on a break" />);
    const status = t.root.findAll((n) => typeof n.type === 'string' && n.props.children === 'ON A BREAK')[0];
    const st = ([] as any[]).concat(status.props.style).flat(3).filter(Boolean).reduce((a, b) => ({ ...a, ...b }), {});
    expect(st.fontSize).toBe(11);
    expect(st.letterSpacing).toBeCloseTo(1.1);
    expect(status.props.numberOfLines).toBe(1);
    expect(status.props.adjustsFontSizeToFit).toBe(true);
  });
  it('Ticket draws the perforation only with a header', () => {
    const withH = mount(<Ticket header={<Text>H</Text>}><Text>body</Text></Ticket>);
    const without = mount(<Ticket><Text>body</Text></Ticket>);
    expect(hostStyles(withH).some((s) => s.borderStyle === 'dashed')).toBe(true);
    expect(hostStyles(without).some((s) => s.borderStyle === 'dashed')).toBe(false);
  });
  it('TopBar back is a labelled 44pt button', () => {
    const onBack = jest.fn();
    const t = mount(<TopBar onBack={onBack} />);
    act(() => t.root.findAll((n) => n.props.accessibilityLabel === 'Back' && typeof n.props.onPress === 'function')[0].props.onPress({}));
    expect(onBack).toHaveBeenCalled();
    expect(mount(<TopBar back={false} />).root.findAll((n) => n.props.testID === 'topbar-back')).toHaveLength(0);
  });
  it('MapSketch draws a casing + accent line, start and end for a real track, and nothing for an empty one', () => {
    const pts = [{ lat: 18.52, lng: 73.85 }, { lat: 18.6, lng: 73.9 }, { lat: 18.7, lng: 73.4 }];
    const t = mount(<MapSketch points={pts} progress={0.5} testID="sk" />);
    expect(t.root.findAllByType(Path).length).toBeGreaterThan(0);
    const e = mount(<MapSketch points={[]} testID="sk2" />);
    expect(e.root.findAllByType(Path)).toHaveLength(0);
  });
});
