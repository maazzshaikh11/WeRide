/** The active (unresolved) SOS events of the current ride, as last reported by SosListener's subscription. */
import { create } from 'zustand';
import type { SOSElement } from '@hazard/services/sosService';

interface SosEventsState {
  events: SOSElement[];
  setEvents: (e: SOSElement[]) => void;
}

export const useSosEventsStore = create<SosEventsState>((set) => ({
  events: [],
  setEvents: (events) => set({ events }),
}));
