/**
 * Drains the local SOS queue to Firestore on reconnect.
 * Listens to connectivity changes; when online, batch-writes pending events.
 * Ported from sync_worker.dart.
 *
 * TODO: also fetch remote SOS events and merge into local CRDT (cross-client convergence)
 */

import firestore from '@react-native-firebase/firestore';
import NetInfo from '@react-native-community/netinfo';
import { LocalQueue } from './localQueue';

export class SyncWorker {
  private _queue: LocalQueue;
  private _firestore: ReturnType<typeof firestore>;
  private _unsub?: () => void;
  private _syncing = false;

  constructor(queue: LocalQueue, firestoreInstance?: ReturnType<typeof firestore>) {
    this._queue = queue;
    this._firestore = firestoreInstance ?? firestore();
  }

  start(): void {
    this._unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected) this._drain();
    });
  }

  private async _drain(): Promise<void> {
    if (this._syncing) return;
    this._syncing = true;
    try {
      const pending = this._queue.pending;
      const batch = this._firestore.batch();
      for (const e of pending) {
        batch.set(this._firestore.collection('sos_events').doc(e.sosId), {
          sos_id: e.sosId,
          rider_id: e.riderId,
          group_id: e.groupId,
          lat: e.lat,
          lng: e.lng,
          created_at_hlc: e.createdAtHlc,
          resolved: e.resolved,
          resolved_at_hlc: e.resolvedAtHlc,
        });
      }
      await batch.commit();
      for (const e of pending) this._queue.dequeue(e.sosId);
    } finally {
      this._syncing = false;
    }
  }

  async stop(): Promise<void> {
    this._unsub?.();
  }
}