/**
 * Route store (module-level Zustand).
 * Shared state for route data across RoutePanel and RouteOverlay.
 * Per AGENTS.md: module-level stores, not root appStore.
 *
 * Phase 6: Integrates real Person A (verified_location) and Person B (hazard_cluster) streams.
 */

import { create } from 'zustand';
import { RouteResponse } from '@app/models/routeResponse';
import { VerifiedLocation } from '@app/models/verifiedLocation';
import { HazardCluster } from '@app/models/hazardCluster';

export interface RouteStoreState {
  // Phase 5
  route: RouteResponse | null;
  avoidHazardTypes: string[];
  isLoading: boolean;

  // Phase 6: Real location and hazards
  currentLocation: VerifiedLocation | null;
  lastValidLocation: VerifiedLocation | null;
  activeClusters: HazardCluster[];

  // Setters
  setRoute: (route: RouteResponse | null) => void;
  setAvoidHazardTypes: (types: string[]) => void;
  setIsLoading: (loading: boolean) => void;
  setCurrentLocation: (location: VerifiedLocation | null) => void;
  setLastValidLocation: (location: VerifiedLocation | null) => void;
  setActiveClusters: (clusters: HazardCluster[]) => void;
}

export const useRouteStore = create<RouteStoreState>((set) => ({
  route: null,
  avoidHazardTypes: [],
  isLoading: false,
  currentLocation: null,
  lastValidLocation: null,
  activeClusters: [],

  setRoute: (route) => set({ route }),
  setAvoidHazardTypes: (types) => set({ avoidHazardTypes: types }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setCurrentLocation: (location) => set({ currentLocation: location }),
  setLastValidLocation: (location) => set({ lastValidLocation: location }),
  setActiveClusters: (clusters) => set({ activeClusters: clusters }),
}));
