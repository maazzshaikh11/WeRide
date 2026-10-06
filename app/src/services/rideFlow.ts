/**
 * Small, shared pieces of the ride lifecycle used by the Road screens, the roll-out overlay and the lifecycle
 * bridge: starting the recorder once per ride, which planned stops were already stopped at, and finishing the
 * rider's own ride log (recorder -> saveRideLog, offline-safe).
 */
import type { Ride, RideLog } from '../models/domain';
import { rideRecorder } from './rideRecorder';
import { saveRideLog } from './rideLogService';
import { queuePending, removePending } from './pendingLogs';
import { warn } from '../utils/log';

const visitedStops = new Set<string>();
/** Set while this device is itself ending the ride, so the lifecycle bridge does not navigate a second time. */
let endingOwnRide: string | null = null;

export function isEndingOwnRide(rideId: string): boolean {
  return endingOwnRide === rideId;
}

export function markStopVisited(rideId: string, stopId: string): void {
  visitedStops.add(`${rideId}:${stopId}`);
}
/** Stops already stopped at in this ride (ids only, for the given ride). */
export function visitedStopIds(rideId: string): Set<string> {
  const out = new Set<string>();
  const prefix = `${rideId}:`;
  visitedStops.forEach((k) => {
    if (k.startsWith(prefix)) out.add(k.slice(prefix.length));
  });
  return out;
}

/**
 * Starts the ride recorder for this ride unless it is already recording it (the roll-out overlay and the Live
 * screen both call this; whoever is first wins). The recorder restores an in-progress recording of the same ride
 * after an app restart and adds the "Rolled out" event itself. Returns true when this call started it.
 */
export function startRecorderOnce(ride: Ride | null, now: number = Date.now()): boolean {
  if (!ride) return false;
  if (rideRecorder.isRecording() && rideRecorder.rideId() === ride.id) return false;
  rideRecorder.start(
    {
      rideId: ride.id,
      crewId: ride.crew_id,
      name: ride.name,
      start: ride.ride_plan?.start ?? null,
      destination: ride.ride_plan?.destination ?? null,
    },
    now,
  );
  return true;
}

export function resetRideFlow(): void {
  endingOwnRide = null;
  visitedStops.clear();
}

export interface FinishResult {
  /** The finished log, or null when nothing usable was recorded on this phone. */
  log: RideLog | null;
  /** true when it reached Firestore within the grace period; false when it is still queued on the phone (or there was no log). */
  saved: boolean;
}

/** How long the End-ride flow waits for Firestore before moving on (a write does not resolve offline until the server acks). */
export const SAVE_GRACE_MS = 2500;

/**
 * Finishes the rider's own recording and saves the log WITHOUT blocking on the network: the log is first queued on the
 * phone (finish() clears the recorder's own persistence), then saved; the flow waits at most SAVE_GRACE_MS for the
 * write, and the queued copy is dropped as soon as the write really lands (or retried on the next launch).
 * Callers: finish -> save, THEN set the ride finished.
 */
export async function finishOwnRide(uid: string, rideId: string, riders: number, now: number = Date.now()): Promise<FinishResult> {
  endingOwnRide = rideId;
  const log = rideRecorder.finish(riders, now);
  if (!log) return { log: null, saved: false };
  queuePending(uid, log);
  const write = saveRideLog(uid, log).then(() => {
    removePending(uid, log.ride_id);
    return true;
  });
  write.catch((e) => warn('[rideFlow] saveRideLog failed; it stays queued on this phone:', e));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const grace = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), SAVE_GRACE_MS);
  });
  const saved = await Promise.race([write.catch(() => false), grace]);
  if (timer) clearTimeout(timer);
  return { log, saved };
}
