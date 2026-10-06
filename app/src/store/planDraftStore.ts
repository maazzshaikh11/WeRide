/**
 * The ride being planned across Plan > Where / Route / When / Done. Lives in a store (not route params) so
 * going back keeps the choices; `reset()` starts a fresh plan.
 */
import { create } from 'zustand';
import type { Place, RidingStyle } from '../models/domain';
import type { RouteAlternative } from '../models/routeResponse';
import { DEFAULT_TIME_MIN, clampTime } from '../utils/planWhen';

export interface PlanStop {
  id: string;
  label: string;
  lat: number;
  lng: number;
  icon: string;
}

export interface PlanDraft {
  crewId: string | null;
  /** The rider picked a crew (or Solo) themselves, so PlanWhen must not re-apply its default. */
  crewTouched: boolean;
  /** null until chosen: the Route step then uses the rider's current position. */
  start: Place | null;
  destination: Place | null;
  /** Every option the server returned for start → destination (so Back keeps them). */
  options: RouteAlternative[];
  chosenOption: number;
  /** The chosen option (null until the Route step is done). */
  route: RouteAlternative | null;
  /** 0 = today, 1 = tomorrow, … */
  dayOffset: number;
  /** Roll-out time, minutes after midnight. */
  timeMin: number;
  invitees: string[];
  pace: RidingStyle;
  fuel: boolean;
  chai: boolean;
  stops: PlanStop[];
}

interface PlanDraftActions {
  setCrew: (crewId: string | null, invitees: string[], touched?: boolean) => void;
  setStart: (start: Place | null) => void;
  setDestination: (destination: Place | null) => void;
  setOptions: (options: RouteAlternative[], chosen?: number) => void;
  chooseOption: (index: number) => void;
  setDay: (dayOffset: number) => void;
  stepTime: (deltaMin: number) => void;
  toggleInvitee: (uid: string) => void;
  setPace: (pace: RidingStyle) => void;
  setStopFlag: (kind: 'fuel' | 'chai', on: boolean, stop?: PlanStop | null) => void;
  reset: () => void;
  /** Start a new plan already pointing at a destination (Where next? chips). */
  prefill: (destination: Place) => void;
}

export const INITIAL_DRAFT: PlanDraft = {
  crewId: null,
  crewTouched: false,
  start: null,
  destination: null,
  options: [],
  chosenOption: 0,
  route: null,
  dayOffset: 1,
  timeMin: DEFAULT_TIME_MIN,
  invitees: [],
  pace: 'Steady',
  fuel: false,
  chai: false,
  stops: [],
};

const STOP_ID = { fuel: 'plan-fuel', chai: 'plan-chai' } as const;

export const usePlanDraftStore = create<PlanDraft & PlanDraftActions>((set) => ({
  ...INITIAL_DRAFT,
  setCrew: (crewId, invitees, touched = true) => set({ crewId, invitees, crewTouched: touched }),
  // A different start or destination invalidates the routes and the stops found along them.
  setStart: (start) => set({ start, options: [], route: null, chosenOption: 0, fuel: false, chai: false, stops: [] }),
  setDestination: (destination) => set({ destination, options: [], route: null, chosenOption: 0, fuel: false, chai: false, stops: [] }),
  setOptions: (options, chosen = 0) => set({ options, chosenOption: chosen, route: options[chosen] ?? null }),
  chooseOption: (index) =>
    set((s) => (s.options[index] ? { chosenOption: index, route: s.options[index], fuel: false, chai: false, stops: [] } : s)),
  setDay: (dayOffset) => set({ dayOffset }),
  stepTime: (deltaMin) => set((s) => ({ timeMin: clampTime(s.timeMin + deltaMin) })),
  toggleInvitee: (uid) => set((s) => ({ invitees: s.invitees.includes(uid) ? s.invitees.filter((u) => u !== uid) : [...s.invitees, uid] })),
  setPace: (pace) => set({ pace }),
  setStopFlag: (kind, on, stop) =>
    set((s) => {
      const rest = s.stops.filter((x) => x.id !== STOP_ID[kind]);
      return { [kind]: on, stops: on && stop ? [...rest, stop] : rest } as Partial<PlanDraft>;
    }),
  reset: () => set({ ...INITIAL_DRAFT }),
  prefill: (destination) => set({ ...INITIAL_DRAFT, destination }),
}));

export const PLAN_STOP_ID = STOP_ID;
