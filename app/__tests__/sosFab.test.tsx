/**
 * SosFab: the 2 s hold guard is unchanged (completes only after the full hold,
 * early release cancels) and the hold now gives tactile feedback:
 * 'warning' once the hold registers, 'heavy' on completion, nothing on an
 * early release. Vibration is spied with Platform.OS = 'android' so the real
 * haptic patterns are observable.
 */
import React from 'react';
import { Platform, Vibration } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import SosFab from '../src/components/SosFab';

const LABEL = 'Hold for 2 seconds to send SOS';
const WARNING = [0, 30, 50, 30];
const HEAVY = 45;

const mounted: ReactTestRenderer[] = [];
function render(el: React.ReactElement) {
  let t!: ReactTestRenderer;
  act(() => {
    t = create(el);
  });
  mounted.push(t);
  return t;
}
const button = (t: ReactTestRenderer) =>
  t.root.findAll((n) => n.props.accessibilityLabel === LABEL && typeof n.props.onPressIn === 'function')[0];

describe('SosFab hold-to-trigger', () => {
  let vibrate: jest.SpyInstance;
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.useFakeTimers();
    (Platform as any).OS = 'android';
    vibrate = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);
    vibrate.mockClear(); // RN's jest setup already mocks Vibration
  });
  afterEach(() => {
    mounted.splice(0).forEach((t) => act(() => t.unmount()));
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    (Platform as any).OS = originalOS;
    vibrate.mockRestore();
  });

  it('completes only after the full 2 s hold, with warning then heavy haptics', () => {
    const onHoldComplete = jest.fn();
    const t = render(<SosFab onHoldComplete={onHoldComplete} />);

    act(() => button(t).props.onPressIn({}));
    act(() => {
      jest.advanceTimersByTime(250); // past the registration threshold
    });
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenLastCalledWith(WARNING);
    expect(onHoldComplete).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1600); // 1.85 s: still holding
    });
    expect(onHoldComplete).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(200); // 2.05 s
    });
    expect(onHoldComplete).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledTimes(2);
    expect(vibrate).toHaveBeenLastCalledWith(HEAVY);
  });

  it('early release: no completion, no heavy haptic, and a later timer fires nothing', () => {
    const onHoldComplete = jest.fn();
    const t = render(<SosFab onHoldComplete={onHoldComplete} />);

    act(() => button(t).props.onPressIn({}));
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(vibrate).toHaveBeenCalledTimes(1); // only the warning from the registered hold
    act(() => button(t).props.onPressOut({}));
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(onHoldComplete).not.toHaveBeenCalled();
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('a quick tap (released before the hold registers) gives no haptic at all', () => {
    const onHoldComplete = jest.fn();
    const t = render(<SosFab onHoldComplete={onHoldComplete} />);
    act(() => button(t).props.onPressIn({}));
    act(() => {
      jest.advanceTimersByTime(100);
    });
    act(() => button(t).props.onPressOut({}));
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(vibrate).not.toHaveBeenCalled();
    expect(onHoldComplete).not.toHaveBeenCalled();
  });

  it('can be held again after an early release', () => {
    const onHoldComplete = jest.fn();
    const t = render(<SosFab onHoldComplete={onHoldComplete} />);
    act(() => button(t).props.onPressIn({}));
    act(() => {
      jest.advanceTimersByTime(500);
    });
    act(() => button(t).props.onPressOut({}));
    act(() => button(t).props.onPressIn({}));
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(onHoldComplete).toHaveBeenCalledTimes(1);
  });

  it('disabled: pressing does nothing', () => {
    const onHoldComplete = jest.fn();
    const t = render(<SosFab onHoldComplete={onHoldComplete} disabled />);
    act(() => button(t).props.onPressIn({}));
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(onHoldComplete).not.toHaveBeenCalled();
    expect(vibrate).not.toHaveBeenCalled();
    expect(button(t).props.disabled).toBe(true);
  });

  it('keeps the accessibility label/hint', () => {
    const t = render(<SosFab onHoldComplete={jest.fn()} />);
    expect(button(t).props.accessibilityHint).toBe('Press and hold to open the SOS confirmation');
    expect(button(t).props.accessibilityRole).toBe('button');
  });

  it('unmounting mid-hold clears the timers (no late completion)', () => {
    const onHoldComplete = jest.fn();
    const t = render(<SosFab onHoldComplete={onHoldComplete} />);
    act(() => button(t).props.onPressIn({}));
    act(() => t.unmount());
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(onHoldComplete).not.toHaveBeenCalled();
  });
});
