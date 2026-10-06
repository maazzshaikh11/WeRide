/* eslint-disable @typescript-eslint/no-require-imports -- the persistence tests re-require the store after resetModules */
/**
 * Theme system: 2 themes (Demo, Ember) x light/dark, resolved from the stored
 * choice and the OS scheme; Settings changes it, and it survives a restart.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { StyleSheet, Text } from 'react-native';

import { EMBER, THEMES, THEME_IDS, resolvePalette, withAlpha, Palette, ThemeId, Scheme } from '../src/theme/palettes';
import { ThemeProvider, buildTheme, useTheme } from '../src/theme/ThemeProvider';
import { useThemeStore } from '../src/theme/themeStore';

const mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
  SafeAreaProvider: ({ children }: any) => children,
}));

let mockScheme: 'light' | 'dark' | null = 'dark';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => mockScheme }));

const ALL: [ThemeId, Scheme][] = [['demo', 'light'], ['demo', 'dark'], ['ember', 'light'], ['ember', 'dark']];
const KEYS: (keyof Palette)[] = ['scheme', 'bg', 'bg2', 'card', 'card2', 'ink', 'ink2', 'ink3', 'line', 'line2', 'ok', 'bad', 'blue', 'pri', 'priInk', 'shade', 'scrim'];

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('palettes', () => {
  it('has exactly the two themes', () => {
    expect([...THEME_IDS]).toEqual(['demo', 'ember']);
  });

  it.each(ALL)('%s / %s defines every colour token, and a road variant with the same tokens', (id, scheme) => {
    const p = THEMES[id][scheme];
    expect(p.scheme).toBe(scheme);
    expect(p.road.scheme).toBe(scheme);
    for (const k of KEYS) {
      expect(p[k]).toBeTruthy();
      expect(p.road[k]).toBeTruthy();
    }
  });

  it('Demo uses the demo.html colours as designed', () => {
    expect(THEMES.demo.light).toMatchObject({ bg: '#ECE8DB', card: '#FAF8F0', ink: '#14140F', pri: '#FFC20E', ok: '#0C7A47', bad: '#C9231D' });
    expect(THEMES.demo.dark).toMatchObject({ bg: '#12130F', card: '#1D1F19', ink: '#F4F1E8', pri: '#FFC20E', ok: '#3FD17F' });
    expect(THEMES.demo.light.road).toMatchObject({ bg: '#EFEBDD', card: '#FFFFFF' }); // demo road-d
    expect(THEMES.demo.dark.road).toMatchObject({ bg: '#0C0D0B', ink: '#F6F3EA' }); // demo road-n
  });

  it('Ember uses the brand #FF4D00 as the accent in both modes', () => {
    expect(EMBER).toBe('#FF4D00');
    expect(THEMES.ember.light.pri).toBe('#FF4D00');
    expect(THEMES.ember.dark.pri).toBe('#FF4D00');
    expect(THEMES.ember.light.road.pri).toBe('#FF4D00');
    expect(THEMES.ember.dark.road.pri).toBe('#FF4D00');
  });

  it.each(ALL)('%s / %s: text is readable on its surfaces', (id, scheme) => {
    const p = THEMES[id][scheme];
    for (const pal of [p, p.road]) {
      expect(contrast(pal.ink, pal.bg)).toBeGreaterThanOrEqual(7);
      expect(contrast(pal.ink, pal.card)).toBeGreaterThanOrEqual(7);
      expect(contrast(pal.ink2, pal.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(pal.priInk, pal.pri)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('light and dark really differ in each theme', () => {
    for (const id of THEME_IDS) expect(luminance(THEMES[id].light.bg)).toBeGreaterThan(luminance(THEMES[id].dark.bg));
  });

  it('resolvePalette: explicit mode wins, system follows the OS (dark when unknown)', () => {
    expect(resolvePalette('demo', 'light', 'dark')).toBe(THEMES.demo.light);
    expect(resolvePalette('ember', 'dark', 'light')).toBe(THEMES.ember.dark);
    expect(resolvePalette('ember', 'system', 'light')).toBe(THEMES.ember.light);
    expect(resolvePalette('ember', 'system', 'dark')).toBe(THEMES.ember.dark);
    expect(resolvePalette('demo', 'system', null)).toBe(THEMES.demo.dark);
  });

  it('withAlpha tints a hex colour', () => {
    expect(withAlpha('#FF4D00', 0.5)).toBe('rgba(255, 77, 0, 0.5)');
    expect(withAlpha('red', 0.5)).toBe('red');
  });
});

describe('ThemeProvider', () => {
  function Probe() {
    const { colors, type, themeId, scheme } = useTheme();
    return (
      <Text testID="probe" style={[type.body, { backgroundColor: colors.pri }]}>
        {themeId}/{scheme}
      </Text>
    );
  }
  const mount = () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>,
      );
    });
    return tree;
  };
  const read = (tree: renderer.ReactTestRenderer) => {
    const n = tree.root.findByProps({ testID: 'probe' });
    return { label: n.props.children.join(''), bg: StyleSheet.flatten(n.props.style).backgroundColor };
  };

  beforeEach(() => {
    mockScheme = 'dark';
    act(() => {
      useThemeStore.getState().setThemeId('demo');
      useThemeStore.getState().setMode('system');
    });
  });

  it('follows the OS scheme in system mode', () => {
    mockScheme = 'light';
    const tree = mount();
    expect(read(tree)).toEqual({ label: 'demo/light', bg: THEMES.demo.light.pri });
    act(() => tree.unmount());
  });

  it('re-renders in the new colours when the theme or mode changes, without remounting', () => {
    const tree = mount();
    expect(read(tree)).toEqual({ label: 'demo/dark', bg: '#FFC20E' });
    act(() => useThemeStore.getState().setThemeId('ember'));
    expect(read(tree)).toEqual({ label: 'ember/dark', bg: '#FF4D00' });
    act(() => useThemeStore.getState().setMode('light'));
    expect(read(tree).label).toBe('ember/light');
    act(() => useThemeStore.getState().setMode('system'));
    expect(read(tree).label).toBe('ember/dark');
    act(() => tree.unmount());
  });

  it('typography and layout numbers are identical across the four palettes', () => {
    const sizes = ALL.map(([id, scheme]) => {
      const t = buildTheme(id, THEMES[id][scheme]).type;
      return [t.h1.fontSize, t.body.fontSize, t.body.lineHeight, t.label.letterSpacing, t.button.fontFamily];
    });
    for (const s of sizes) expect(s).toEqual(sizes[0]);
  });
});

describe('theme persistence', () => {
  it('restores the saved choice after a restart and ignores junk', () => {
    const saved: Record<string, string> = { 'theme.id': 'ember', 'theme.mode': 'light' };
    {
      jest.resetModules();
      jest.doMock('react-native-mmkv', () => ({
        MMKV: jest.fn().mockImplementation(() => ({
          getString: (k: string) => saved[k],
          set: (k: string, v: string) => { saved[k] = v; },
        })),
      }));
      const { useThemeStore: fresh } = require('../src/theme/themeStore');
      expect(fresh.getState()).toMatchObject({ themeId: 'ember', mode: 'light' });
      fresh.getState().setThemeId('demo');
      fresh.getState().setMode('dark');
      expect(saved).toEqual({ 'theme.id': 'demo', 'theme.mode': 'dark' });
    }
    saved['theme.id'] = 'neon';
    saved['theme.mode'] = 'sepia';
    {
      jest.resetModules();
      jest.doMock('react-native-mmkv', () => ({
        MMKV: jest.fn().mockImplementation(() => ({ getString: (k: string) => saved[k], set: jest.fn() })),
      }));
      const { useThemeStore: fresh } = require('../src/theme/themeStore');
      expect(fresh.getState()).toMatchObject({ themeId: 'demo', mode: 'system' });
    }
  });

  it('works when storage is unavailable', () => {
    {
      jest.resetModules();
      jest.doMock('react-native-mmkv', () => ({
        MMKV: jest.fn().mockImplementation(() => { throw new Error('no native module'); }),
      }));
      const { useThemeStore: fresh } = require('../src/theme/themeStore');
      expect(fresh.getState()).toMatchObject({ themeId: 'demo', mode: 'system' });
      expect(() => fresh.getState().setThemeId('ember')).not.toThrow();
      expect(fresh.getState().themeId).toBe('ember');
    }
  });
});
