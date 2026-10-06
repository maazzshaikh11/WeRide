/**
 * Full-screen overlays that must work from every screen (SOS sent / incoming, crash countdown, 112 call,
 * roll-out countdown). Mounted once by OverlayHost; anything may `show()` one.
 */
import { create } from 'zustand';

export type OverlayState =
  | { kind: 'sos-sent'; sosId?: string; groupId?: string; drill?: boolean; auto?: boolean }
  | { kind: 'sos-incoming'; sosId: string; riderId: string; groupId: string; lat: number; lng: number; startedMs?: number }
  | { kind: 'crash' }
  | { kind: 'call112'; back?: OverlayState }
  | { kind: 'rollout'; groupId: string; leadName?: string; next?: 'Live' };

interface OverlayStore {
  current: OverlayState | null;
  show: (o: OverlayState) => void;
  hide: () => void;
}

export const useOverlayStore = create<OverlayStore>((set) => ({
  current: null,
  show: (o) => set({ current: o }),
  hide: () => set({ current: null }),
}));
