/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories need require */
/** Shared helpers for the first-launch screen tests (not a test file itself). */
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, create, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { ThemeContext, buildTheme } from '../src/theme/ThemeProvider';
import { THEMES } from '../src/theme/palettes';

export const ALL_PALETTES = [['demo', 'light'], ['demo', 'dark'], ['ember', 'light'], ['ember', 'dark']] as const;
export type ThemeKey = 'demo' | 'ember';
export type SchemeKey = 'light' | 'dark';

const mounted: ReactTestRenderer[] = [];
export function unmountAll() {
  mounted.splice(0).forEach((t) => act(() => t.unmount()));
}

export function mount(el: React.ReactElement, id: ThemeKey = 'demo', scheme: SchemeKey = 'light') {
  let t!: ReactTestRenderer;
  act(() => {
    t = create(<ThemeContext.Provider value={buildTheme(id, THEMES[id][scheme])}>{el}</ThemeContext.Provider>);
  });
  mounted.push(t);
  return t;
}

export async function mountAsync(el: React.ReactElement, id: ThemeKey = 'demo', scheme: SchemeKey = 'light') {
  let t!: ReactTestRenderer;
  await act(async () => {
    t = create(<ThemeContext.Provider value={buildTheme(id, THEMES[id][scheme])}>{el}</ThemeContext.Provider>);
  });
  mounted.push(t);
  return t;
}

export const texts = (t: ReactTestRenderer) => t.root.findAllByType(Text).map((n) => [n.props.children].flat(5).filter((c) => typeof c === 'string' || typeof c === 'number').join(''));
export const hasText = (t: ReactTestRenderer, s: string) => texts(t).some((x) => x.includes(s));

export const hostStyles = (t: ReactTestRenderer) =>
  t.root.findAll((n) => typeof n.type === 'string' && n.props.style).map((n) => StyleSheet.flatten(n.props.style));

export function byLabel(t: ReactTestRenderer, label: string): ReactTestInstance {
  const found = t.root.findAll((n) => n.props.accessibilityLabel === label && (typeof n.props.onPress === 'function' || typeof n.props.onChangeText === 'function' || typeof n.props.onPressIn === 'function'));
  if (!found.length) throw new Error(`no control labelled "${label}"`);
  return found[0];
}
export function byTestId(t: ReactTestRenderer, id: string): ReactTestInstance {
  const found = t.root.findAll((n) => n.props.testID === id);
  if (!found.length) throw new Error(`no node with testID "${id}"`);
  return found[0];
}
/** The host (native) view carrying this testID — for style assertions. */
export function hostById(t: ReactTestRenderer, id: string): ReactTestInstance {
  const found = t.root.findAll((n) => typeof n.type === 'string' && n.props.testID === id);
  if (!found.length) throw new Error(`no host node with testID "${id}"`);
  return found[0];
}
export const hasHostId = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => typeof n.type === 'string' && n.props.testID === id).length > 0;
export const hasTestId = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props.testID === id).length > 0;

export async function press(t: ReactTestRenderer, label: string) {
  await act(async () => {
    await byLabel(t, label).props.onPress({ nativeEvent: {} });
  });
}
export async function pressId(t: ReactTestRenderer, id: string) {
  await act(async () => {
    await byTestId(t, id).props.onPress({ nativeEvent: {} });
  });
}
export function typeInto(t: ReactTestRenderer, label: string, value: string) {
  act(() => byLabel(t, label).props.onChangeText(value));
}
/** Whether a pressable is disabled (PressableScale reports it in accessibilityState). */
export function isDisabled(node: ReactTestInstance) {
  return Boolean(node.props.disabled ?? node.props.accessibilityState?.disabled);
}
export const safeAreaMock = () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaInsetsContext: require('react').createContext(null),
});
