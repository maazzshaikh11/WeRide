/**
 * Haptic feedback with no native dependency (React Native's Vibration API).
 *
 * Reality of that API: Android honours duration/patterns, so taps get a crisp
 * 8-12 ms tick. iOS ignores duration and always buzzes ~0.4 s, which is far too
 * heavy for a button tap — so on iOS only the meaningful events (warning /
 * error / heavy: SOS, failures) vibrate and routine taps stay silent.
 * If a real haptics library (e.g. a Taptic Engine binding) is added later, only
 * `play()` below needs to change.
 */
import { Platform, Vibration } from 'react-native';

export type HapticKind = 'tap' | 'select' | 'success' | 'warning' | 'error' | 'heavy';

const ANDROID_PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 8,
  select: 12,
  success: [0, 14, 60, 14],
  warning: [0, 30, 50, 30],
  error: [0, 45, 60, 45, 60, 80],
  heavy: 45,
};
const IOS_KINDS: ReadonlySet<HapticKind> = new Set(['warning', 'error', 'heavy']);

let enabled = true;

export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}
export function hapticsEnabled(): boolean {
  return enabled;
}

export function haptic(kind: HapticKind): void {
  if (!enabled) return;
  try {
    if (Platform.OS === 'android') {
      Vibration.vibrate(ANDROID_PATTERNS[kind]);
    } else if (IOS_KINDS.has(kind)) {
      Vibration.vibrate();
    }
  } catch {
    // Vibration unavailable (simulator, permission) — feedback is optional.
  }
}
