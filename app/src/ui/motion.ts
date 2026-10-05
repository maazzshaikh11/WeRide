/**
 * Motion tokens + reduced-motion hook. Every animated primitive in src/ui reads
 * from here so timing feels like one system (and can be tuned in one place).
 *
 * Only opacity/transform are animated with the native driver, so animations
 * stay on the UI thread and never drop frames while JS is busy (the map and
 * tracking loop keep JS busy).
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export const Motion = {
  /** Press-in is quick so it feels attached to the finger; release eases back. */
  press: { inMs: 90, outMs: 180 },
  /** Scale a pressed control shrinks to. Cards move less than buttons. */
  scale: { control: 0.96, card: 0.985 },
  /** List/screen entrance. */
  enter: { durationMs: 280, distance: 12, staggerMs: 45, maxStaggered: 8 },
  /** Spring used when something settles back (release, sheet snap). */
  spring: { friction: 7, tension: 160 },
  focus: { durationMs: 140 },
  shake: { stepMs: 55, distance: 6 },
} as const;

/**
 * True when the OS "reduce motion" setting is on. Decorative motion must be
 * skipped (state changes still happen — just without the movement).
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    try {
      AccessibilityInfo.isReduceMotionEnabled?.()
        .then((v) => alive && setReduced(Boolean(v)))
        .catch(() => undefined);
      const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) =>
        setReduced(Boolean(v)),
      );
      return () => {
        alive = false;
        sub?.remove?.();
      };
    } catch {
      return () => {
        alive = false;
      };
    }
  }, []);
  return reduced;
}
