/**
 * Toast feedback: one variant haptic per toast (success / warning / error),
 * fired when it appears and never again on re-render; tap dismisses; a caller
 * can mute the haptic for its own message (SOS confirmation).
 */
import React from 'react';
import { Platform, Text, Vibration } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import Toast, { muteToastHaptic } from '../src/components/Toast';
import ToastContainer from '../src/components/ToastContainer';
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

describe('Toast', () => {
  let vibrate: jest.SpyInstance;
  const originalOS = Platform.OS;

  beforeEach(() => {
    (Platform as any).OS = 'android';
    vibrate = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);
    vibrate.mockClear();
    useToastStore.setState({ toasts: [] });
  });
  afterEach(() => {
    mounted.splice(0).forEach((t) => act(() => t.unmount()));
    (Platform as any).OS = originalOS;
    vibrate.mockRestore();
  });

  it.each([
    ['success', [0, 14, 60, 14]],
    ['warn', [0, 30, 50, 30]],
    ['error', [0, 45, 60, 45, 60, 80]],
  ] as const)('%s toast fires its haptic exactly once, not on re-render', (variant, pattern) => {
    const toast = { id: 101, message: `hello ${variant}`, variant };
    const dismiss = jest.fn();
    const t = render(<Toast toast={toast} onDismiss={dismiss} />);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(pattern);

    // Re-render with the same toast (new object, new onDismiss identity): silent.
    act(() => t.update(<Toast toast={{ ...toast }} onDismiss={jest.fn()} />));
    act(() => t.update(<Toast toast={{ ...toast }} onDismiss={dismiss} />));
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('each new toast in the container buzzes once', () => {
    render(<ToastContainer />);
    act(() => useToastStore.getState().push('one', 'success'));
    expect(vibrate).toHaveBeenCalledTimes(1);
    act(() => useToastStore.getState().push('two', 'warn'));
    expect(vibrate).toHaveBeenCalledTimes(2);
    expect(vibrate).toHaveBeenLastCalledWith([0, 30, 50, 30]);
  });

  it('a muted message gets no variant haptic (once), the next identical one does', () => {
    muteToastHaptic('SOS muted');
    render(<Toast toast={{ id: 201, message: 'SOS muted', variant: 'error' }} onDismiss={jest.fn()} />);
    expect(vibrate).not.toHaveBeenCalled();
    render(<Toast toast={{ id: 202, message: 'SOS muted', variant: 'error' }} onDismiss={jest.fn()} />);
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('tap dismisses through a 44pt-min target and keeps the accessibility label', () => {
    const dismiss = jest.fn();
    const t = render(<Toast toast={{ id: 7, message: 'Saved', variant: 'success' }} onDismiss={dismiss} />);
    const press = t.root.findAll(
      (n) => n.props.accessibilityLabel === 'Dismiss notification: Saved' && typeof n.props.onPressIn === 'function',
    )[0];
    const flat = ([] as any[]).concat(press.props.style).flat(3).filter(Boolean);
    expect(flat.some((s: any) => s.minHeight >= 44)).toBe(true);
    act(() => press.props.onPress({}));
    expect(dismiss).toHaveBeenCalledWith(7);
    expect(t.root.findAllByType(Text).map((n) => n.props.children)).toContain('Saved');
  });
});
