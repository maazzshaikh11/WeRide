/**
 * The signed-in rider's ride logs, live (users/{uid}/ride_logs, newest first). Several screens may `watch` the same
 * uid; one Firestore listener is shared and closed when the last one lets go.
 */
import { create } from 'zustand';
import type { RideLog } from '../models/domain';
import { subscribeRideLogs } from '../services/rideLogService';

interface RideLogsState {
  logs: RideLog[];
  /** true after the first snapshot (or an error) for the watched uid. */
  loaded: boolean;
  error: boolean;
  uid: string | null;
  watch: (uid: string) => () => void;
  clear: () => void;
}

let unsub: (() => void) | null = null;
let watchers = 0;

export const useRideLogsStore = create<RideLogsState>((set, get) => ({
  logs: [],
  loaded: false,
  error: false,
  uid: null,
  watch: (uid) => {
    if (unsub && get().uid !== uid) {
      unsub();
      unsub = null;
    }
    if (!unsub) {
      // same rider as last time: keep showing the previous list until the first snapshot replaces it
      set(get().uid === uid ? { error: false } : { uid, logs: [], loaded: false, error: false });
      unsub = subscribeRideLogs(
        uid,
        (logs) => set({ logs, loaded: true, error: false }),
        (e) => {
          // eslint-disable-next-line no-console
          console.warn('[rideLogsStore] listener failed:', e);
          set({ loaded: true, error: true });
        },
      );
      watchers = 0;
    }
    watchers += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      watchers -= 1;
      if (watchers <= 0) {
        unsub?.();
        unsub = null;
        watchers = 0;
      }
    };
  },
  clear: () => {
    unsub?.();
    unsub = null;
    watchers = 0;
    set({ logs: [], loaded: false, error: false, uid: null });
  },
}));
