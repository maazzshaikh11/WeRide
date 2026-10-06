/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
const mockReset = jest.fn();
const mockNavigate = jest.fn();
jest.mock('../src/navigation/navigationRef', () => ({
  navigationRef: { isReady: () => true },
  resetRoot: (...a: unknown[]) => mockReset(...a),
  navigateRoot: (...a: unknown[]) => mockNavigate(...a),
}));
const mockStart = jest.fn();
jest.mock('../src/services/rideFlow', () => ({ startRecorderOnce: (...a: unknown[]) => mockStart(...a) }));

import React from 'react';
import { Text } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import RollOutOverlay from '../src/overlays/RollOutOverlay';
import { useOverlayStore } from '../src/store/overlayStore';
import { useRidesStore } from '../src/store/ridesStore';
import { ThemeContext, buildTheme } from '../src/theme/ThemeProvider';
import { THEMES } from '../src/theme/palettes';

const ALL = [['demo', 'light'], ['demo', 'dark'], ['ember', 'light'], ['ember', 'dark']] as const;
const mounted: ReactTestRenderer[] = [];
function mount(state: any, id: 'demo' | 'ember' = 'demo', scheme: 'light' | 'dark' = 'dark') {
  let t!: ReactTestRenderer;
  act(() => { t = create(<ThemeContext.Provider value={buildTheme(id, THEMES[id][scheme])}><RollOutOverlay state={state} /></ThemeContext.Provider>); });
  mounted.push(t);
  return t;
}
const texts = (t: ReactTestRenderer) => t.root.findAllByType(Text).map((n) => [n.props.children].flat(3).join(''));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  useOverlayStore.setState({ current: { kind: 'rollout', groupId: 'r1' } });
  useRidesStore.setState({ rides: [{ id: 'r1', name: 'Run' } as any], loaded: true });
});
afterEach(() => { mounted.splice(0).forEach((t) => act(() => t.unmount())); jest.useRealTimers(); });

describe('RollOutOverlay', () => {
  it.each(ALL)('%s/%s: "<LEAD> · LEAD", Rolling out, 3, the road-mode line', (id, scheme) => {
    const t = mount({ kind: 'rollout', groupId: 'r1', leadName: 'Meera' }, id, scheme);
    const tx = texts(t);
    expect(tx).toContain('MEERA · LEAD');
    expect(tx).toContain('Rolling out');
    expect(tx).toContain('3');
    expect(tx).toContain('Phones lock to Road mode');
  });

  it('counts 3 · 2 · 1, then hides itself and resets to Live; starts the recorder once at the start', () => {
    const t = mount({ kind: 'rollout', groupId: 'r1', leadName: 'Meera' });
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockStart).toHaveBeenCalledWith({ id: 'r1', name: 'Run' });
    act(() => { jest.advanceTimersByTime(900); });
    expect(texts(t)).toContain('2');
    act(() => { jest.advanceTimersByTime(900); });
    expect(texts(t)).toContain('1');
    expect(mockReset).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(850); });
    expect(mockReset).toHaveBeenCalledWith('Live', { groupId: 'r1' });
    expect(useOverlayStore.getState().current).toBeNull();
    act(() => { jest.advanceTimersByTime(5000); });
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it('BREAK OVER (from Stop): 2 · 1, no recorder start, back to the Live screen underneath', () => {
    const t = mount({ kind: 'rollout', groupId: 'r1', next: 'Live' });
    expect(texts(t)).toContain('BREAK OVER');
    expect(texts(t)).toContain('2');
    expect(mockStart).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(900 + 850); });
    expect(mockNavigate).toHaveBeenCalledWith('Live', { groupId: 'r1' });
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('with no lead name known the label is just LEAD', () => {
    expect(texts(mount({ kind: 'rollout', groupId: 'r1' }))).toContain('LEAD');
  });
});
