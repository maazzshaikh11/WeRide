/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
/**
 * Responsive structure of the shared building blocks at compact / short / tablet sizes. Layout itself (clipping,
 * overlap, touch targets) is checked in a real browser engine by app/scripts/screenshots (docs/RESPONSIVE.md); these
 * tests pin the decisions that make it work so they cannot silently regress: the centred tablet column, gutters,
 * safe-area use, pinned docks that reserve their measured height, the Live chrome's tiers and the text-scaling caps.
 */
const mockDims = { width: 390, height: 844, fontScale: 1, scale: 2 };
const mockInsets = { top: 47, bottom: 34, left: 0, right: 0 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
  SafeAreaInsetsContext: require('react').createContext(null),
}));
jest.mock('@react-navigation/bottom-tabs', () => ({ createBottomTabNavigator: () => ({ Navigator: () => null, Screen: () => null }) }));
jest.mock('@react-navigation/native', () => ({ CommonActions: { navigate: (a: unknown) => a } }));
jest.mock('react-native-mmkv', () => ({ MMKV: jest.fn().mockImplementation(() => ({ getString: jest.fn(), set: jest.fn(), delete: jest.fn() })) }));

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { act, create, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { ThemeContext, buildTheme } from '../src/theme/ThemeProvider';
import { THEMES } from '../src/theme/palettes';
import { Button, Chip, LetterKeypad, Pill, Plate, Screen, Segmented, Sheet } from '../src/ui';
import { LETTER_KEY_MIN_W, letterKeypadPlan } from '../src/ui/Input';
import { GarageTabBar } from '../src/navigation/GarageTabBar';
import { ControlKey, SideButton, SpeedCluster } from '../src/screens/map/live/LiveChrome';
import OverlayFrame from '../src/overlays/OverlayFrame';
import RoadFrame from '../src/screens/road/parts/RoadFrame';
import { CAP } from '../src/theme/textPolicy';

const flat = (n: ReactTestInstance) => StyleSheet.flatten(n.props.style) ?? {};
const mounted: ReactTestRenderer[] = [];
function setDevice(w: number, h: number, top = 0, bottom = 0, fontScale = 1) {
  Object.assign(mockDims, { width: w, height: h, fontScale });
  Object.assign(mockInsets, { top, bottom, left: 0, right: 0 });
}
function mount(el: React.ReactElement) {
  let t!: ReactTestRenderer;
  act(() => {
    t = create(
      <SafeAreaInsetsContext.Provider value={{ ...mockInsets }}>
        <ThemeContext.Provider value={buildTheme('demo', THEMES.demo.light)}>{el}</ThemeContext.Provider>
      </SafeAreaInsetsContext.Provider>,
    );
  });
  mounted.push(t);
  return t;
}
const hostByStyle = (t: ReactTestRenderer, pred: (s: any) => boolean) => t.root.findAll((n) => typeof n.type === 'string' && pred(flat(n)));
afterEach(() => mounted.splice(0).forEach((t) => act(() => t.unmount())));
afterAll(() => setDevice(390, 844, 47, 34));

type Dev = [number, number, number, number];
const DEVICES = {
  se: [375, 667, 20, 0],
  xs: [320, 568, 24, 48],
  phone: [390, 844, 47, 34],
  ipad: [768, 1024, 0, 0],
  land: [1024, 768, 0, 0],
  fold: [673, 841, 24, 0],
} as Record<'se' | 'xs' | 'phone' | 'ipad' | 'land' | 'fold', Dev>;

describe('Screen', () => {
  it('uses 20 pt gutters on a phone, 16 pt below 360 pt', () => {
    setDevice(...DEVICES.phone);
    expect(flat(mount(<Screen><Text>x</Text></Screen>).root.findByType(ScrollView) as ReactTestInstance).paddingHorizontal).toBeUndefined();
    const gutter = (t: ReactTestRenderer) => StyleSheet.flatten(t.root.findByType(ScrollView).props.contentContainerStyle).paddingHorizontal;
    expect(gutter(mount(<Screen><Text>x</Text></Screen>))).toBe(20);
    setDevice(...DEVICES.xs);
    expect(gutter(mount(<Screen><Text>x</Text></Screen>))).toBe(16);
  });

  it.each(['ipad', 'land', 'fold'] as const)('keeps content and the pinned CTA in a centred column of at most 560 pt on %s', (d) => {
    setDevice(...DEVICES[d]);
    const t = mount(<Screen cta={<Button label="Go" onPress={() => {}} />}><Text>hello</Text></Screen>);
    const cols = hostByStyle(t, (s) => s.maxWidth === 560 && s.width === '100%');
    expect(cols.length).toBe(2); // content + CTA
    expect(flat(t.root.findByType(ScrollView)).backgroundColor).toBeUndefined();
    expect(StyleSheet.flatten(t.root.findByType(ScrollView).props.contentContainerStyle).alignItems).toBe('center');
  });

  it('takes a wider column for road screens', () => {
    setDevice(...DEVICES.ipad);
    const t = mount(<Screen column={640}><Text>x</Text></Screen>);
    expect(hostByStyle(t, (s) => s.maxWidth === 640).length).toBe(1);
  });

  it('places the pinned CTA from the safe-area inset, not a hard-coded 34', () => {
    const bottom = (b: number) => {
      setDevice(390, 844, 47, b);
      const t = mount(<Screen cta={<Button label="Go" onPress={() => {}} />}><Text>x</Text></Screen>);
      return hostByStyle(t, (s) => s.position === 'absolute' && s.alignItems === 'center' && s.bottom !== undefined).map((n) => flat(n).bottom)[0];
    };
    expect(bottom(0)).toBe(32); // max(inset, 12) + 20
    expect(bottom(34)).toBe(54);
    expect(bottom(48)).toBe(68);
  });
});

describe('Sheet', () => {
  it('is a bottom sheet on phones and a centred card of at most 560 pt on tablets', () => {
    setDevice(...DEVICES.phone);
    let t = mount(<Sheet visible onClose={() => {}} testID="s"><Text>x</Text></Sheet>);
    expect(flat(hostByStyle(t, (x) => x.zIndex === 120)[0]).justifyContent).toBe('flex-end');
    expect(hostByStyle(t, (s) => s.maxWidth === 560).length).toBe(0);
    setDevice(...DEVICES.ipad);
    t = mount(<Sheet visible onClose={() => {}} testID="s"><Text>x</Text></Sheet>);
    expect(flat(hostByStyle(t, (x) => x.zIndex === 120)[0]).justifyContent).toBe('center');
    const card = hostByStyle(t, (s) => s.maxWidth === 560)[0];
    expect(flat(card)).toMatchObject({ alignSelf: 'center', width: '100%', borderRadius: 30 });
  });
  it('uses the compact gutter and the bottom inset, and its content scrolls with taps passing through', () => {
    setDevice(...DEVICES.xs);
    const t = mount(<Sheet visible onClose={() => {}}><Text>x</Text></Sheet>);
    const sheet = hostByStyle(t, (s) => s.maxHeight === '88%')[0];
    expect(flat(sheet).paddingHorizontal).toBe(16);
    expect(flat(sheet).paddingBottom).toBe(48 + 26);
    expect(t.root.findByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
  });
});

describe('Garage tab bar', () => {
  const props = (): any => ({
    state: { index: 0, key: 'tab', routes: ['Ride', 'Crews', 'Log', 'Me'].map((n) => ({ key: n, name: n })) },
    descriptors: Object.fromEntries(['Ride', 'Crews', 'Log', 'Me'].map((n) => [n, { options: {} }])),
    navigation: { emit: () => ({ defaultPrevented: false }), dispatch() {} },
  });
  it('spans the screen but keeps its tabs in a centred column on tablets', () => {
    setDevice(...DEVICES.ipad);
    const t = mount(<GarageTabBar {...props()} />);
    expect(hostByStyle(t, (s) => s.maxWidth === 560 && s.flexDirection === 'row').length).toBe(1);
    expect(flat(t.root.findAll((n) => n.props.testID === 'garage-tab-bar')[0]).alignItems).toBe('center');
  });
  it('adds the real bottom inset to its height and never scales its labels', () => {
    setDevice(...DEVICES.phone);
    let t = mount(<GarageTabBar {...props()} />);
    expect(flat(t.root.findAll((n) => n.props.testID === 'garage-tab-bar')[0])).toMatchObject({ height: 64 + 34, paddingBottom: 34 });
    setDevice(...DEVICES.xs);
    t = mount(<GarageTabBar {...props()} />);
    expect(flat(t.root.findAll((n) => n.props.testID === 'garage-tab-bar')[0]).height).toBe(64 + 48);
    const labels = t.root.findAll((n) => n.type === Text && ['RIDE', 'CREWS', 'LOG', 'ME'].includes(String(n.props.children)));
    expect(labels).toHaveLength(4);
    labels.forEach((l) => expect(l.props.maxFontSizeMultiplier).toBe(CAP.fixed));
  });
});

describe('letter keypad', () => {
  const rowsOf = (t: ReactTestRenderer) => t.root.findAll((n) => typeof n.type === 'string' && flat(n).flexDirection === 'row' && flat(n).justifyContent === 'center');
  it('keeps every key at least 28 pt wide on all widths (QWERTY, or 8-key rows when QWERTY would not fit)', () => {
    for (const w of [320, 340, 360, 375, 390, 412, 430, 560]) {
      const plan = letterKeypadPlan(w - 2 * (w < 360 ? 16 : 20));
      expect(plan.keyW).toBeGreaterThanOrEqual(LETTER_KEY_MIN_W);
    }
    expect(letterKeypadPlan(360 - 40).compact).toBe(false); // common 360 phones keep QWERTY (gap tightened to 4)
    expect(letterKeypadPlan(360 - 40).gap).toBe(4);
    expect(letterKeypadPlan(320 - 32).compact).toBe(true);
  });
  it('renders 8-key rows with every usable letter once on a 320 pt phone', () => {
    setDevice(...DEVICES.xs);
    const t = mount(<LetterKeypad onKey={() => {}} onBackspace={() => {}} />);
    const keys = t.root.findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('letter-key-') && typeof n.props.onPress === 'function').map((n) => n.props.testID.slice(11));
    const unique = Array.from(new Set(keys));
    expect(unique.filter((k) => /^[A-Z]$/.test(k)).sort().join('')).toBe('ABCDEFGHJKMNPQRSTUVWXYZ');
    expect(unique.filter((k) => /^[2-9]$/.test(k)).join('')).toBe('23456789');
    expect(unique).toContain('delete');
    rowsOf(t).forEach((r) => expect(r.children.length).toBeLessThanOrEqual(9)); // 8 keys + delete on the last row only
  });
  it('is QWERTY on a 390 pt phone and still calls back', () => {
    setDevice(...DEVICES.phone);
    const onKey = jest.fn();
    const t = mount(<LetterKeypad onKey={onKey} onBackspace={() => {}} />);
    const q = t.root.findAll((n) => n.props.testID === 'letter-key-Q' && typeof n.props.onPress === 'function')[0];
    act(() => q.props.onPress({}));
    expect(onKey).toHaveBeenCalledWith('Q');
  });
});

describe('control sizing and text caps', () => {
  it('buttons, pills, segments and chips cap their text at the HUD multiplier; touch targets are at least 44', () => {
    setDevice(...DEVICES.phone);
    const t = mount(
      <View>
        <Button label="Go" onPress={() => {}} />
        <Pill label="Live" />
        <Segmented options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} value="a" onChange={() => {}} />
        <Chip label="Chip" onPress={() => {}} />
      </View>,
    );
    for (const label of ['Go', 'LIVE', 'A', 'B', 'Chip']) {
      const node = t.root.findAll((n) => n.type === Text && n.props.children === label)[0];
      expect(node.props.maxFontSizeMultiplier).toBe(CAP.hud);
    }
    expect(hostByStyle(t, (s) => s.height === 44 && s.flex === 1).length).toBe(2); // segments
    expect(hostByStyle(t, (s) => s.minHeight === 44).length).toBeGreaterThan(0); // chip
  });
  it('plate titles are fixed-size and shrink to fit instead of clipping', () => {
    setDevice(...DEVICES.xs);
    const t = mount(<Plate tone="green" title="All together" subtitle="6 riders" titleSize={28} />);
    const title = t.root.findAll((n) => n.type === Text && n.props.children === 'ALL TOGETHER')[0];
    expect(title.props).toMatchObject({ maxFontSizeMultiplier: CAP.fixed, adjustsFontSizeToFit: true, numberOfLines: 1 });
    expect(flat(title).fontSize).toBeLessThanOrEqual(24); // compact width steps the display type down
    setDevice(...DEVICES.phone);
    const t2 = mount(<Plate tone="green" title="All together" titleSize={28} />);
    expect(flat(t2.root.findAll((n) => n.type === Text && n.props.children === 'ALL TOGETHER')[0]).fontSize).toBe(28);
  });
});

describe('Live chrome is height-aware', () => {
  const key = (glove = false) => flat(mount(<ControlKey icon="haz" label="Hazard" glove={glove} onPress={() => {}} />).root.findAll((n) => n.props.testID === undefined && n.props.accessibilityLabel === 'Hazard' && typeof n.type === 'string')[0]);
  it('control keys: 88 / 80 / 76 pt by tier, 104 in glove mode on a regular phone, never below 76', () => {
    setDevice(...DEVICES.phone);
    expect(key().height).toBe(88);
    expect(key(true).height).toBe(104);
    setDevice(...DEVICES.se);
    expect(key().height).toBe(80);
    setDevice(...DEVICES.xs);
    expect(key().height).toBe(76);
    expect(key(true).height).toBeGreaterThan(76);
  });
  it('keys never scale their labels and use the narrow-key label size on 320 pt', () => {
    setDevice(...DEVICES.xs);
    const t = mount(<ControlKey icon="haz" label="Hazard" onPress={() => {}} />);
    const label = t.root.findAll((n) => n.type === Text && n.props.children === 'HAZARD')[0];
    expect(label.props.maxFontSizeMultiplier).toBe(CAP.fixed);
    expect(flat(label).fontSize).toBe(10);
  });
  it('side buttons shrink with the screen but stay touch targets (>= 44)', () => {
    const size = (d: keyof typeof DEVICES) => {
      setDevice(...DEVICES[d]);
      return flat(mount(<SideButton icon="group" label="GROUP" onPress={() => {}} accessibilityLabel="Group" />).root.findAll((n) => n.props.accessibilityLabel === 'Group' && typeof n.type === 'string')[0]).width;
    };
    expect(size('phone')).toBe(62);
    expect(size('se')).toBe(56);
    expect(size('xs')).toBe(50);
    expect(size('xs')).toBeGreaterThanOrEqual(44);
  });
  it('the speed number scales down on short screens and is capped against large text', () => {
    const speed = (d: keyof typeof DEVICES, glove = false) => {
      setDevice(...DEVICES[d]);
      const t = mount(<SpeedCluster speedKmh={48} etaClock="7:46" remainingKm={84} toLabel="Lonavala" glove={glove} />);
      const n = t.root.findAll((x) => x.props.testID === 'speed-value' && x.type === Text)[0];
      return { size: flat(n).fontSize as number, cap: n.props.maxFontSizeMultiplier };
    };
    expect(speed('phone').size).toBe(122);
    expect(speed('phone', true).size).toBe(132);
    expect(speed('se').size).toBeLessThan(122);
    expect(speed('xs').size).toBeLessThan(speed('se').size + 1);
    expect(speed('xs').cap).toBe(CAP.fixed);
    for (const id of ['eta-value', 'remaining-value']) {
      setDevice(...DEVICES.xs);
      const t = mount(<SpeedCluster speedKmh={48} etaClock="7:46" remainingKm={84} toLabel="Lonavala" />);
      expect(t.root.findAll((x) => x.props.testID === id && x.type === Text)[0].props.maxFontSizeMultiplier).toBe(CAP.fixed);
    }
  });
});

describe('pinned docks reserve their measured height', () => {
  const layoutEvent = (h: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width: 300, height: h } } });
  it('OverlayFrame: scrolling content above a dock; content padding follows the dock height and the bottom inset', () => {
    setDevice(...DEVICES.xs);
    const t = mount(<OverlayFrame bg="#C00000" paddingTop={40} dock={<View testID="dock"><Text>Call 112</Text></View>}><Text>content</Text></OverlayFrame>);
    const scroll = t.root.findByType(ScrollView);
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle)).toMatchObject({ paddingTop: 40, alignItems: 'center' });
    const dockBox = t.root.findAll((n) => typeof n.type === 'string' && n.props.onLayout && flat(n).maxWidth === 640)[0];
    act(() => dockBox.props.onLayout(layoutEvent(210)));
    // dock 210 + bottom gap (inset 48 - 4 = 44) + 20
    expect(StyleSheet.flatten(t.root.findByType(ScrollView).props.contentContainerStyle).paddingBottom).toBe(210 + 44 + 20);
    // the dock sits on an opaque strip of the overlay colour, `bottom` above the edge, so scrolled content never shows through
    const strip = hostByStyle(t, (s) => s.position === 'absolute' && s.backgroundColor === '#C00000');
    expect(strip.length).toBe(1);
    expect(flat(strip[0]).height).toBe(210 + 44 + 14);
    expect(hostByStyle(t, (s) => s.maxWidth === 640 && s.marginBottom === 44).length).toBe(1);
  });
  it('RoadFrame: same for the Stop / Arrive docks, with the Live layout sizes', () => {
    setDevice(...DEVICES.se);
    const t = mount(<RoadFrame dock={<Text>dock</Text>}><Text>body</Text></RoadFrame>);
    const dockBox = t.root.findAll((n) => typeof n.type === 'string' && n.props.onLayout)[0];
    act(() => dockBox.props.onLayout(layoutEvent(120)));
    const pad = StyleSheet.flatten(t.root.findByType(ScrollView).props.contentContainerStyle).paddingBottom as number;
    expect(pad).toBe(120 + 20 + 24); // dock + short-tier bottom gap (max(20, -4)) + 24
    expect(t.root.findByType(ScrollView).props.showsVerticalScrollIndicator).toBe(false);
  });
});
