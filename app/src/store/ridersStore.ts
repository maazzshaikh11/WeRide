/**
 * Canonical Zustand store for rider locations.
 *
 * Single source of truth for MapScreen and RiderMarkerOverlay.
 * Subscribes to Socket.io 'location:update' events and maintains
 * a map of riderId → RiderEntry (latest payload + derived marker state).
 *
 * subscribe(groupId) joins the server-side group room ('join-group') so the
 * server only forwards this group's traffic; a client-side group_id filter is
 * kept as defence-in-depth. Re-joins on socket reconnect. unsubscribe()
 * leaves the room and removes all listeners.
 */

import { create } from 'zustand';
import { getLocationSocket } from '../services/socketService';
import { verifiedLocationFromJson, VerifiedLocation } from '../models/verifiedLocation';
import { getMarkerState, isValidLocation, MarkerState } from '../screens/map/overlays/riderMarkerState';
import { warn } from '../utils/log';

export interface RiderEntry {
  location: VerifiedLocation;
  receivedAt: number;
  markerState: MarkerState;
}

interface RidersState {
  riders: Map<string, RiderEntry>;
  connected: boolean;
  subscribed: boolean;
  groupId: string | null;
  selectedRiderId: string | null;

  upsertRider: (rawPayload: unknown) => void;
  /** Seed the store with last-known locations (e.g. Firestore late-joiner read). */
  seedRiders: (rawPayloads: unknown[]) => void;
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

/** What to log about a rejected payload: its shape only. The payload carries a rider's position and id (PII). */
function describeRejected(p: unknown): string {
  return p && typeof p === 'object' ? `{keys: ${Object.keys(p as object).slice(0, 12).join(',')}}` : typeof p;
}

export const useRidersStore = create<RidersState>((set, get) => ({
  riders: new Map(),
  connected: false,
  subscribed: false,
  groupId: null,
  selectedRiderId: null,

  upsertRider: (rawPayload: unknown) => {
    if (!isValidLocation(rawPayload)) {
      warn('[ridersStore] Rejected malformed location:update payload', describeRejected(rawPayload));
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

  seedRiders: (rawPayloads: unknown[]) => {
    for (const raw of rawPayloads) {
      get().upsertRider(raw);
    }
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
    if (state.subscribed && state.groupId === groupId) {
      return;
    }
    // Switching groups: drop the old subscription first.
    if (state.subscribed) {
      get().unsubscribe();
    }

    const socket = getLocationSocket();

    // Join the server-side group room so only this group's traffic arrives.
    socket.emit('join-group', { groupId });

    socketHandler = (payload: unknown) => {
      if (!isValidLocation(payload)) {
        warn('[ridersStore] Rejected malformed location:update payload', describeRejected(payload));
        return;
      }
      const location = verifiedLocationFromJson(payload);

      // Client-side group filter (defence-in-depth alongside the server room).
      if (location.group_id !== groupId) {
        return;
      }

      get().upsertRider(payload);
    };

    connectHandler = () => {
      set({ connected: true });
      // Re-join after a reconnect — the server forgets rooms on disconnect.
      getLocationSocket().emit('join-group', { groupId });
    };

    disconnectHandler = () => {
      set({ connected: false });
    };

    socket.on('location:update', socketHandler);
    socket.on('connect', connectHandler);
    socket.on('disconnect', disconnectHandler);

    // Set initial connection state
    set({ connected: socket.connected, subscribed: true, groupId });
  },

  unsubscribe: () => {
    const { groupId } = get();
    if (groupId) {
      try {
        getLocationSocket().emit('leave-group', { groupId });
      } catch {
        // Socket may be torn down already; room membership dies with it.
      }
    }

    if (!socketHandler) {
      set({ subscribed: false, connected: false, groupId: null });
      return;
    }

    const socket = getLocationSocket();
    socket.off('location:update', socketHandler);
    if (connectHandler) socket.off('connect', connectHandler);
    if (disconnectHandler) socket.off('disconnect', disconnectHandler);

    socketHandler = null;
    connectHandler = null;
    disconnectHandler = null;

    set({ subscribed: false, connected: false, groupId: null });
  },
}));