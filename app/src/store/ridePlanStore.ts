/**
 * Ride plan store — created via the Create Ride modal.
 * Holds start, destination and ordered stops for the active group.
 * RouteOverlay uses `destination` instead of the old MOCK_DESTINATION;
 * StopsScreen renders `stops` (replacing the hardcoded stub).
 */
import { create } from 'zustand';
import { GeoResult } from '../utils/geocode';

export interface PlannedStop {
  id: string;
  label: string;
  lat: number;
  lng: number;
  icon: string;
}

interface RidePlanState {
  start: GeoResult | null;
  destination: GeoResult | null;
  stops: PlannedStop[];

  setStart: (s: GeoResult | null) => void;
  setDestination: (d: GeoResult | null) => void;
  addStop: (s: PlannedStop) => void;
  removeStop: (id: string) => void;
  moveStop: (id: string, dir: -1 | 1) => void;
  clearPlan: () => void;
}

export const useRidePlanStore = create<RidePlanState>((set) => ({
  start: null,
  destination: null,
  stops: [],

  setStart: (start) => set({ start }),
  setDestination: (destination) => set({ destination }),
  addStop: (stop) => set((s) => ({ stops: [...s.stops, stop] })),
  removeStop: (id) => set((s) => ({ stops: s.stops.filter((x) => x.id !== id) })),
  moveStop: (id, dir) =>
    set((s) => {
      const idx = s.stops.findIndex((x) => x.id === id);
      const target = idx + dir;
      if (idx === -1 || target < 0 || target >= s.stops.length) return s;
      const stops = [...s.stops];
      const [moved] = stops.splice(idx, 1);
      stops.splice(target, 0, moved);
      return { stops };
    }),
  clearPlan: () => set({ start: null, destination: null, stops: [] }),
}));