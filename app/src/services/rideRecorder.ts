/**
 * Records a live ride so it can be logged (OWNER: package C2).
 * Fed by the Live screen: own fixes (1 Hz), the other riders' fixes, hazard/signal/stop events. `finish()` returns the RideLog
 * (track downsampled to MAX_TRACK_POINTS, cohesion over the 500 m rule, longest gap, avg/max speed, events).
 *
 * Pure and deterministic: every clock is passed in (`now`, ms). The one side effect is persisting the in-progress recording
 * to MMKV about every 10 s, so an app restart mid-ride does not lose the ride (restored by `start()` for the same ride id).
 *
 * Rules
 *  - Own fixes with accuracy > 50 m, a spoof flag or non-finite coordinates are ignored. A fix that would need more than
 *    120 m/s from the last accepted one is a jump and is ignored (five in a row re-anchor the track at the new position,
 *    without adding the distance). Displacements under 2 m accumulate until they are real movement.
 *  - Track points are sampled every >= 15 m (the spacing doubles whenever the buffer passes 1200 points) and the result
 *    is decimated to <= 600 points at finish, always keeping the first and last point.
 *  - Cohesion: over each interval where an own fix and at least one other fresh rider exist, the group is "together" when
 *    the largest pairwise distance among them is <= 500 m. An interval is credited at most 5 s (no updates = no credit).
 *    `longest_gap_m` is the largest pairwise distance seen. If no other rider was ever observed both are 0 (the UI shows '—').
 */
import type { Place, RideEvent, RideEventKind, RideLog } from '../models/domain';
import { MAX_TRACK_POINTS } from '../models/domain';
import type { VerifiedLocation } from '../models/verifiedLocation';
import { haversineMeters } from '../utils/geoUtils';
import { decimateFlat } from '../utils/logStats';

export interface RecorderStart {
  rideId: string;
  crewId: string | null;
  name: string;
  start: Place | null;
  destination: Place | null;
}

export const TOGETHER_RADIUS_M = 500;
export const MAX_FIX_ACCURACY_M = 50;
export const MAX_SPEED_MPS = 120;
export const TRACK_SAMPLE_M = 15;
export const PERSIST_EVERY_MS = 10_000;
export const MAX_INTERVAL_MS = 5_000;
const MIN_STEP_M = 2;
const JUMPS_BEFORE_REANCHOR = 5;
const BUFFER_LIMIT_POINTS = 1200;
const STORAGE_KEY = 'recording.v1';

interface Snapshot {
  v: 1;
  meta: RecorderStart;
  startedMs: number;
  distM: number;
  maxMps: number;
  track: number[];
  sampleM: number;
  anchor: { lat: number; lng: number; t: number } | null;
  jumps: number;
  hazards: number;
  signals: number;
  events: RideEvent[];
  togetherMs: number;
  observedMs: number;
  longestGapM: number;
}

/** The tiny slice of MMKV the recorder needs (so tests can pass an in-memory one). */
export interface RecorderStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
}

function defaultStorage(): RecorderStorage | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: keeps importing this file free of the native module
    const { MMKV } = require('react-native-mmkv');
    return new MMKV({ id: 'ride_recorder' });
  } catch {
    return null;
  }
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const validCoord = (lat: number, lng: number) => finite(lat) && finite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

type Pos = { lat: number; lng: number };

function maxPairwiseM(points: Pos[]): number {
  let m = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      m = Math.max(m, haversineMeters(points[i].lat, points[i].lng, points[j].lat, points[j].lng));
    }
  }
  return m;
}

export class RideRecorder {
  private storageFactory: () => RecorderStorage | null;
  private storage: RecorderStorage | null | undefined;
  private s: Snapshot | null = null;
  private ownPos: Pos | null = null;
  private others: Pos[] = [];
  private spread: number | null = null;
  private lastT: number | null = null;
  private lastPersist = 0;

  constructor(storage?: RecorderStorage | null) {
    this.storageFactory = storage === undefined ? defaultStorage : () => storage;
  }

  private disk(): RecorderStorage | null {
    if (this.storage === undefined) this.storage = this.storageFactory();
    return this.storage;
  }

  isRecording(): boolean {
    return this.s !== null;
  }

  /** Id of the ride being recorded (null when idle). */
  rideId(): string | null {
    return this.s?.meta.rideId ?? null;
  }

  /** Running totals of the recording so far (for the Arrive screen); null when idle. Added by package D (read-only). */
  snapshot(now: number = Date.now()): { km: number; durationS: number; togetherPct: number | null } | null {
    const s = this.s;
    if (!s) return null;
    return {
      km: round(s.distM / 1000, 1),
      durationS: Math.max(0, Math.round((now - s.startedMs) / 1000)),
      togetherPct: s.observedMs > 0 ? Math.round((100 * s.togetherMs) / s.observedMs) : null,
    };
  }

  /**
   * Starts recording `meta.rideId`. If an in-progress recording of the same ride is on disk (app restarted mid-ride)
   * it is restored instead; one for a different ride is discarded. Calling start again for the ride already being
   * recorded keeps the current recording.
   */
  start(meta: RecorderStart, now: number = Date.now()): void {
    if (this.s && this.s.meta.rideId === meta.rideId) return;
    this.clearState();
    const restored = this.restore(meta.rideId);
    if (restored) {
      this.s = restored;
      this.lastPersist = now;
      return;
    }
    this.s = {
      v: 1, meta, startedMs: now, distM: 0, maxMps: 0, track: [], sampleM: TRACK_SAMPLE_M, anchor: null, jumps: 0,
      hazards: 0, signals: 0, events: [{ t_ms: now, kind: 'rolled', text: 'Rolled out' }], togetherMs: 0, observedMs: 0, longestGapM: 0,
    };
    this.lastPersist = now;
    this.persist();
  }

  /** Own verified fix (1 Hz). */
  onOwnFix(fix: VerifiedLocation, now: number = Date.now()): void {
    const s = this.s;
    if (!s) return;
    this.accountInterval(now);
    this.acceptOwn(s, fix, now);
    this.recompute();
    if (now - this.lastPersist >= PERSIST_EVERY_MS) {
      this.lastPersist = now;
      this.persist();
    }
  }

  /** Other riders' latest fresh fixes, for the cohesion/longest-gap maths. */
  onRiders(others: VerifiedLocation[], now: number = Date.now()): void {
    const s = this.s;
    if (!s) return;
    this.accountInterval(now);
    this.others = others.filter((o) => o && !o.spoof_flag && validCoord(o.lat, o.lng)).map((o) => ({ lat: o.lat, lng: o.lng }));
    this.recompute();
  }

  addEvent(kind: RideEventKind, text: string, now: number = Date.now()): void {
    const s = this.s;
    if (!s) return;
    // one "rolled" and one "arrived" per ride
    if ((kind === 'rolled' || kind === 'arrived') && s.events.some((e) => e.kind === kind)) return;
    s.events.push({ t_ms: now, kind, text });
    this.persist();
  }

  countHazard(): void {
    if (!this.s) return;
    this.s.hazards += 1;
    this.persist();
  }

  countSignal(): void {
    if (!this.s) return;
    this.s.signals += 1;
    this.persist();
  }

  /**
   * Stops recording and returns the log, or null if nothing was recorded (not recording, or no usable own fix was
   * ever received). Clears the persisted recording.
   */
  finish(riders: number, now: number = Date.now()): RideLog | null {
    const s = this.s;
    if (!s) return null;
    this.accountInterval(now);
    if (s.track.length === 0) {
      this.reset();
      return null;
    }
    const durationS = Math.max(0, Math.round((now - s.startedMs) / 1000));
    const km = round(s.distM / 1000, 2);
    const events = s.events.slice();
    if (!events.some((e) => e.kind === 'arrived')) {
      const dest = s.meta.destination?.label;
      events.push({ t_ms: now, kind: 'arrived', text: dest ? `Arrived · ${dest}` : 'Ride ended' });
    }
    // the last accepted position closes the track
    const full = s.track.slice();
    if (s.anchor && (full[full.length - 2] !== s.anchor.lat || full[full.length - 1] !== s.anchor.lng)) full.push(s.anchor.lat, s.anchor.lng);
    const track = decimateFlat(full, MAX_TRACK_POINTS);
    const log: RideLog = {
      ride_id: s.meta.rideId,
      crew_id: s.meta.crewId,
      name: s.meta.name,
      started_ms: s.startedMs,
      ended_ms: now,
      km,
      duration_s: durationS,
      avg_kmh: durationS > 0 ? round(km / (durationS / 3600), 1) : 0,
      max_kmh: round(s.maxMps * 3.6, 1),
      together_pct: s.observedMs > 0 ? Math.round((100 * s.togetherMs) / s.observedMs) : 0,
      longest_gap_m: Math.round(s.longestGapM),
      riders: Math.max(1, Math.round(riders) || 1),
      hazards_shared: s.hazards,
      signals_sent: s.signals,
      track,
      events,
      rating: null,
      start: s.meta.start,
      destination: s.meta.destination,
    };
    this.reset();
    return log;
  }

  /** Drops the recording (in memory and on disk). */
  reset(): void {
    this.clearState();
    try {
      this.disk()?.delete(STORAGE_KEY);
    } catch {
      /* best effort */
    }
  }

  // ---- internals ----

  private clearState(): void {
    this.s = null;
    this.ownPos = null;
    this.others = [];
    this.spread = null;
    this.lastT = null;
  }

  private acceptOwn(s: Snapshot, fix: VerifiedLocation, now: number): void {
    if (!fix || fix.spoof_flag || !(fix.accuracy_m <= MAX_FIX_ACCURACY_M) || !validCoord(fix.lat, fix.lng)) return;
    const a = s.anchor;
    if (!a) {
      s.anchor = { lat: fix.lat, lng: fix.lng, t: now };
      this.ownPos = { lat: fix.lat, lng: fix.lng };
      this.pushPoint(s, fix.lat, fix.lng);
      this.noteSpeed(s, fix.speed_mps);
      return;
    }
    const dt = (now - a.t) / 1000;
    if (dt <= 0) return;
    const d = haversineMeters(a.lat, a.lng, fix.lat, fix.lng);
    const derived = d / dt;
    if (derived > MAX_SPEED_MPS) {
      s.jumps += 1;
      if (s.jumps >= JUMPS_BEFORE_REANCHOR) {
        s.jumps = 0;
        s.anchor = { lat: fix.lat, lng: fix.lng, t: now };
        this.ownPos = { lat: fix.lat, lng: fix.lng };
        this.pushPoint(s, fix.lat, fix.lng);
      }
      return;
    }
    s.jumps = 0;
    this.ownPos = { lat: fix.lat, lng: fix.lng };
    this.noteSpeed(s, finite(fix.speed_mps) ? fix.speed_mps : derived);
    if (d < MIN_STEP_M) return;
    s.distM += d;
    s.anchor = { lat: fix.lat, lng: fix.lng, t: now };
    const n = s.track.length;
    if (n === 0 || haversineMeters(s.track[n - 2], s.track[n - 1], fix.lat, fix.lng) >= s.sampleM) this.pushPoint(s, fix.lat, fix.lng);
  }

  private noteSpeed(s: Snapshot, mps: number): void {
    if (finite(mps) && mps > s.maxMps && mps <= MAX_SPEED_MPS) s.maxMps = mps;
  }

  private pushPoint(s: Snapshot, lat: number, lng: number): void {
    s.track.push(lat, lng);
    if (s.track.length / 2 > BUFFER_LIMIT_POINTS) {
      // keep memory and the persisted JSON bounded on very long rides: drop every other point, double the spacing
      const kept: number[] = [];
      const n = s.track.length / 2;
      for (let i = 0; i < n; i += 2) kept.push(s.track[i * 2], s.track[i * 2 + 1]);
      s.track = kept;
      s.sampleM *= 2;
    }
  }

  /** Credits the interval since the last update using the state that held during it. */
  private accountInterval(now: number): void {
    const s = this.s;
    if (!s) return;
    if (this.lastT !== null && this.spread !== null) {
      const dt = Math.min(Math.max(0, now - this.lastT), MAX_INTERVAL_MS);
      if (dt > 0) {
        s.observedMs += dt;
        if (this.spread <= TOGETHER_RADIUS_M) s.togetherMs += dt;
      }
    }
    this.lastT = now;
  }

  private recompute(): void {
    const s = this.s;
    if (!s) return;
    if (this.ownPos && this.others.length > 0) {
      this.spread = maxPairwiseM([this.ownPos, ...this.others]);
      if (this.spread > s.longestGapM) s.longestGapM = this.spread;
    } else {
      this.spread = null;
    }
  }

  private persist(): void {
    if (!this.s) return;
    try {
      this.disk()?.set(STORAGE_KEY, JSON.stringify(this.s));
    } catch {
      /* best effort: the recording just is not restorable */
    }
  }

  private restore(rideId: string): Snapshot | null {
    try {
      const raw = this.disk()?.getString(STORAGE_KEY);
      if (!raw) return null;
      const j = JSON.parse(raw) as Snapshot;
      if (!j || j.v !== 1 || j.meta?.rideId !== rideId || !finite(j.startedMs) || !Array.isArray(j.track) || !Array.isArray(j.events)) return null;
      return {
        ...j,
        distM: finite(j.distM) ? j.distM : 0,
        maxMps: finite(j.maxMps) ? j.maxMps : 0,
        sampleM: finite(j.sampleM) && j.sampleM >= TRACK_SAMPLE_M ? j.sampleM : TRACK_SAMPLE_M,
        jumps: 0,
        hazards: finite(j.hazards) ? j.hazards : 0,
        signals: finite(j.signals) ? j.signals : 0,
        togetherMs: finite(j.togetherMs) ? j.togetherMs : 0,
        observedMs: finite(j.observedMs) ? j.observedMs : 0,
        longestGapM: finite(j.longestGapM) ? j.longestGapM : 0,
      };
    } catch {
      return null;
    }
  }
}

export const rideRecorder = new RideRecorder();
