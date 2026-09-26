/**
 * Stops store (spec §3.4). Stops come from the ride plan (Create Ride modal)
 * via syncFromPlan(); falls back to a single destination stop if none planned.
 */
import { create } from 'zustand';
import { useRidePlanStore } from './ridePlanStore';
import type { PlannedStop } from './ridePlanStore';

export interface Stop {
  id: string;
  name: string;
  icon: string;    // emoji per spec §1.6
  status: 'done' | 'current' | 'upcoming';
  lat?: number;    // from ride plan — for distance info lines
  lng?: number;
}

interface StopsState {
  stops: Stop[];
  markCurrentDone: () => void;
  syncFromPlan: () => void;
  reset: () => void;
}

const DESTINATION_STOP: Stop[] = [
  { id: 'stop-1', name: 'Destination', icon: '🏁', status: 'current' },
];

function planToStops(planStops: PlannedStop[], hasDestination: boolean): Stop[] {
  if (planStops.length === 0) {
    const dest = useRidePlanStore.getState().destination;
    return [{ id: 'stop-1', name: dest ? dest.label.split(',')[0] : 'Destination', icon: '🏁', status: 'current', lat: dest?.lat, lng: dest?.lng }];
  }
  const stops: Stop[] = planStops.map((s) => ({
    id: s.id,
    name: s.label.split(',')[0],
    icon: s.icon,
    status: 'upcoming' as const,
    lat: s.lat,
    lng: s.lng,
  }));
  if (hasDestination) {
    const dest = useRidePlanStore.getState().destination;
    if (dest) {
      stops.push({ id: 'final-destination', name: dest.label.split(',')[0], icon: '🏁', status: 'upcoming', lat: dest.lat, lng: dest.lng });
    }
  }
  if (stops.length > 0) stops[0] = { ...stops[0], status: 'current' };
  return stops;
}

export const useStopsStore = create<StopsState>((set, get) => ({
  stops: [{ ...DESTINATION_STOP[0] }],

  markCurrentDone: () => {
    set((state) => {
      const idx = state.stops.findIndex((s) => s.status === 'current');
      if (idx === -1) return state;
      const stops = state.stops.map((s, i) => {
        if (i === idx) return { ...s, status: 'done' as const };
        if (i === idx + 1) return { ...s, status: 'current' as const };
        return s;
      });
      return { stops };
    });
  },

  syncFromPlan: () => {
    const plan = useRidePlanStore.getState();
    set({ stops: planToStops(plan.stops, plan.destination != null) });
  },

  reset: () => {
    set({ stops: [{ ...DESTINATION_STOP[0] }] });
  },
}));