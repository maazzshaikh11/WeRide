/**
 * The SOS flow around the existing offline-first SOS service (OWNER: package E).
 *
 * - sendSos        picks the best known position, then writes or queues the real SOS (modules/hazard-sos sosService).
 * - cancelSos      resolves it (OR-Set tombstone + Firestore or queue).
 * - respondToSos / subscribeResponders   sos_events/{id}/responders/{uid} = { state: 'going' | 'arrived', updated_ms }.
 * - triggerSosFlow the one entry point every SOS control uses: sends, then raises the red full-screen overlay
 *                  with the REAL result. A drill sends nothing.
 *
 * The overlays read the outcome of the latest send from `useSosSessionStore` (position used, queued or sent).
 */
/* eslint-disable no-console -- failures here are logged for diagnostics; the rider is told through the UI */
import firestore from '@react-native-firebase/firestore';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore this package ships no type declarations in the app context
import Geolocation from 'react-native-geolocation-service';
import { create } from 'zustand';
import { triggerSosWithStatus, resolveSos } from '@hazard/services/sosService';
import { useRouteStore } from '@routing/client/routeStore';
import { P } from '../models/paths';
import { useAppStore } from '../store/appStore';
import { useOverlayStore } from '../store/overlayStore';
import { useSessionStore } from '../store/sessionStore';
import { useToastStore } from '../store/toastStore';
import { haptic } from '../ui/haptics';
import { isRealPosition, Fix } from './sosFormat';

export interface SosSendResult {
  sosId: string;
  /** true when it was saved to the on-phone queue instead of being written to Firestore (no signal). */
  queued: boolean;
}

export interface SosResponder {
  uid: string;
  state: 'going' | 'arrived';
  updated_ms: number;
}

/** What the overlays show about the SOS that was just raised. */
export interface SosSession {
  sosId?: string;
  groupId: string;
  drill: boolean;
  auto: boolean;
  startedMs: number;
  /** Position the SOS was sent with; null when the phone had no fix at all. */
  fix: Fix | null;
  queued: boolean;
}

interface SosSessionStore {
  session: SosSession | null;
  setSession: (s: SosSession | null) => void;
  /** The queued SOS reached Firestore (signal came back). */
  markDelivered: (sosId: string) => void;
}

export const useSosSessionStore = create<SosSessionStore>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
  markDelivered: (sosId) => set((s) => (s.session?.sosId === sosId ? { session: { ...s.session, queued: false } } : s)),
}));

const myUid = (): string | null => useSessionStore.getState().uid ?? useAppStore.getState().userId;

/** Last finite fix of any quality (the map screen may report it); a rough position beats none in an emergency. */
let lastAnyFix: Fix | null = null;
export function noteAnyFix(fix: Fix | null): void {
  lastAnyFix = fix && Number.isFinite(fix.lat) && Number.isFinite(fix.lng) ? fix : null;
}

const NATIVE_FIX_TIMEOUT_MS = 3000;

function nativeFix(): Promise<Fix | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), NATIVE_FIX_TIMEOUT_MS);
    try {
      Geolocation.getCurrentPosition(
        (p: { coords: { latitude: number; longitude: number; accuracy: number } }) => {
          clearTimeout(timer);
          resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy_m: p.coords.accuracy });
        },
        () => {
          clearTimeout(timer);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: NATIVE_FIX_TIMEOUT_MS, maximumAge: 60_000 },
      );
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/** Best known position: last trusted fix, else the last fix of any quality, else the OS's cached/current position, else null. */
export async function bestKnownFix(): Promise<Fix | null> {
  const route = useRouteStore.getState();
  for (const f of [route.lastValidLocation, lastAnyFix, route.currentLocation]) {
    if (f && isRealPosition(f.lat, f.lng)) {
      return { lat: f.lat, lng: f.lng, accuracy_m: (f as { accuracy_m?: number }).accuracy_m ?? null };
    }
  }
  const native = await nativeFix();
  return native && isRealPosition(native.lat, native.lng) ? native : null;
}

/**
 * Sends (or queues) the rider's SOS with the best known position. `drill` sends nothing (returns null).
 * With no position at all the SOS is still sent/queued, at (0,0), which every reader treats as "no GPS fix yet".
 * Returns null when it could not even be saved on the phone (the caller tells the rider).
 */
export async function sendSos(opts: { groupId: string; drill?: boolean; auto?: boolean }): Promise<SosSendResult | null> {
  const drill = !!opts.drill;
  const fix = await bestKnownFix();
  const base = { groupId: opts.groupId, drill, auto: !!opts.auto, startedMs: Date.now(), fix };
  if (drill) {
    useSosSessionStore.getState().setSession({ ...base, queued: false });
    return null;
  }
  const uid = myUid();
  if (!uid) return null;
  try {
    const res = await triggerSosWithStatus(uid, opts.groupId, fix?.lat ?? 0, fix?.lng ?? 0);
    useSosSessionStore.getState().setSession({ ...base, sosId: res.sosId, queued: res.queued });
    return { sosId: res.sosId, queued: res.queued };
  } catch (e) {
    console.error('[sosFlow] SOS could not be saved:', e);
    return null;
  }
}

export async function cancelSos(sosId: string, groupId: string): Promise<void> {
  await resolveSos(sosId, groupId);
}

export async function respondToSos(sosId: string, uid: string, state: 'going' | 'arrived'): Promise<void> {
  await firestore()
    .doc(`${P.responders(sosId)}/${uid}`)
    .set({ state, updated_ms: Date.now() }, { merge: true });
}

export function subscribeResponders(sosId: string, on: (r: SosResponder[]) => void): () => void {
  try {
    return firestore()
      .collection(P.responders(sosId))
      .onSnapshot(
        (snap: any) => {
          const out: SosResponder[] = [];
          snap.docs.forEach((d: any) => {
            const data = d.data() ?? {};
            if (data.state === 'going' || data.state === 'arrived') {
              out.push({ uid: d.id, state: data.state, updated_ms: Number(data.updated_ms) || 0 });
            }
          });
          on(out);
        },
        (e: unknown) => console.warn('[sosFlow] responders listener failed:', e),
      );
  } catch (e) {
    console.warn('[sosFlow] could not watch responders:', e);
    return () => undefined;
  }
}

let inFlight = false;

/**
 * The one entry point every SOS control uses (Live / Stop / Arrive keys, crash auto-send, the drill):
 * sends or queues the SOS (sendSos) and raises the red full-screen overlay (overlayStore 'sos-sent') with the real result.
 * A second call while one is being sent or shown is ignored (one SOS at a time).
 */
export async function triggerSosFlow(groupId: string, opts?: { drill?: boolean; auto?: boolean }): Promise<void> {
  const showing = useOverlayStore.getState().current?.kind === 'sos-sent';
  if (inFlight || showing) return;
  inFlight = true;
  try {
    haptic('heavy');
    const drill = !!opts?.drill;
    const auto = !!opts?.auto;
    const res = await sendSos({ groupId, drill, auto });
    if (!drill && !res) {
      useToastStore.getState().push('Couldn’t save your SOS. Call 112 now.', 'error');
      return;
    }
    useOverlayStore.getState().show({ kind: 'sos-sent', sosId: res?.sosId, groupId, drill, auto });
  } finally {
    inFlight = false;
  }
}
