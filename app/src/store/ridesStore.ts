/** The signed-in rider's rides, live (OWNER: package B — extend as needed, keep these exports). */
import { create } from 'zustand';
import type { Ride } from '../models/domain';
import { subscribeMyRides } from '../services/rideService';

interface RidesState {
  rides: Ride[];
  loaded: boolean;
  watch: (uid: string) => () => void;
  clear: () => void;
}

export const useRidesStore = create<RidesState>((set) => ({
  rides: [],
  loaded: false,
  watch: (uid) =>
    subscribeMyRides(
      uid,
      (rides) => set({ rides, loaded: true }),
      () => set({ loaded: true }),
    ),
  clear: () => set({ rides: [], loaded: false }),
}));
