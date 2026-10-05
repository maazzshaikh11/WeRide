/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories cannot reference out-of-scope imports */
/**
 * MainTabNavigator: six labelled tabs, active state exposed, bar sized from the
 * bottom safe-area inset, tapping a tab navigates. Screens are stubbed.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

const mockInsets = { top: 0, bottom: 34, left: 0, right: 0 };
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  SafeAreaProvider: ({ children }: any) => children,
  useSafeAreaInsets: () => mockInsets,
  useSafeAreaFrame: () => ({ x: 0, y: 0, width: 360, height: 800 }),
  SafeAreaInsetsContext: { Consumer: ({ children }: any) => children(mockInsets) },
  initialWindowMetrics: { insets: mockInsets, frame: { x: 0, y: 0, width: 360, height: 800 } },
}));

// The jest config does not transform @react-navigation's bundled PNG assets
// (node_modules is ignored), so stub the two images the header imports.
jest.mock('@react-navigation/elements/lib/commonjs/assets/back-icon.png', () => 1);
jest.mock('@react-navigation/elements/lib/commonjs/assets/back-icon-mask.png', () => 1);

jest.mock('../src/screens/map/MapScreen', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: () => <Text>screen-home</Text> };
});
jest.mock('../src/screens/StopsScreen', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: () => <Text>screen-stops</Text> };
});
jest.mock('../src/screens/VoiceScreen', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: () => <Text>screen-voice</Text> };
});
jest.mock('../src/screens/FamilyScreen', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: () => <Text>screen-family</Text> };
});
jest.mock('../src/screens/AlertsScreen', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: () => <Text>screen-alerts</Text> };
});
jest.mock('../src/screens/HistoryScreen', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: () => <Text>screen-history</Text> };
});

jest.mock('../src/ui/haptics', () => ({
  ...jest.requireActual('../src/ui/haptics'),
  haptic: jest.fn(),
}));

import MainTabNavigator, { TABS, TAB_BAR_HEIGHT, TabIndicator, indicatorOffset } from '../src/navigation/MainTabNavigator';
import { haptic } from '../src/ui/haptics';

const mounted: renderer.ReactTestRenderer[] = [];
function render() {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <NavigationContainer>
        <MainTabNavigator />
      </NavigationContainer>,
    );
  });
  mounted.push(tree);
  return tree;
}
afterEach(() => {
  while (mounted.length > 0) {
    const tree = mounted.pop()!;
    act(() => tree.unmount());
  }
});

function tabs(tree: renderer.ReactTestRenderer) {
  // deep:false keeps the outermost match per tab (Pressable wraps a host View with the same props).
  return tree.root.findAll(
    (n) => n.props.accessibilityRole === 'tab' && typeof n.props.onPress === 'function',
    { deep: false },
  );
}

describe('MainTabNavigator', () => {
  test('keeps the six route names in order', () => {
    expect(TABS.map((t) => t.name)).toEqual(['Home', 'Stops', 'Voice', 'Family', 'Alerts', 'History']);
  });

  test('renders six labelled tabs with the first selected', () => {
    const tree = render();
    const items = tabs(tree);
    expect(items.map((n) => n.props.accessibilityLabel)).toEqual([
      'Home tab', 'Stops tab', 'Voice tab', 'Family tab', 'Alerts tab', 'History tab',
    ]);
    expect(items.map((n) => n.props.accessibilityState.selected)).toEqual([true, false, false, false, false, false]);
    const labels = tree.root
      .findAll((n) => (n.type as unknown) === 'Text')
      .map((n) => ([] as unknown[]).concat(n.props.children).join(''));
    for (const l of ['Home', 'Stops', 'Voice', 'Family', 'Alerts', 'History']) expect(labels).toContain(l);
  });

  test('bar height is 56 plus the bottom inset, padding is the inset, solid background', () => {
    const tree = render();
    const bar = tree.root.find((n) => n.props.testID === 'main-tab-bar' && (n.type as unknown) === 'View');
    const style = StyleSheet.flatten(bar.props.style);
    expect(style.height).toBe(TAB_BAR_HEIGHT + 34);
    expect(style.paddingBottom).toBe(34);
    expect(style.borderTopWidth).toBe(1);
    expect(String(style.backgroundColor)).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  test('tapping a tab selects it and shows that screen', () => {
    const tree = render();
    act(() => {
      tabs(tree)[4].props.onPress();
    });
    expect(tabs(tree).map((n) => n.props.accessibilityState.selected)).toEqual([false, false, false, false, true, false]);
    const shown = tree.root.findAll((n) => (n.type as unknown) === 'Text').map((n) => n.props.children);
    expect(shown).toContain('screen-alerts');
  });

  /** The real pressable of a tab (the outer wrapper skips the press/haptic handlers). */
  const pressTab = (tree: renderer.ReactTestRenderer, label: string) =>
    tree.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPressIn === 'function')[0];
  const indicator = (tree: renderer.ReactTestRenderer) => tree.root.findByType(TabIndicator);
  const measureBar = (tree: renderer.ReactTestRenderer, width: number) => {
    const bar = tree.root.find((n) => n.props.testID === 'main-tab-bar' && (n.type as unknown) === 'View');
    act(() => {
      bar.props.onLayout({ nativeEvent: { layout: { width, height: 90, x: 0, y: 0 } } });
    });
  };

  describe('sliding indicator + press feedback', () => {
    beforeEach(() => {
      (haptic as jest.Mock).mockClear();
    });

    test('there is exactly one indicator; it starts on the first tab and is unmeasured until layout', () => {
      const tree = render();
      expect(tree.root.findAllByType(TabIndicator)).toHaveLength(1);
      expect(indicator(tree).props).toMatchObject({ index: 0, tabWidth: 0 });
    });

    test('measuring the bar gives each of the six tabs an equal slot', () => {
      const tree = render();
      measureBar(tree, 360);
      expect(indicator(tree).props).toMatchObject({ index: 0, tabWidth: 60 });
      expect(indicatorOffset(4, 60)).toBe(240);
    });

    test('pressing a tab navigates and moves the indicator to that tab', () => {
      const tree = render();
      measureBar(tree, 360);
      act(() => {
        pressTab(tree, 'Alerts tab').props.onPress();
      });
      expect(tabs(tree).map((n) => n.props.accessibilityState.selected)).toEqual([false, false, false, false, true, false]);
      expect(indicator(tree).props).toMatchObject({ index: 4, tabWidth: 60 });
      act(() => {
        pressTab(tree, 'Stops tab').props.onPress();
      });
      expect(indicator(tree).props.index).toBe(1);
    });

    test("switching tabs gives the 'select' haptic; re-pressing the active tab gives none", () => {
      const tree = render();
      act(() => {
        pressTab(tree, 'Home tab').props.onPress();
      });
      expect(haptic).not.toHaveBeenCalled();
      act(() => {
        pressTab(tree, 'Voice tab').props.onPress();
      });
      expect(haptic).toHaveBeenCalledTimes(1);
      expect(haptic).toHaveBeenCalledWith('select');
      act(() => {
        pressTab(tree, 'Voice tab').props.onPress();
      });
      expect(haptic).toHaveBeenCalledTimes(1);
    });

    test('every tab is a pressable with press-in feedback handlers', () => {
      const tree = render();
      for (const t of TABS) {
        const p = pressTab(tree, `${t.label} tab`);
        expect(typeof p.props.onPressIn).toBe('function');
        expect(typeof p.props.onPressOut).toBe('function');
      }
    });
  });
});
