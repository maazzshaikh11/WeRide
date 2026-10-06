/**
 * Records a live ride so it can be logged (OWNER: package C2). API fixed by the spec; stub until implemented.
 * Fed by the Live screen: own fixes (1 Hz), the other riders' fixes, hazard/signal/stop events. `finish()` returns the RideLog
 * (track downsampled to MAX_TRACK_POINTS, cohesion over the 500 m rule, longest gap, avg/max speed, events).
 */
import type { Place, RideEventKind, RideLog } from '../models/domain';
import type { VerifiedLocation } from '../models/verifiedLocation';

export interface RecorderStart {
  rideId: string;
  crewId: string | null;
  name: string;
  start: Place | null;
  destination: Place | null;
}

class RideRecorder {
  isRecording(): boolean {
    return false;
  }
  start(_meta: RecorderStart, _now: number = Date.now()): void {}
  /** Own verified fix. */
  onOwnFix(_fix: VerifiedLocation, _now: number = Date.now()): void {}
  /** Other riders' latest fresh fixes, for the cohesion/longest-gap maths. */
  onRiders(_others: VerifiedLocation[], _now: number = Date.now()): void {}
  addEvent(_kind: RideEventKind, _text: string, _now: number = Date.now()): void {}
  countHazard(): void {}
  countSignal(): void {}
  /** Stops recording and returns the log, or null if nothing was recorded. */
  finish(_riders: number, _now: number = Date.now()): RideLog | null {
    return null;
  }
  reset(): void {}
}

export const rideRecorder = new RideRecorder();
