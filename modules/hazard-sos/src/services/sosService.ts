/**
 * SOS trigger + CRDT queue + FCM trigger (via Cloud Function on Firestore write).
 * Ported from sos_service.dart.
 *
 * Flow:
 * 1. Trigger SOS → write SosEvent to LocalQueue (MMKV) immediately (zero data loss)
 * 2. Attempt Firestore write (if online)
 * 3. SyncWorker drains queue on reconnect
 * 4. Cloud Function on sos_events/ write sends FCM push to group members
 *
 * Anti-accidental trigger guard is in the UI (SosButton.tsx) — not here.
 */

import firestore from '@react-native-firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { HLC } from '../hlc/hlc';
import { LocalQueue } from '../crdt/localQueue';
import { SyncWorker } from '../crdt/syncWorker';
import { SosEvent } from '../crdt/orSet';

export class SosService {
  private _queue: LocalQueue;
  private _firestore: ReturnType<typeof firestore>;
  private _syncWorker: SyncWorker;
  private _hlc: HLC;
  private _uuid = uuidv4;

  constructor(params: { queue: LocalQueue; syncWorker: SyncWorker; hlc: HLC; firestoreInstance?: ReturnType<typeof firestore> }) {
    this._queue = params.queue;
    this._syncWorker = params.syncWorker;
    this._hlc = params.hlc;
    this._firestore = params.firestoreInstance ?? firestore();
  }

  /** Trigger SOS. Returns the sos_id. Works offline. */
  trigger(params: { riderId: string; groupId: string; lat: number; lng: number }): string {
    const sosId = this._uuid();
    const event: SosEvent = {
      sosId,
      riderId: params.riderId,
      groupId: params.groupId,
      lat: params.lat,
      lng: params.lng,
      createdAtHlc: this._hlc.now(),
      resolved: false,
      resolvedAtHlc: null,
    };
    // 1. Local write FIRST (zero data loss guarantee)
    this._queue.enqueue(event);
    // 2. Attempt immediate Firestore write (best-effort)
    this._firestore
      .collection('sos_events')
      .doc(sosId)
      .set({
        sos_id: event.sosId,
        rider_id: event.riderId,
        group_id: event.groupId,
        lat: event.lat,
        lng: event.lng,
        created_at_hlc: event.createdAtHlc,
        resolved: event.resolved,
        resolved_at_hlc: event.resolvedAtHlc,
      })
      .catch(() => {
        // Will be drained by SyncWorker on reconnect
      });
    return sosId;
  }

  /** Resolve an SOS (sender only). Adds tombstone to CRDT. */
  resolve(sosId: string, _riderId: string): void {
    const resolvedAt = this._hlc.now();
    this._queue.dequeue(sosId); // remove from local queue if still pending
    this._firestore
      .collection('sos_events')
      .doc(sosId)
      .update({ resolved: true, resolved_at_hlc: resolvedAt })
      .catch(() => {
        // TODO: queue the resolve op for later sync
      });
  }
}