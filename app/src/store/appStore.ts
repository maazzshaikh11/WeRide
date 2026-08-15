/**
 * Root Zustand store. Replaces Flutter's Riverpod.
 * Slices are composed here; each person can add their own slice in their module.
 *
 * For per-module state (A's location stream, B's hazard list, C's route, D's VOX),
 * use the module-local stores under modules/*/src — not this file.
 * This root store holds shared app-level state (current group, auth user).
 */
import { create } from 'zustand';

interface AppState {
  userId: string | null;
  groupId: string | null;
  setUserId: (id: string | null) => void;
  setGroupId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  userId: null,
  groupId: null,
  setUserId: (id) => set({ userId: id }),
  setGroupId: (id) => set({ groupId: id }),
}));