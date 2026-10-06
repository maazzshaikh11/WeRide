/**
 * CrashWatcher (OWNER: package E) — mounted once at the root. While a ride is live (appStore.groupId) and crash detection
 * is on (prefs.crash) it feeds the phone's accelerometer (react-native-sensors, ~50 ms) and the GPS speed of the last
 * trusted fix into the crash detector (services/crashDetector.ts); on an impact it raises the 15 s "Are you OK?" overlay.
 * The overlay's countdown, the real SOS and the 60 s cooldown are not decided here.
 */
/* eslint-disable no-console -- failures here are logged for diagnostics; the rider is told through the UI */
import { useEffect } from 'react';
import { Platform } from 'react-native';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore unresolved when compiled from app context (deps live in module node_modules)
import { accelerometer, setUpdateIntervalForType } from 'react-native-sensors';
import { useRouteStore } from '@routing/client/routeStore';
import { useAppStore } from '../store/appStore';
import { useOverlayStore } from '../store/overlayStore';
import { usePrefsStore } from '../store/prefsStore';
import { createCrashDetector } from '../services/crashDetector';
import { haptic } from '../ui/haptics';

const G = 9.80665;
/** react-native-sensors reports the accelerometer in m/s² on Android but in g on iOS: the detector wants m/s². */
export const accelScale = (): number => (Platform.OS === 'ios' ? G : 1);

/** The accelerometer is sampled this often while watching (ms). */
export const ACCEL_INTERVAL_MS = 50;
/** Overlays during which a crash must not raise another (the rider is already in an SOS / crash / call). */
const BUSY = new Set(['sos-sent', 'crash', 'call112', 'sos-incoming']);

export default function CrashWatcher() {
  const groupId = useAppStore((s) => s.groupId);
  const enabled = usePrefsStore((s) => s.prefs.crash);
  const watching = !!groupId && enabled;

  useEffect(() => {
    if (!watching) return;
    const detector = createCrashDetector(() => {
      const current = useOverlayStore.getState().current;
      if (current && BUSY.has(current.kind)) return;
      haptic('heavy');
      useOverlayStore.getState().show({ kind: 'crash' });
    });

    let lastSpeedKey = '';
    const pushSpeed = (loc: { speed_mps: number; timestamp_hlc?: string } | null) => {
      if (!loc || !Number.isFinite(loc.speed_mps)) return;
      detector.pushSpeed(loc.speed_mps, Date.now());
    };
    const unsubRoute = useRouteStore.subscribe((s, prev) => {
      if (s.lastValidLocation === prev.lastValidLocation) return;
      const key = `${s.lastValidLocation?.timestamp_hlc}`;
      if (key === lastSpeedKey) return;
      lastSpeedKey = key;
      pushSpeed(s.lastValidLocation);
    });
    pushSpeed(useRouteStore.getState().lastValidLocation);

    let sub: { unsubscribe: () => void } | null = null;
    try {
      setUpdateIntervalForType?.('accelerometer', ACCEL_INTERVAL_MS);
      sub = accelerometer.subscribe(
        ({ x, y, z }: { x: number; y: number; z: number }) => {
          const k = accelScale();
          detector.pushAccel(x * k, y * k, z * k, Date.now());
        },
        (e: unknown) => console.warn('[CrashWatcher] accelerometer unavailable:', e),
      ) as { unsubscribe: () => void } | null;
    } catch (e) {
      console.warn('[CrashWatcher] could not start the accelerometer:', e);
    }

    return () => {
      unsubRoute();
      sub?.unsubscribe?.();
      detector.reset();
    };
  }, [watching]);

  return null;
}
