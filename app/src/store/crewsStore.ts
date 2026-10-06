/**
 * The signed-in rider's crews, live (OWNER: package C1).
 * Also keeps a per-device "mute crew notifications" preference (local only: nothing is written to Firestore).
 */
import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';
import type { Crew } from '../models/domain';
import { subscribeMyCrews } from '../services/crewService';

const MUTE_KEY = 'crews.muted.v1';
let mmkv: MMKV | null = null;
function disk(): MMKV | null {
  try {
    if (!mmkv) mmkv = new MMKV({ id: 'weride_prefs' });
    return mmkv;
  } catch {
    return null;
  }
}
function readMuted(): Record<string, boolean> {
  try {
    const raw = disk()?.getString(MUTE_KEY);
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
function writeMuted(m: Record<string, boolean>): void {
  try {
    disk()?.set(MUTE_KEY, JSON.stringify(m));
  } catch {
    /* best effort */
  }
}

interface CrewsState {
  crews: Crew[];
  loaded: boolean;
  /** The listener failed (offline with nothing cached, or permissions). */
  error: boolean;
  /** crewId -> muted on this phone. */
  muted: Record<string, boolean>;
  watch: (uid: string) => () => void;
  clear: () => void;
  setMuted: (crewId: string, on: boolean) => void;
}

export const useCrewsStore = create<CrewsState>((set, get) => ({
  crews: [],
  loaded: false,
  error: false,
  muted: readMuted(),
  watch: (uid) =>
    subscribeMyCrews(
      uid,
      (crews) => set({ crews, loaded: true, error: false }),
      () => set({ loaded: true, error: true }),
    ),
  clear: () => set({ crews: [], loaded: false, error: false }),
  setMuted: (crewId, on) => {
    const next = { ...get().muted };
    if (on) next[crewId] = true;
    else delete next[crewId];
    set({ muted: next });
    writeMuted(next);
  },
}));

/** A crew by id (null while unknown / not a member). */
export const selectCrewById = (id: string | undefined) => (s: { crews: Crew[] }): Crew | null =>
  (id ? s.crews.find((c) => c.id === id) : undefined) ?? null;

export const useCrew = (id: string | undefined): Crew | null => useCrewsStore(selectCrewById(id));
