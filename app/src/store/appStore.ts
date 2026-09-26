/**
 * Root Zustand store. Replaces Flutter's Riverpod.
 * Slices are composed here; each person can add their own slice in their module.
 *
 * For per-module state (A's location stream, B's hazard list, C's route, D's VOX),
 * use the module-local stores under modules/<name>/src — not this file.
 * This root store holds shared app-level state (current group, auth user).
 *
 * Extended per master spec §14: familySharingEnabled, socketConnected, currentTab.
 */
import { create } from 'zustand';

export type TabName = 'Home' | 'Stops' | 'Voice' | 'Family' | 'Alerts' | 'History';

interface AppState {
  userId: string | null;
  groupId: string | null;
  familySharingEnabled: boolean;
  socketConnected: boolean;
  currentTab: TabName;
  setUserId: (id: string | null) => void;
  setGroupId: (id: string | null) => void;
  setFamilySharingEnabled: (on: boolean) => void;
  setSocketConnected: (connected: boolean) => void;
  setCurrentTab: (tab: TabName) => void;
}

export const useAppStore = create<AppState>((set) => ({
  userId: null,
  groupId: null,
  familySharingEnabled: false,
  socketConnected: false,
  currentTab: 'Home',
  setUserId: (id) => set({ userId: id }),
  setGroupId: (id) => set({ groupId: id }),
  setFamilySharingEnabled: (on) => set({ familySharingEnabled: on }),
  setSocketConnected: (connected) => set({ socketConnected: connected }),
  setCurrentTab: (tab) => set({ currentTab: tab }),
}));