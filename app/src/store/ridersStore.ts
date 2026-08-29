/**
 * Canonical Zustand store for rider locations.
 *
 * Single source of truth for MapScreen and RiderMarkerOverlay.
 * Subscribes to Socket.io 'location:update' events and maintains
 * a map of riderId → RiderEntry (latest payload + derived marker state).
 *
 * Phase 4: filters by group_id client-side (no Socket.io room protocol).
 * Room joining is deferred to Phase 6.
 */

import { create } from 'zustand';
import { getLocationSocket } from '../services/socketService';
import { verifiedLocationFromJson, VerifiedLocation } from '../models/verifiedLocation';
import { getMarkerState, isValidLocation, MarkerState } from '../screens/map/overlays/riderMarkerState';

export interface RiderEntry {
  location: VerifiedLocation;
  receivedAt: number;
  markerState: MarkerState;
}

interface RidersState {
  riders: Map<string, RiderEntry>;
  connected: boolean;
  subscribed: boolean;
  selectedRiderId: string | null;

  upsertRider: (rawPayload: unknown) => void;
  removeRider: (riderId: string) => void;
  clear: () => void;
  refreshStaleStates: () => void;
  selectRider: (riderId: string | null) => void;
  subscribe: (groupId: string) => void;
  unsubscribe: () => void;
}

let socketHandler: ((payload: unknown) => void) | null = null;
let connectHandler: (() => void) | null = null;
let disconnectHandler: (() => void) | null = null;

export const useRidersStore = create<RidersState>((set, get) => ({
  riders: new Map(),
  connected: false,
  subscribed: false,
  selectedRiderId: null,

  upsertRider: (rawPayload: unknown) => {
    if (!isValidLocation(rawPayload)) {
      console.warn('[ridersStore] Rejected malformed location:update payload:', rawPayload);
      return;
    }

    const location = verifiedLocationFromJson(rawPayload);
    const now = Date.now();
    const markerState = getMarkerState(location.spoof_flag, location.timestamp_hlc, now);

    const riderId = location.rider_id;
    const entry: RiderEntry = {
      location,
      receivedAt: now,
      markerState,
    };

    set((state) => {
      const newRiders = new Map(state.riders);
      newRiders.set(riderId, entry);
      return { riders: newRiders };
    });
  },

  removeRider: (riderId: string) => {
    set((state) => {
      const newRiders = new Map(state.riders);
      newRiders.delete(riderId);
      return { riders: newRiders };
    });
  },

  clear: () => {
    set({ riders: new Map() });
  },

  refreshStaleStates: () => {
    const { riders } = get();
    const now = Date.now();
    let changed = false;

    const newRiders = new Map<string, RiderEntry>();
    riders.forEach((entry, riderId) => {
      newRiders.set(riderId, entry);
    });

    newRiders.forEach((entry, riderId) => {
      const newMarkerState = getMarkerState(
        entry.location.spoof_flag,
        entry.location.timestamp_hlc,
        now,
      );
      if (newMarkerState !== entry.markerState) {
        changed = true;
        newRiders.set(riderId, { ...entry, markerState: newMarkerState });
      }
    });

    if (changed) {
      set({ riders: newRiders });
    }
  },

  selectRider: (riderId: string | null) => {
    set({ selectedRiderId: riderId });
  },

  subscribe: (groupId: string) => {
    const state = get();
    if (state.subscribed) {
      return;
    }

    const socket = getLocationSocket();

    socketHandler = (payload: unknown) => {
      if (!isValidLocation(payload)) {
        console.warn('[ridersStore] Rejected malformed location:update payload:', payload);
        return;
      }
      const location = verifiedLocationFromJson(payload);

      // Client-side group filter (Phase 4: no room protocol)
      if (location.group_id !== groupId) {
        return;
      }

      get().upsertRider(payload);
    };

    connectHandler = () => {
      set({ connected: true });
    };

    disconnectHandler = () => {
      set({ connected: false });
    };

    socket.on('location:update', socketHandler);
    socket.on('connect', connectHandler);
    socket.on('disconnect', disconnectHandler);

    // Set initial connection state
    set({ connected: socket.connected, subscribed: true });
  },

  unsubscribe: () => {
    if (!socketHandler) {
      return;
    }

    const socket = getLocationSocket();
    socket.off('location:update', socketHandler);
    socket.off('connect', connectHandler);
    socket.off('disconnect', disconnectHandler);

    socketHandler = null;
    connectHandler = null;
    disconnectHandler = null;

    set({ subscribed: false, connected: false });
  },
}));