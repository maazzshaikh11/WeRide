/**
 * The signed-in rider's public profile, plus a cache of other riders' profiles (for names/bikes/avatars).
 * `ensure(uids)` fetches only the ones not cached yet.
 */
import { create } from 'zustand';
import type { UserProfile } from '../models/domain';
import { getProfiles, subscribeProfile } from '../services/userService';

interface ProfileState {
  me: UserProfile | null;
  byId: Record<string, UserProfile>;
  /** Start listening to my own profile; returns the unsubscribe. */
  watchMe: (uid: string) => () => void;
  /** Fetch + cache profiles for these uids (skips cached ones). */
  ensure: (uids: string[]) => Promise<void>;
  clear: () => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  me: null,
  byId: {},
  watchMe: (uid) =>
    subscribeProfile(
      uid,
      (p) => set((s) => ({ me: p, byId: p ? { ...s.byId, [uid]: p } : s.byId })),
      (e) => console.warn('[profileStore] profile listener failed:', e),
    ),
  ensure: async (uids) => {
    const missing = uids.filter((u) => u && !get().byId[u]);
    if (missing.length === 0) return;
    try {
      const got = await getProfiles(missing);
      set((s) => ({ byId: { ...s.byId, ...got } }));
    } catch (e) {
      console.warn('[profileStore] could not load profiles:', e);
    }
  },
  clear: () => set({ me: null, byId: {} }),
}));

/** Display name for any rider id; "Rider 1234" if their profile is unknown (never invents a name). */
export function riderName(byId: Record<string, UserProfile>, uid: string, myUid?: string | null): string {
  if (myUid && uid === myUid) return 'You';
  return byId[uid]?.name ?? `Rider ${uid.slice(-4)}`;
}

/** Initials for an avatar: two letters from the name, else the last two characters of the id. */
export function riderInitials(byId: Record<string, UserProfile>, uid: string): string {
  const n = byId[uid]?.name;
  if (n) {
    const parts = n.trim().split(/\s+/).filter(Boolean);
    const s = parts.length > 1 ? parts[0][0] + parts[1][0] : n.trim().slice(0, 2);
    return s.toUpperCase();
  }
  return uid.slice(-2).toUpperCase();
}
