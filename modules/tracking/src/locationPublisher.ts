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

  constructor(params: LocationPublisherParams) {
    this._socket = params.socket;
    this._firestore = firestore();
    this.riderId = params.riderId;
    this.groupId = params.groupId;
    this.firestoreThrottle = params.firestoreThrottleMs ?? 5000;
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
    this._socket.emit('location:update', payload);

    // Persisted: Firestore (throttled)
    const now = Date.now();
    if (this._lastFirestoreWrite == null || now - this._lastFirestoreWrite >= this.firestoreThrottle) {
      this._lastFirestoreWrite = now;
      this._firestore
        .collection('groups')
        .doc(this.groupId)
        .collection('locations')
        .doc(this.riderId)
        .set(payload);
    }
  }
}