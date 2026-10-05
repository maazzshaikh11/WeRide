/**
 * VoiceScreen states: connecting / connected / muted / mic denied / no ride,
 * and that participants come only from the riders store (+ "You").
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Linking } from 'react-native';

const mounted: renderer.ReactTestRenderer[] = [];
afterEach(() => {
  while (mounted.length > 0) {
    const tree = mounted.pop()!;
    act(() => tree.unmount());
  }
  jest.useFakeTimers();
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockVox = {
  start: jest.fn(),
  stop: jest.fn(),
  setVoiceActive: jest.fn(),
  ctor: jest.fn(),
  mic: jest.fn(),
};
jest.mock('@flvoice/vox/voxClient', () => ({
  __esModule: true,
  VoxClient: function VoxClient(this: any, params: unknown) {
    mockVox.ctor(params);
    this.start = mockVox.start;
    this.stop = mockVox.stop;
    this.setVoiceActive = mockVox.setVoiceActive;
  },
}));
jest.mock('@flvoice/vox/micPermission', () => ({
  requestMicrophonePermission: () => mockVox.mic(),
}));
jest.mock('../src/services/socketService', () => ({
  getVoxSocket: () => ({ on: jest.fn(), off: jest.fn(), emit: jest.fn(), connected: true }),
}));

jest.mock('../src/store/ridersStore', () => {
  const state = { riders: new Map([['user-2abcd', {}], ['user-3wxyz', {}]]) };
  return {
    useRidersStore: (selector?: (s: typeof state) => unknown) => (selector ? selector(state) : state),
    __esModule: true,
  };
});

jest.mock('../src/ui/haptics', () => ({
  ...jest.requireActual('../src/ui/haptics'),
  haptic: jest.fn(),
}));

import { haptic } from '../src/ui/haptics';
import VoiceAvatar from '../src/components/VoiceAvatar';
import { useAppStore } from '../src/store/appStore';
import { useToastStore } from '../src/store/toastStore';
import VoiceScreen from '../src/screens/VoiceScreen';

function texts(tree: renderer.ReactTestRenderer): string {
  return tree.root
    .findAll((n) => (n.type as unknown) === 'Text')
    .map((n) => ([] as unknown[]).concat(n.props.children).join(''))
    .join(' | ');
}

function button(tree: renderer.ReactTestRenderer, label: string) {
  return tree.root.find((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function');
}

async function renderAsync(): Promise<renderer.ReactTestRenderer> {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<VoiceScreen />);
  });
  mounted.push(tree);
  return tree;
}

beforeEach(() => {
  mockVox.start.mockReset().mockResolvedValue(undefined);
  mockVox.stop.mockReset().mockResolvedValue(undefined);
  mockVox.setVoiceActive.mockReset();
  mockVox.ctor.mockReset();
  mockVox.mic.mockReset().mockResolvedValue(true);
  (haptic as jest.Mock).mockClear();
  useAppStore.setState({ userId: 'user-1', groupId: 'group-1' });
  useToastStore.setState({ toasts: [] });
});

describe('VoiceScreen', () => {
  test('connected: lists only real riders plus You, no fabricated leader or "in call" count', async () => {
    const tree = await renderAsync();
    const t = texts(tree);
    expect(t).toContain('Group Voice');
    expect(t).toContain('CONNECTED');
    expect(t).toContain('Channel open');
    expect(t).toContain('RIDERS IN THIS RIDE · 3');
    expect(t).toContain('You');
    expect(t).toContain('Rider abcd');
    expect(t).toContain('Rider wxyz');
    expect(t).not.toContain('IN CALL');
    expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(t).toContain('audio is not live yet');
  });

  test('connecting while VoxClient.start is pending', async () => {
    mockVox.start.mockReturnValue(new Promise(() => undefined));
    const tree = await renderAsync();
    expect(texts(tree)).toContain('CONNECTING');
    expect(texts(tree)).toContain('Connecting');
  });

  test('start failure shows not connected and disables controls', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockVox.start.mockRejectedValue(new Error('no webrtc'));
    const tree = await renderAsync();
    expect(texts(tree)).toContain('Not connected');
    expect(button(tree, 'Mute microphone').props.disabled).toBe(true);
    warn.mockRestore();
  });

  test('mute toggle exposes state and label; unmuting broadcasts voice_active', async () => {
    const tree = await renderAsync();
    expect(button(tree, 'Mute microphone').props.accessibilityState).toMatchObject({ selected: false });
    act(() => button(tree, 'Mute microphone').props.onPress());
    const muted = button(tree, 'Unmute microphone');
    expect(muted.props.accessibilityState).toMatchObject({ selected: true });
    expect(texts(tree)).toContain('Your mic is muted');
    act(() => muted.props.onPress());
    expect(mockVox.setVoiceActive).toHaveBeenCalledWith(true);
    expect(texts(tree)).toContain('Channel open');
  });

  test('mic denied: explains, offers Open settings, never starts VoxClient', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockVox.mic.mockResolvedValue(false);
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    const tree = await renderAsync();
    expect(texts(tree)).toContain('Microphone access denied');
    expect(mockVox.ctor).not.toHaveBeenCalled();
    expect(button(tree, 'Mute microphone').props.disabled).toBe(true);
    act(() => button(tree, 'Open settings').props.onPress());
    expect(openSettings).toHaveBeenCalledTimes(1);
    openSettings.mockRestore();
    warn.mockRestore();
  });

  test('no ride/identity: not connected, nothing is started', async () => {
    useAppStore.setState({ userId: null, groupId: null });
    const tree = await renderAsync();
    expect(mockVox.ctor).not.toHaveBeenCalled();
    expect(texts(tree)).toContain('Not connected');
    expect(texts(tree)).toContain('Open a ride to join its voice channel');
  });

  test('leaving stops the client and reports it', async () => {
    const tree = await renderAsync();
    await act(async () => {
      button(tree, 'Leave voice channel').props.onPress();
    });
    expect(mockVox.stop).toHaveBeenCalled();
    expect(useToastStore.getState().toasts[0].message).toBe('You left the voice channel');
    expect(texts(tree)).toContain('Not connected');
  });

  const real = (tree: renderer.ReactTestRenderer, label: string) =>
    tree.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPressIn === 'function')[0];

  test('mute and leave are pressables with press feedback; muting gives a select haptic and swaps the label', async () => {
    const tree = await renderAsync();
    expect(typeof real(tree, 'Mute microphone').props.onPressIn).toBe('function');
    expect(typeof real(tree, 'Leave voice channel').props.onPressOut).toBe('function');
    act(() => real(tree, 'Mute microphone').props.onPress());
    expect(haptic).toHaveBeenCalledWith('select');
    expect(texts(tree)).toContain('Unmute');
    act(() => real(tree, 'Unmute microphone').props.onPress());
    expect(texts(tree)).toContain('Mute');
    expect(haptic).toHaveBeenCalledTimes(2);
  });

  test('connecting shows a pulsing indicator that is gone once connected', async () => {
    mockVox.start.mockReturnValue(new Promise(() => undefined));
    const connecting = await renderAsync();
    const pulses = (t: renderer.ReactTestRenderer) =>
      t.root.findAll((n) => n.props.testID === 'vox-connecting-pulse' && (n.type as unknown) === 'View');
    expect(pulses(connecting)).toHaveLength(1);

    mockVox.start.mockReset().mockResolvedValue(undefined);
    const connected = await renderAsync();
    expect(pulses(connected)).toHaveLength(0);
  });

  test('speaking avatar shows its ring; a quiet one does not', () => {
    const find = (tree: renderer.ReactTestRenderer) => tree.root.findAll((n) => n.props.accessibilityLabel === 'You, speaking');
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<VoiceAvatar initials="YO" color="#fff" name="Rider" isYou speaking />);
    });
    mounted.push(tree);
    expect(find(tree).length).toBeGreaterThan(0);
    act(() => tree.update(<VoiceAvatar initials="YO" color="#fff" name="Rider" isYou speaking={false} />));
    expect(find(tree)).toHaveLength(0);
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'You').length).toBeGreaterThan(0);
  });
});
