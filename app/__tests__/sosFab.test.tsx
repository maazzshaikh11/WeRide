/**
 * SosFab: the hold guard is unchanged (completes only after the full hold, which is the rider's
 * prefs.hold_ms: 1.0 / 1.5 / 2.0 s; early release cancels) and the hold gives tactile feedback:
 * 'warning' once the hold registers, 'heavy' on completion, nothing on an
 * early release. Vibration is spied with Platform.OS = 'android' so the real
 * haptic patterns are observable.
 */
import React from 'react';
import { Platform, Vibration } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import SosFab from '../src/components/SosFab';
import { usePrefsStore } from '../src/store/prefsStore';
import { DEFAULT_PREFS, HoldMs } from '../src/models/domain';

const setHold = (hold_ms: HoldMs) => usePrefsStore.setState({ prefs: { ...DEFAULT_PREFS, hold_ms } });
let LABEL = 'Hold for 2 seconds to send SOS';
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
    setHold(2000);
    LABEL = 'Hold for 2 seconds to send SOS';
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

  it('completes only after the full hold (2 s pref), with warning then heavy haptics', () => {
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
    expect(button(t).props.accessibilityHint).toBe('Press and hold to send an SOS to your crew');
    expect(button(t).props.accessibilityRole).toBe('button');
  });

  it.each([
    [1000, 'Hold for 1 second to send SOS'],
    [1500, 'Hold for 1.5 seconds to send SOS'],
    [2000, 'Hold for 2 seconds to send SOS'],
  ] as const)('uses the rider\'s hold-time pref: %i ms completes at exactly that time, not before', (ms, label) => {
    setHold(ms);
    LABEL = label;
    const onHoldComplete = jest.fn();
    const t = render(<SosFab onHoldComplete={onHoldComplete} />);
    expect(button(t).props.accessibilityLabel).toBe(label);
    act(() => button(t).props.onPressIn({}));
    act(() => {
      jest.advanceTimersByTime(ms - 100);
    });
    expect(onHoldComplete).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(150);
    });
    expect(onHoldComplete).toHaveBeenCalledTimes(1);
  });

  it('changing the pref re-times the next hold', () => {
    const onHoldComplete = jest.fn();
    const t = render(<SosFab onHoldComplete={onHoldComplete} />);
    act(() => setHold(1000));
    LABEL = 'Hold for 1 second to send SOS';
    act(() => button(t).props.onPressIn({}));
    act(() => {
      jest.advanceTimersByTime(1050);
    });
    expect(onHoldComplete).toHaveBeenCalledTimes(1);
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
