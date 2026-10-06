/**
 * Live-screen controls: side buttons and control keys call their handlers and give
 * the agreed press haptics, the signal sheet still emits only allowlisted labels and
 * animates out before unmounting, AvatarStack pops only riders that join later, and
 * NetworkBanner dismisses as agreed.
 */
import React from 'react';
import { Platform, StyleSheet, Text, Vibration } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { ControlKey, SideButton, SpeedCluster, clockAfter } from '../src/screens/map/live/LiveChrome';
import AvatarStack from '../src/components/AvatarStack';
import NetworkBanner from '../src/components/NetworkBanner';

const mockSocket = { connected: true, emit: jest.fn() };
jest.mock('../src/services/socketService', () => ({
  getLocationSocket: () => mockSocket,
}));
import SignalSheet, { SIGNAL_OPTIONS } from '../src/components/SignalSheet';
import { useToastStore } from '../src/store/toastStore';

const mounted: ReactTestRenderer[] = [];
function render(el: React.ReactElement) {
  let t!: ReactTestRenderer;
  act(() => {
    t = create(el);
  });
  mounted.push(t);
  return t;
}
const real = (t: ReactTestRenderer, label: string) =>
  t.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPressIn === 'function')[0];

describe('live controls', () => {
  let vibrate: jest.SpyInstance;
  const originalOS = Platform.OS;
  beforeEach(() => {
    (Platform as any).OS = 'android';
    vibrate = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);
    vibrate.mockClear();
  });
  afterEach(() => {
    mounted.splice(0).forEach((t) => act(() => t.unmount()));
    (Platform as any).OS = originalOS;
    vibrate.mockRestore();
  });

  it('SideButton press calls the handler with the select haptic and keeps its label/selected state', () => {
    const onPress = jest.fn();
    const t = render(<SideButton icon="gps" label="FOLLOW" active onPress={onPress} accessibilityLabel="Follow my location" />);
    const btn = real(t, 'Follow my location');
    expect(btn.props.accessibilityState.selected).toBe(true);
    act(() => btn.props.onPress({}));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(12);
  });

  it('ControlKey press calls the handler with the select haptic', () => {
    const onPress = jest.fn();
    const t = render(<ControlKey icon="haz" label="Hazard" onPress={onPress} accessibilityLabel="Report a hazard" />);
    act(() => real(t, 'Report a hazard').props.onPress({}));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(12);
  });
});

describe('ControlKey push-to-talk / glove, SpeedCluster units', () => {
  afterEach(() => mounted.splice(0).forEach((t) => act(() => t.unmount())));
  it('forwards press-in / press-out (hold to talk) and shows the active state', () => {
    const onIn = jest.fn(), onOut = jest.fn();
    const t = render(<ControlKey icon="mic" label="Talk" active onPressIn={onIn} onPressOut={onOut} accessibilityLabel="Talk to the crew" />);
    const key = real(t, 'Talk to the crew');
    act(() => key.props.onPressIn({}));
    act(() => key.props.onPressOut({}));
    expect(onIn).toHaveBeenCalledTimes(1);
    expect(onOut).toHaveBeenCalledTimes(1);
    const hosts = t.root.findAll((n) => n.props.accessibilityLabel === 'Talk to the crew' && typeof n.type === 'string');
    expect(hosts[0].props.accessibilityState).toMatchObject({ selected: true });
  });
  it('glove mode makes the key 104 high', () => {
    const { StyleSheet } = require('react-native');
    const t = render(<ControlKey icon="haz" label="Hazard" glove onPress={jest.fn()} accessibilityLabel="Report a hazard" />);
    expect(StyleSheet.flatten(real(t, 'Report a hazard').props.style).height).toBe(104);
  });
  it('SpeedCluster converts to miles and labels MPH', () => {
    const t = render(<SpeedCluster speedKmh={96.56} etaClock="08:00" remainingKm={16.09344} toLabel="Lonavala" units="mi" />);
    const txt = (id: string) => t.root.findAll((n) => n.props.testID === id && typeof n.type === 'string')[0].props.children;
    expect(txt('speed-value')).toBe('60');
    expect(txt('speed-unit')).toBe('MPH');
  });
});

describe('SignalSheet (motion)', () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    mounted.splice(0).forEach((t) => act(() => t.unmount()));
    (Platform as any).OS = originalOS;
    jest.useRealTimers();
  });
  beforeEach(() => {
    mockSocket.connected = true;
    mockSocket.emit.mockClear();
    useToastStore.setState({ toasts: [] });
  });

  it('every option is a pressable that emits only an allowlisted label', () => {
    const t = render(<SignalSheet visible groupId="g" riderId="r" onSend={jest.fn()} />);
    SIGNAL_OPTIONS.forEach((o) => {
      act(() => real(t, `Send signal: ${o.label}`).props.onPress({}));
    });
    const labels = mockSocket.emit.mock.calls.map((c) => c[1].label);
    expect(labels).toEqual(['Wait up', 'Pull over', 'All good', 'Need fuel']);
    mockSocket.emit.mock.calls.forEach((c) => expect(c[0]).toBe('signal:send'));
  });

  it('select haptic only when a signal really goes out', () => {
    (Platform as any).OS = 'android';
    const vibrate = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);
    vibrate.mockClear();
    const t = render(<SignalSheet visible groupId="g" riderId="r" onSend={jest.fn()} />);
    act(() => real(t, 'Send signal: All good').props.onPress({}));
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(12);
    vibrate.mockClear();
    mockSocket.connected = false;
    act(() => real(t, 'Send signal: All good').props.onPress({}));
    expect(vibrate).not.toHaveBeenCalled();
    expect(mockSocket.emit).toHaveBeenCalledTimes(1);
    vibrate.mockRestore();
  });

  it('closing keeps the menu mounted for the exit animation, then removes it', () => {
    jest.useFakeTimers();
    const t = render(<SignalSheet visible groupId="g" riderId="r" onSend={jest.fn()} />);
    act(() => t.update(<SignalSheet visible={false} groupId="g" riderId="r" onSend={jest.fn()} />));
    // Still rendered, but not interactive while it animates out.
    expect(t.toJSON()).not.toBeNull();
    const menu = t.root.findAll((n) => n.props.pointerEvents === 'none' && n.props.style)[0];
    expect(menu).toBeDefined();
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(t.toJSON()).toBeNull();
  });
});

describe('AvatarStack', () => {
  afterEach(() => {
    mounted.splice(0).forEach((t) => act(() => t.unmount()));
  });
  const initialsOf = (t: ReactTestRenderer) =>
    t.root.findAllByType(Text).map((n) => [n.props.children].flat().join(''));

  it('renders initials, +N overflow, and nothing when empty', () => {
    const t = render(<AvatarStack names={['alice', 'bob', 'carol', 'dave', 'erin', 'frank']} max={4} />);
    expect(initialsOf(t)).toEqual(['AL', 'BO', 'CA', 'DA', '+2']);
    const empty = render(<AvatarStack names={[]} />);
    expect(empty.toJSON()).toBeNull();
  });

  it('shifts the initials of every covered avatar (all but the last) so they stay readable', () => {
    const t = render(<AvatarStack names={['alice', 'bob', 'carol']} />);
    const pads = t.root
      .findAll((n) => typeof n.type === 'string' && n.props.accessibilityLabel && ['AL', 'BO', 'CA'].includes(n.props.accessibilityLabel))
      .map((n) => StyleSheet.flatten(n.props.style).paddingRight);
    expect(pads).toEqual([9, 9, undefined]);
    // with a +N chip after them, the last avatar is covered too
    const more = render(<AvatarStack names={['alice', 'bob', 'carol']} max={2} />);
    const padsMore = more.root
      .findAll((n) => typeof n.type === 'string' && n.props.accessibilityLabel && ['AL', 'BO'].includes(n.props.accessibilityLabel))
      .map((n) => StyleSheet.flatten(n.props.style).paddingRight);
    expect(padsMore).toEqual([9, 9]);
  });

  it('a rider who joins later is added without disturbing the others', () => {
    const t = render(<AvatarStack names={['alice', 'bob']} />);
    expect(initialsOf(t)).toEqual(['AL', 'BO']);
    act(() => t.update(<AvatarStack names={['alice', 'bob', 'carol']} />));
    expect(initialsOf(t)).toEqual(['AL', 'BO', 'CA']);
  });
});

describe('NetworkBanner', () => {
  afterEach(() => {
    mounted.splice(0).forEach((t) => act(() => t.unmount()));
    jest.useRealTimers();
  });

  it('recovered auto-dismisses after 2.5 s once, even when the parent re-renders', () => {
    jest.useFakeTimers();
    const onDismiss = jest.fn();
    const t = render(<NetworkBanner state="recovered" riderName="Rider 1" onDismiss={() => onDismiss()} />);
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    // New onDismiss identity (parent re-render) must not restart the timer.
    act(() => t.update(<NetworkBanner state="recovered" riderName="Rider 1" onDismiss={() => onDismiss()} />));
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('lost stays up and has no dismiss button', () => {
    const t = render(<NetworkBanner state="lost" riderName="Rider 1" />);
    expect(t.root.findAll((n) => n.props.accessibilityLabel === 'Dismiss notification')).toHaveLength(0);
  });

  it('recovered dismiss button calls onDismiss', () => {
    const onDismiss = jest.fn();
    const t = render(<NetworkBanner state="recovered" riderName="Rider 1" onDismiss={onDismiss} />);
    act(() => real(t, 'Dismiss notification').props.onPress({}));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('clockAfter (ETA clock)', () => {
  it('has no leading zero on the hour, like the demo (8:01), and keeps two-digit minutes', () => {
    const now = new Date(2026, 9, 4, 5, 0);
    expect(clockAfter(166, now)).toBe('7:46');
    expect(clockAfter(61, new Date(2026, 9, 4, 7, 0))).toBe('8:01');
    expect(clockAfter(0, new Date(2026, 9, 4, 0, 5))).toBe('0:05');
    expect(clockAfter(0, new Date(2026, 9, 4, 17, 30))).toBe('17:30');
  });
});
