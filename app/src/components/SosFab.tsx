/**
 * SosFab — the SOS control of the live screen (demo.html `.ctl.sos`): a 96×88
 * outlined-red key. It keeps the anti-accidental press-and-hold (the rider's
 * chosen 1.0 / 1.5 / 2.0 s, prefs.hold_ms); while held, a red fill rises from
 * the bottom and the key flips to solid red.
 * On a complete hold -> `onHoldComplete` (the SOS is sent straight away, there is no confirm step).
 *
 * Feel:
 *  - the key depresses while held (PressableScale) and springs back on release;
 *  - `haptic('warning')` once the hold registers (REGISTER_MS — a brush or tap
 *    never buzzes), `haptic('heavy')` when it completes;
 *  - releasing early cancels everything: no completion, no further haptic.
 * The fill is a single transform driven natively (scaleY from the bottom edge).
 */
import React, { useEffect, useRef } from 'react';
import { Text, Animated } from 'react-native';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import { haptic, PressableScale } from '../ui';
import { usePrefsStore } from '../store/prefsStore';
import { CAP } from '../theme/textPolicy';

/** The hold must persist this long before it "registers" (warning haptic). */
const REGISTER_MS = 200;
export const SOS_KEY_W = 96;
export const SOS_KEY_H = 88;

/** "1", "1.5", "2" — the hold time in seconds for labels. */
export function holdSeconds(ms: number): string {
  return String(ms / 1000);
}

interface Props {
  onHoldComplete: () => void;
  disabled?: boolean;
  /** Key size; the Live screen passes its height-aware sizes (default 96 x 88, the demo's). */
  width?: number;
  height?: number;
}

export default function SosFab({ onHoldComplete, disabled, width = SOS_KEY_W, height = SOS_KEY_H }: Props) {
  const { colors, type } = useTheme();
  const holdMs = usePrefsStore((st) => st.prefs.hold_ms);
  const [armed, setArmed] = React.useState(false);
  const styles = useStyles(({ colors: c }) => ({
    key: { borderRadius: 24, borderWidth: 3, borderColor: c.bad, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 4 },
    fill: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.bad },
  }));
  const progress = useRef(new Animated.Value(0)).current;
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const registerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdingRef = useRef(false);

  const clearTimers = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (registerTimer.current) clearTimeout(registerTimer.current);
    holdTimer.current = null;
    registerTimer.current = null;
  };

  const resetRing = (durationMs: number) => {
    progress.stopAnimation();
    Animated.timing(progress, {
      toValue: 0,
      duration: durationMs,
      useNativeDriver: true,
    }).start();
  };

  const cancelHold = () => {
    holdingRef.current = false;
    setArmed(false);
    clearTimers();
    resetRing(150);
  };

  useEffect(() => {
    return () => {
      clearTimers();
      progress.stopAnimation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startHold = () => {
    if (disabled || holdingRef.current) return;
    holdingRef.current = true;
    setArmed(true);
    progress.stopAnimation();
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: holdMs,
      useNativeDriver: true,
      easing: (t: number) => t,
    }).start();
    registerTimer.current = setTimeout(() => {
      registerTimer.current = null;
      haptic('warning');
    }, REGISTER_MS);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      holdingRef.current = false;
      setArmed(false);
      if (registerTimer.current) {
        clearTimeout(registerTimer.current);
        registerTimer.current = null;
      }
      haptic('heavy');
      // Flash the full ring briefly, then clear it (the release may never be
      // delivered once the SOS screen takes over the touch).
      resetRing(350);
      onHoldComplete();
    }, holdMs);
  };

  const fg = armed ? '#FFFFFF' : colors.bad;

  return (
    <PressableScale
      onPressIn={startHold}
      onPressOut={cancelHold}
      disabled={disabled}
      haptic={false}
      scaleTo={0.95}
      style={[styles.key, { width, height }]}
      testID="sos-key"
      accessibilityLabel={`Hold for ${holdSeconds(holdMs)} ${holdMs === 1000 ? 'second' : 'seconds'} to send SOS`}
      accessibilityHint="Press and hold to send an SOS to your crew"
      accessibilityRole="button"
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.fill,
          {
            height,
            transform: [
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [height / 2, 0] }) },
              { scaleY: progress },
            ],
          },
        ]}
      />
      <Text style={[type.h2, { color: fg, fontFamily: type.plateTitle.fontFamily, fontSize: 26, lineHeight: 26 }]} maxFontSizeMultiplier={CAP.fixed}>SOS</Text>
      <Text style={[type.tab, { color: fg, fontSize: 10, lineHeight: 12 }]} maxFontSizeMultiplier={CAP.fixed}>HOLD</Text>
    </PressableScale>
  );
}
