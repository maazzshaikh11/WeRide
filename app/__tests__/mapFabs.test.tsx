/**
 * Map floating controls: FABs call their handlers and give the agreed press
 * haptics, the recenter FAB's active state cross-fades (both glyph layers stay
 * mounted), the signal menu still emits only allowlisted labels and animates
 * out before unmounting, and AvatarStack pops only riders that join later.
 */
import React from 'react';
import { Platform, Text, Vibration, View } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import Fab from '../src/components/Fab';
import NavFab from '../src/components/NavFab';
import AvatarStack from '../src/components/AvatarStack';
import NetworkBanner from '../src/components/NetworkBanner';

const mockSocket = { connected: true, emit: jest.fn() };
jest.mock('../src/services/socketService', () => ({
  getLocationSocket: () => mockSocket,
}));
import SignalMenu, { SIGNAL_OPTIONS } from '../src/components/SignalMenu';
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

describe('FABs', () => {
  let vibrate: jest.SpyInstance;
  const originalOS = Platform.OS;
  beforeEach(() => {
    (Platform as any).OS = 'android';
    vibrate = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);
    vibrate.mockClear();
    mockSocket.connected = true;
    mockSocket.emit.mockClear();
    useToastStore.setState({ toasts: [] });
  });
  afterEach(() => {
    mounted.splice(0).forEach((t) => act(() => t.unmount()));
    (Platform as any).OS = originalOS;
    vibrate.mockRestore();
  });

  it('Fab press calls the handler with the select haptic by default', () => {
    const onPress = jest.fn();
    const t = render(
      <Fab onPress={onPress} accessibilityLabel="Follow my location">
        <View />
      </Fab>,
    );
    act(() => real(t, 'Follow my location').props.onPress({}));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(12);
  });

  it('NavFab press calls the handler with the tap haptic and keeps its label', () => {
    const onPress = jest.fn();
    const t = render(<NavFab onPress={onPress} />);
    act(() => real(t, 'Navigate in Google Maps').props.onPress({}));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(8);
  });

  it('active state keeps both glyph layers mounted (cross-fade, not a swap)', () => {
    const off = <View testID="glyph-off" />;
    const on = <View testID="glyph-on" />;
    const t = render(
      <Fab active={false} activeChildren={on} accessibilityLabel="Recenter">
        {off}
      </Fab>,
    );
    const ids = () => t.root.findAll((n) => n.props.testID === 'glyph-off' || n.props.testID === 'glyph-on').length;
    const before = ids();
    expect(before).toBeGreaterThan(0);
    act(() =>
      t.update(
        <Fab active activeChildren={on} accessibilityLabel="Recenter">
          {off}
        </Fab>,
      ),
    );
    expect(ids()).toBe(before);
    expect(t.root.findAll((n) => n.props.testID === 'glyph-on').length).toBeGreaterThan(0);
    expect(t.root.findAll((n) => n.props.testID === 'glyph-off').length).toBeGreaterThan(0);
  });

  it('disabled Fab does not fire', () => {
    const onPress = jest.fn();
    const t = render(
      <Fab onPress={onPress} disabled accessibilityLabel="x">
        <View />
      </Fab>,
    );
    expect(real(t, 'x').props.disabled).toBe(true);
  });
});

describe('SignalMenu (motion)', () => {
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
    const t = render(<SignalMenu visible groupId="g" riderId="r" onSend={jest.fn()} />);
    SIGNAL_OPTIONS.forEach((o) => {
      act(() => real(t, `Send signal: ${o.label}`).props.onPress({}));
    });
    const labels = mockSocket.emit.mock.calls.map((c) => c[1].label);
    expect(labels).toEqual(['Wait for me', 'Pull over', 'All good', 'Need fuel']);
    mockSocket.emit.mock.calls.forEach((c) => expect(c[0]).toBe('signal:send'));
  });

  it('select haptic only when a signal really goes out', () => {
    (Platform as any).OS = 'android';
    const vibrate = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);
    vibrate.mockClear();
    const t = render(<SignalMenu visible groupId="g" riderId="r" onSend={jest.fn()} />);
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
    const t = render(<SignalMenu visible groupId="g" riderId="r" onSend={jest.fn()} />);
    act(() => t.update(<SignalMenu visible={false} groupId="g" riderId="r" onSend={jest.fn()} />));
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
