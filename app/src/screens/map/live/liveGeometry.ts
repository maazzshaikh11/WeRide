/**
 * Pure helpers for the live ride screen. Everything here is derived from real
 * data only: the rider's own verified fix and the other riders' verified
 * locations from the socket/Firestore seed. Nothing is simulated; when there is
 * nothing to measure the result is `null` and the UI shows nothing.
 */
import { haversineMeters } from '../../../utils/geoUtils';
import type { RiderEntry } from '../../../store/ridersStore';
import type { PlateTone } from '../../../theme/palettes';
import type { IconName } from '../../../ui';
import type { Units } from '../../../models/domain';
import { formatShortDistance, formatSpread } from '../../../utils/units';
import { extractHlcPhysical } from '../overlays/riderMarkerState';

export interface LatLng {
  lat: number;
  lng: number;
}

/** Past this spread the crew counts as split up (demo.html: "Everyone is within 600 m"). */
export const GAP_THRESHOLD_M = 600;

/** Riders worth measuring against: a fresh, verified fix (marker GREEN), never the rider themself. */
export function freshRiders(riders: ReadonlyMap<string, RiderEntry>, selfId?: string | null): RiderEntry[] {
  const out: RiderEntry[] = [];
  riders.forEach((r, id) => {
    if (id === selfId || r.location.rider_id === selfId) return;
    if (r.markerState !== 'GREEN') return;
    if (!Number.isFinite(r.location.lat) || !Number.isFinite(r.location.lng)) return;
    out.push(r);
  });
  return out;
}

/** Distance in metres to the nearest of `others`, or null when there is nobody to measure. */
export function nearestRider(
  own: LatLng | null | undefined,
  others: readonly RiderEntry[],
): { riderId: string; distanceM: number } | null {
  if (!own || !Number.isFinite(own.lat) || !Number.isFinite(own.lng)) return null;
  let best: { riderId: string; distanceM: number } | null = null;
  for (const r of others) {
    const d = haversineMeters(own.lat, own.lng, r.location.lat, r.location.lng);
    if (best === null || d < best.distanceM) best = { riderId: r.location.rider_id, distanceM: d };
  }
  return best;
}

/**
 * The floating label beside the avatar: "100m" under a kilometre (rounded to the
 * nearest 10 m so it does not flicker with GPS noise), "1.2km" beyond.
 */
export function formatGap(metres: number): string {
  if (!Number.isFinite(metres) || metres < 0) return '';
  if (metres < 10) return '<10m';
  if (metres < 1000) {
    const r = Math.round(metres / 10) * 10;
    return r >= 1000 ? '1.0km' : `${r}m`;
  }
  return `${(metres / 1000).toFixed(1)}km`;
}

/** Largest distance between any two points (the crew's spread). */
export function groupSpreadM(points: readonly LatLng[]): number {
  let max = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      max = Math.max(max, haversineMeters(points[i].lat, points[i].lng, points[j].lat, points[j].lng));
    }
  }
  return max;
}

export interface LiveStatus {
  /** Stable key so the plate only re-animates when the state really changes. */
  key: 'sos' | 'no-signal' | 'no-fix' | 'hazard' | 'signal' | 'stop-ahead' | 'rider-no-signal' | 'solo' | 'gap' | 'together';
  tone: PlateTone;
  icon: IconName;
  title: string;
  subtitle?: string;
}

/** An active hazard cluster ahead of the rider on the route (name already resolved, e.g. "Pothole"). */
export interface PlateHazard {
  id: string;
  name: string;
  distanceM: number;
  reportCount: number;
}
/** A quick signal received from a crew member (shown ~15 s). */
export interface PlateSignal {
  name: string;
  label: string;
}
/** A planned stop within 800 m ahead. */
export interface PlateStop {
  name: string;
  distanceM: number;
}
/** A rider whose last fix went stale (marker GREY). */
export interface PlateStale {
  name: string;
  ageS: number;
}

export interface LiveStatusInput {
  /** The rider's own verified position, if any. */
  own: LatLng | null;
  /** Fresh verified crew members (see freshRiders). */
  others: readonly RiderEntry[];
  /** The live socket dropped after having been up. */
  signalLost: boolean;
  /** Someone else's SOS is active (their rider id). */
  sosFrom: string | null;
  hazard?: PlateHazard | null;
  signal?: PlateSignal | null;
  stop?: PlateStop | null;
  staleRider?: PlateStale | null;
  /** Rider id -> display name (defaults to "Rider 1234"). */
  nameOf?: (riderId: string) => string;
  units?: Units;
}

const shortId = (id: string) => `Rider ${id.slice(-4)}`;

/**
 * The one-glance answer to "is the group OK?" — a single plate.
 * Priority: SOS, no signal, no fix, hazard ahead, signal from the crew, stop ahead, rider no signal, solo, gap, together.
 */
export function liveStatus({ own, others, signalLost, sosFrom, hazard, signal, stop, staleRider, nameOf, units = 'km' }: LiveStatusInput): LiveStatus {
  const who = nameOf ?? shortId;
  if (sosFrom) {
    return { key: 'sos', tone: 'red', icon: 'warn', title: 'SOS', subtitle: `${who(sosFrom)} needs help` };
  }
  if (signalLost) {
    return { key: 'no-signal', tone: 'yellow', icon: 'wifioff', title: 'No signal', subtitle: 'Reconnecting. Your SOS still works' };
  }
  if (!own) {
    return { key: 'no-fix', tone: 'white', icon: 'gps', title: 'Finding you', subtitle: 'Waiting for a GPS fix' };
  }
  if (hazard) {
    return {
      key: 'hazard', tone: 'yellow', icon: 'haz',
      title: `${hazard.name} ∙ ${formatShortDistance(Math.max(0, hazard.distanceM), units)}`,
      subtitle: `${hazard.reportCount > 1 ? `Reported by ${hazard.reportCount} riders` : 'Reported by a rider'} ∙ ease off`,
    };
  }
  if (signal) {
    return {
      key: 'signal', tone: /^all good$/i.test(signal.label) ? 'green' : 'yellow', icon: 'signal',
      title: `${signal.name} ∙ ${signal.label}`, subtitle: 'Signal from the crew',
    };
  }
  if (stop) {
    return {
      key: 'stop-ahead', tone: 'blue', icon: 'cup',
      title: `${stop.name} ∙ ${formatShortDistance(Math.max(0, stop.distanceM), units)}`, subtitle: 'Pull in together',
    };
  }
  if (staleRider) {
    return {
      key: 'rider-no-signal', tone: 'yellow', icon: 'wifioff',
      title: `${staleRider.name} ∙ No signal`, subtitle: `Last seen ${Math.max(0, Math.round(staleRider.ageS))} s ago ∙ position held`,
    };
  }
  if (others.length === 0) {
    return { key: 'solo', tone: 'white', icon: 'users', title: 'Riding solo', subtitle: 'No other riders are live yet' };
  }
  const far = others.reduce<{ riderId: string; distanceM: number } | null>((acc, r) => {
    const d = haversineMeters(own.lat, own.lng, r.location.lat, r.location.lng);
    return acc === null || d > acc.distanceM ? { riderId: r.location.rider_id, distanceM: d } : acc;
  }, null);
  const spread = groupSpreadM([own, ...others.map((r) => r.location)]);
  const count = others.length + 1;
  if (spread > GAP_THRESHOLD_M && far) {
    return { key: 'gap', tone: 'yellow', icon: 'warn', title: 'Gap', subtitle: `${who(far.riderId)} is ${formatSpread(far.distanceM, units)} away ∙ send Wait up` };
  }
  return { key: 'together', tone: 'green', icon: 'check', title: 'All together', subtitle: `${count} riders ∙ ${formatSpread(spread, units)} spread` };
}

/** The rider whose marker went GREY most recently, if still plausibly on the ride (stale for under 10 min). */
export function staleRider(riders: ReadonlyMap<string, RiderEntry>, selfId: string | null | undefined, now: number = Date.now()): { riderId: string; ageS: number } | null {
  let best: { riderId: string; ageS: number } | null = null;
  riders.forEach((r, id) => {
    if (id === selfId || r.location.rider_id === selfId) return;
    if (r.markerState !== 'GREY') return;
    const seenAt = extractHlcPhysical(r.location.timestamp_hlc) ?? r.receivedAt;
    const ageS = (now - seenAt) / 1000;
    if (!Number.isFinite(ageS) || ageS > 600) return;
    if (!best || ageS < best.ageS) best = { riderId: id, ageS };
  });
  return best;
}
