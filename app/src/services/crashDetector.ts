/**
 * Crash detector (docs/DEMO_PARITY_SPEC.md §3 Crash). Pure and injectable: feed it accelerometer samples (m/s²)
 * and GPS speed (m/s) with timestamps (ms); it calls `onImpact` when a crash is likely. No React, no sensors,
 * no clock of its own, so every scenario is unit-testable.
 *
 * A crash is declared only when ALL of these hold:
 *  1. IMPACT — the acceleration magnitude peaks at >= IMPACT_MS2 (about 4 g) AND at least one more sample within
 *     CONFIRM_WINDOW_MS is >= CONFIRM_MS2 (about 2 g). A single isolated sample is a sensor glitch, not a crash.
 *  2. MOVING — the rider was riding: speed >= MOVING_MS in the MOVING_WINDOW_MS before the peak, and still
 *     rolling (>= ROLLING_AT_IMPACT_MS) at the last speed sample before it. A phone dropped at rest, or at a
 *     red light, never qualifies.
 *  3. STOPPED — speed falls below STOPPED_MS within STOP_WITHIN_MS after the peak. A pothole jolt at speed that
 *     the rider rides through never stops, so it never qualifies.
 * After an impact the detector is silent for COOLDOWN_MS.
 */

/** ~4 g in m/s². */
export const IMPACT_MS2 = 39;
/** ~2 g in m/s²: a second sample this strong next to the peak confirms it is not a one-sample glitch. */
export const CONFIRM_MS2 = 20;
export const CONFIRM_WINDOW_MS = 150;
/** Moving fast enough to be riding (m/s, about 14 km/h). */
export const MOVING_MS = 4;
export const MOVING_WINDOW_MS = 5000;
/** The last speed fix before the peak must still be this fast (the rider had not already stopped). */
export const ROLLING_AT_IMPACT_MS = 2;
/** Speed below this after the peak counts as "stopped" (m/s, about 5 km/h). */
export const STOPPED_MS = 1.5;
export const STOP_WITHIN_MS = 6000;
export const COOLDOWN_MS = 60_000;
/** A speed fix older than this before the peak is too stale to say whether the rider was still rolling. */
const STALE_SPEED_MS = 3000;

export interface CrashDetector {
  /** One accelerometer sample (m/s², gravity included) at time `t` (ms). */
  pushAccel(x: number, y: number, z: number, t: number): void;
  /** One GPS speed reading (m/s) at time `t` (ms). */
  pushSpeed(mps: number, t: number): void;
  /** Forget everything (also ends a cooldown). */
  reset(): void;
}

export function createCrashDetector(onImpact: (info: { t: number; peakMs2: number }) => void): CrashDetector {
  let accel: { t: number; mag: number }[] = [];
  let speeds: { t: number; v: number }[] = [];
  let armed: { peakT: number; peakMs2: number } | null = null;
  let quietUntil = -Infinity;

  const fire = (t: number, peakMs2: number) => {
    armed = null;
    accel = [];
    quietUntil = t + COOLDOWN_MS;
    onImpact({ t, peakMs2 });
  };

  /** Called with a confirmed peak: decides whether the rider was moving. */
  const arm = (peakT: number, peakMs2: number) => {
    const inWindow = speeds.filter((s) => s.t >= peakT - MOVING_WINDOW_MS && s.t <= peakT);
    if (!inWindow.some((s) => s.v >= MOVING_MS)) return;
    const last = inWindow[inWindow.length - 1];
    if (last && peakT - last.t <= STALE_SPEED_MS && last.v < ROLLING_AT_IMPACT_MS) return; // had already stopped
    armed = { peakT, peakMs2 };
  };

  return {
    pushAccel(x, y, z, t) {
      if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) && Number.isFinite(t))) return;
      if (t < quietUntil) return;
      if (armed && t - armed.peakT > STOP_WITHIN_MS) armed = null; // never stopped: a pothole, not a crash
      const mag = Math.sqrt(x * x + y * y + z * z);
      accel.push({ t, mag });
      accel = accel.filter((a) => t - a.t <= CONFIRM_WINDOW_MS);
      if (armed) return;
      const strong = accel.filter((a) => a.mag >= CONFIRM_MS2);
      if (strong.length < 2) return;
      const peak = strong.reduce((m, a) => (a.mag > m.mag ? a : m));
      if (peak.mag < IMPACT_MS2) return;
      arm(peak.t, peak.mag);
      accel = [];
    },

    pushSpeed(mps, t) {
      if (!(Number.isFinite(mps) && Number.isFinite(t)) || mps < 0) return;
      if (t < quietUntil) return;
      speeds.push({ t, v: mps });
      speeds = speeds.filter((s) => t - s.t <= MOVING_WINDOW_MS + STOP_WITHIN_MS);
      if (!armed) return;
      if (t - armed.peakT > STOP_WITHIN_MS) {
        armed = null;
        return;
      }
      if (t >= armed.peakT && mps < STOPPED_MS) fire(t, armed.peakMs2);
    },

    reset() {
      accel = [];
      speeds = [];
      armed = null;
      quietUntil = -Infinity;
    },
  };
}
