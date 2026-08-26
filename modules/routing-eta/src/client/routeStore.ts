/**
 * Route store (module-level Zustand).
 * Shared state for route data across RoutePanel and RouteOverlay.
 * Per AGENTS.md: module-level stores, not root appStore.
 */

import { create } from 'zustand';
import { RouteResponse } from '@app/models/routeResponse';

export interface RouteStoreState {
  route: RouteResponse | null;
  avoidHazardTypes: string[];
  isLoading: boolean;
  setRoute: (route: RouteResponse | null) => void;
  setAvoidHazardTypes: (types: string[]) => void;
  setIsLoading: (loading: boolean) => void;
}

export const useRouteStore = create<RouteStoreState>((set) => ({
  route: null,
  avoidHazardTypes: [],
  isLoading: false,
  setRoute: (route) => set({ route }),
  setAvoidHazardTypes: (types) => set({ avoidHazardTypes: types }),
  setIsLoading: (loading) => set({ isLoading: loading }),
}));
