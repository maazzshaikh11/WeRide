/**
 * Ride logs that could not be saved when the ride ended (no signal at the destination): kept on the phone and
 * saved again on the next launch / when the rider is signed in. Saving is idempotent per ride id, so a retry that
 * races an earlier success is harmless.
 */
import { MMKV } from 'react-native-mmkv';
import type { RideLog } from '../models/domain';
import { saveRideLog } from './rideLogService';
import { warn } from '../utils/log';

const KEY = 'pending.v1';
let store: MMKV | null = null;

export interface PendingLog {
  uid: string;
  log: RideLog;
}

function disk(): MMKV | null {
  try {
    if (!store) store = new MMKV({ id: 'weride_pending_logs' });
    return store;
  } catch {
    return null;
  }
}

export function readPending(): PendingLog[] {
  try {
    const raw = disk()?.getString(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((p) => p && typeof p.uid === 'string' && p.log && typeof p.log.ride_id === 'string') : [];
  } catch {
    return [];
  }
}

function write(list: PendingLog[]): void {
  try {
    disk()?.set(KEY, JSON.stringify(list));
  } catch {
    /* best effort: the log is also still in memory for this session */
  }
}

export function queuePending(uid: string, log: RideLog): void {
  write([...readPending().filter((p) => !(p.uid === uid && p.log.ride_id === log.ride_id)), { uid, log }]);
}

export function removePending(uid: string, rideId: string): void {
  write(readPending().filter((p) => !(p.uid === uid && p.log.ride_id === rideId)));
}

/** Tries to save every queued log for `uid`; the ones that still fail stay queued. Returns how many were saved. */
export async function flushPending(uid: string): Promise<number> {
  const all = readPending();
  const mine = all.filter((p) => p.uid === uid);
  if (mine.length === 0) return 0;
  let saved = 0;
  const keep = all.filter((p) => p.uid !== uid);
  for (const p of mine) {
    try {
      await saveRideLog(uid, p.log);
      saved += 1;
    } catch (e) {
      warn('[pendingLogs] retry failed, will try again next launch:', e);
      keep.push(p);
    }
  }
  write(keep);
  return saved;
}
