/**
 * Local queue backed by MMKV. Durable across app restarts.
 * Drains to Firestore on reconnect (see SyncWorker).
 * Ported from local_queue.dart.
 *
 * Zero data loss: every SOS trigger writes here BEFORE UI confirms.
 * Replaces the Hive-based queue.
 */

import { MMKV } from 'react-native-mmkv';
import { SosEvent, sosEventToJson, sosEventFromJson } from './orSet';

export class LocalQueue {
  private _mmkv: MMKV;

  constructor(mmkv: MMKV) {
    this._mmkv = mmkv;
  }

  enqueue(e: SosEvent): void {
    this._mmkv.set(e.sosId, JSON.stringify(sosEventToJson(e)));
  }

  dequeue(sosId: string): void {
    this._mmkv.delete(sosId);
  }

  get pending(): SosEvent[] {
    const keys = this._mmkv.getAllKeys();
    return keys.map((k) => sosEventFromJson(JSON.parse(this._mmkv.getString(k)!)));
  }

  get isNotEmpty(): boolean {
    return this._mmkv.getAllKeys().length > 0;
  }
}