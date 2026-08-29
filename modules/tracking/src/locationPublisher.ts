/**
 * Publishes verified_location over Socket.io (live) + Firestore (throttled persist).
 * Transport per §6.1.
 * Ported from location_publisher.dart.
 */

import { Socket } from 'socket.io-client';
import firestore from '@react-native-firebase/firestore';

export interface LocationPublisherParams {
  socket: Socket;
  riderId: string;
  groupId: string;
  firestoreThrottleMs?: number;
  firestore?: ReturnType<typeof firestore>;
}

export interface VerifiedLocationPayload {
  timestampHlc: string;
  lat: number;
  lng: number;
  speedMps: number;
  headingDeg: number;
  spoofFlag: boolean;
  nisScore: number;
  accuracyM: number;
}

export class LocationPublisher {
  private _socket: Socket;
  private _firestore: ReturnType<typeof firestore>;
  readonly riderId: string;
  readonly groupId: string;
  readonly firestoreThrottle: number;

  private _lastFirestoreWrite?: number;
  private _pendingPayload: object | null = null;

  constructor(params: LocationPublisherParams) {
    this._socket = params.socket;
    // We assume default app's firestore is available.
    // If not injected (tests), use default.
    this._firestore = params.firestore ?? firestore();
    this.riderId = params.riderId;
    this.groupId = params.groupId;
    this.firestoreThrottle = params.firestoreThrottleMs ?? 5000;

    // Task 3.3: Flush latest pending payload on reconnect
    this._socket.on('connect', () => {
      if (this._pendingPayload !== null) {
        this._socket.emit('location:update', this._pendingPayload);
        this._pendingPayload = null;
      }
    });
  }

  /**
   * Task 3.2: Late-joiner read.
   * Returns the last known location for a given rider from Firestore, or null.
   */
  async fetchLastKnown(
    groupId: string,
    riderId: string
  ): Promise<VerifiedLocationPayload | null> {
    try {
      const snap = await this._firestore
        .collection('groups')
        .doc(groupId)
        .collection('locations')
        .doc(riderId)
        .get();
      if (!snap.exists) return null;
      const d = snap.data();
      if (!d) return null;
      return {
        timestampHlc: d.timestamp_hlc,
        lat: d.lat,
        lng: d.lng,
        speedMps: d.speed_mps,
        headingDeg: d.heading_deg,
        spoofFlag: d.spoof_flag,
        nisScore: d.nis_score,
        accuracyM: d.accuracy_m,
      };
    } catch (err) {
      console.warn('[LocationPublisher] fetchLastKnown failed:', err);
      return null;
    }
  }

  publish(p: VerifiedLocationPayload): void {
    const payload = {
      rider_id: this.riderId,
      group_id: this.groupId,
      timestamp_hlc: p.timestampHlc,
      lat: p.lat,
      lng: p.lng,
      speed_mps: p.speedMps,
      heading_deg: p.headingDeg,
      spoof_flag: p.spoofFlag,
      nis_score: p.nisScore,
      accuracy_m: p.accuracyM,
    };

    // Live: Socket.io
    if (this._socket.connected) {
      this._socket.emit('location:update', payload);
    } else {
      // Latest-only: overwrite; older payloads are intentionally discarded
      this._pendingPayload = payload;
    }

    // Persist: Firestore (throttled)
    const now = Date.now();
    if (
      this._lastFirestoreWrite == null ||
      now - this._lastFirestoreWrite >= this.firestoreThrottle
    ) {
      this._lastFirestoreWrite = now;

      // Ensure write failure does not crash the service (Task 3.4)
      this._firestore
        .collection('groups')
        .doc(this.groupId)
        .collection('locations')
        .doc(this.riderId)
        .set(payload)
        .catch((err: unknown) => {
          console.warn('[LocationPublisher] Firestore write failed, will retry next tick:', err);
          this._lastFirestoreWrite = undefined; // lift throttle guard for retry
        });
    }
  }
}