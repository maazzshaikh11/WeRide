/** The signed-in rider's crews, live (OWNER: package C1 — extend as needed, keep these exports). */
import { create } from 'zustand';
import type { Crew } from '../models/domain';
import { subscribeMyCrews } from '../services/crewService';

interface CrewsState {
  crews: Crew[];
  loaded: boolean;
  watch: (uid: string) => () => void;
  clear: () => void;
}

export const useCrewsStore = create<CrewsState>((set) => ({
  crews: [],
  loaded: false,
  watch: (uid) =>
    subscribeMyCrews(
      uid,
      (crews) => set({ crews, loaded: true }),
      () => set({ loaded: true }),
    ),
  clear: () => set({ crews: [], loaded: false }),
}));
