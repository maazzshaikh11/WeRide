/**
 * Shared interaction primitives (src/ui): press feedback, buttons, fields,
 * entrance animation, haptics.
 */
import React from 'react';
import { Platform, Text, Vibration } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Button, FadeIn, PressableCard, PressableScale, Skeleton, TextField } from '../src/ui';
import { haptic, setHapticsEnabled } from '../src/ui/haptics';

const mounted: ReactTestRenderer[] = [];
function render(el: React.ReactElement) {
  let t!: ReactTestRenderer;
  act(() => {
    t = create(el);
  });
  mounted.push(t);
  return t;
}
afterEach(() => {
  mounted.splice(0).forEach((t) => act(() => t.unmount()));
  setHapticsEnabled(true);
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.clearAllTimers();
  jest.useRealTimers();
});

/** The actual pressable (findByProps would return the outer wrapper component). */
const pressable = (t: ReactTestRenderer, label: string) =>
  t.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPressIn === 'function')[0];

beforeEach(() => {
  jest.clearAllMocks();
  // Fake timers from the start so animations started in a test can be flushed
  // (and cannot fire after the environment is torn down).
  jest.useFakeTimers();
});

const texts = (t: ReactTestRenderer) =>
  t.root.findAll((n) => (n.type as unknown) === 'Text').map((n) => String(n.props.children));

describe('haptics', () => {
  const original = Platform.OS;
  afterEach(() => {
    (Platform as any).OS = original;
    jest.restoreAllMocks();
  });

  it('Android: taps are a short tick, errors a pattern', () => {
    (Platform as any).OS = 'android';
    const spy = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);
    haptic('tap');
    haptic('error');
    expect(spy).toHaveBeenNthCalledWith(1, 8);
    expect(spy).toHaveBeenNthCalledWith(2, [0, 45, 60, 45, 60, 80]);
  });

  it('iOS: routine taps stay silent (Vibration is a fixed ~0.4s buzz); warnings/errors buzz', () => {
    (Platform as any).OS = 'ios';
    const spy = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);
    haptic('tap');
    haptic('select');
    haptic('success');
    expect(spy).not.toHaveBeenCalled();
    haptic('error');
    haptic('heavy');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('can be switched off globally', () => {
    (Platform as any).OS = 'android';
    const spy = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);
    setHapticsEnabled(false);
    haptic('error');
    expect(spy).not.toHaveBeenCalled();
  });

  it('never throws if the vibrator is unavailable', () => {
    (Platform as any).OS = 'android';
    jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {
      throw new Error('no vibrator');
    });
    expect(() => haptic('tap')).not.toThrow();
  });
});

describe('PressableScale', () => {
  it('calls onPress and plays the requested haptic', () => {
    (Platform as any).OS = 'android';
    const spy = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);
    const onPress = jest.fn();
    const t = render(
      <PressableScale onPress={onPress} haptic="select" accessibilityLabel="go">
        <Text>go</Text>
      </PressableScale>,
    );
    const node = pressable(t, 'go');
    act(() => node.props.onPressIn({}));
    act(() => node.props.onPress({}));
    act(() => node.props.onPressOut({}));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(12);
    (Platform as any).OS = 'ios';
    jest.restoreAllMocks();
  });

  it('haptic={false} is silent', () => {
    (Platform as any).OS = 'android';
    const spy = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);
    const t = render(
      <PressableScale haptic={false} onPress={() => undefined} accessibilityLabel="quiet">
        <Text>q</Text>
      </PressableScale>,
    );
    act(() => pressable(t, 'quiet').props.onPress({}));
    expect(spy).not.toHaveBeenCalled();
    (Platform as any).OS = 'ios';
    jest.restoreAllMocks();
  });

  it('disabled is exposed to accessibility', () => {
    const t = render(
      <PressableScale disabled accessibilityLabel="off">
        <Text>x</Text>
      </PressableScale>,
    );
    const node = pressable(t, 'off');
    expect(node.props.disabled).toBe(true);
    expect(node.props.accessibilityState.disabled).toBe(true);
  });
});

describe('PressableCard', () => {
  it('renders children, is pressable, and marks active cards with the accent border', () => {
    const onPress = jest.fn();
    const t = render(
      <PressableCard onPress={onPress} active accessibilityLabel="ride card">
        <Text>Sunday run</Text>
      </PressableCard>,
    );
    expect(texts(t)).toContain('Sunday run');
    const node = pressable(t, 'ride card');
    act(() => node.props.onPressIn({}));
    act(() => node.props.onPress({}));
    act(() => node.props.onPressOut({}));
    expect(onPress).toHaveBeenCalled();
    const flat = ([] as any[]).concat(node.props.style).flat(3).filter(Boolean);
    expect(flat.some((s: any) => s.borderColor === '#FF5C00')).toBe(true);
  });
});

describe('Button', () => {
  it('shows its label and presses', () => {
    const onPress = jest.fn();
    const t = render(<Button label="Create ride" onPress={onPress} />);
    expect(texts(t)).toContain('Create ride');
    act(() => pressable(t, 'Create ride').props.onPress({}));
    expect(onPress).toHaveBeenCalled();
  });

  it('loading: busy + disabled, label stays in layout (no size jump)', () => {
    const t = render(<Button label="Sign in" loading onPress={() => undefined} />);
    const node = pressable(t, 'Sign in');
    expect(node.props.disabled).toBe(true);
    expect(node.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    expect(texts(t)).toContain('Sign in');
  });

  it('danger uses the warning haptic by default', () => {
    (Platform as any).OS = 'android';
    const spy = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);
    const t = render(<Button label="Leave" variant="danger" onPress={() => undefined} />);
    act(() => pressable(t, 'Leave').props.onPress({}));
    expect(spy).toHaveBeenCalledWith([0, 30, 50, 30]);
    (Platform as any).OS = 'ios';
    jest.restoreAllMocks();
  });
});

describe('TextField', () => {
  it('shows the error under the field and forwards focus/blur', () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    const t = render(
      <TextField accessibilityLabel="Email" error="Enter a valid email." onFocus={onFocus} onBlur={onBlur} />,
    );
    expect(texts(t)).toContain('Enter a valid email.');
    const input = t.root.findByProps({ accessibilityLabel: 'Email' });
    act(() => input.props.onFocus({}));
    act(() => input.props.onBlur({}));
    expect(onFocus).toHaveBeenCalled();
    expect(onBlur).toHaveBeenCalled();
  });

  it('renders no error text when valid', () => {
    const t = render(<TextField accessibilityLabel="Email" error={null} />);
    expect(texts(t)).toEqual([]);
  });
});

describe('FadeIn / Skeleton', () => {
  it('FadeIn renders its children', () => {
    const t = render(
      <FadeIn index={3}>
        <Text>row</Text>
      </FadeIn>,
    );
    expect(texts(t)).toContain('row');
  });

  it('Skeleton is hidden from accessibility', () => {
    const t = render(<Skeleton width={120} height={20} />);
    const hidden = t.root.findAll((n) => n.props.accessibilityElementsHidden === true);
    expect(hidden.length).toBeGreaterThan(0);
  });
});
