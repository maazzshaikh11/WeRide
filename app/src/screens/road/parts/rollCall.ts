/**
 * Roll-call derivations (docs/DEMO_PARITY_SPEC.md §2 "Derived"): "at meetup" = last fix within 150 m of the meetup
 * point, "in N min" = distance / that rider's recent speed (only when moving faster than 2 m/s), else "no signal yet".
 * Plus the ready-check chips from REAL state, and the countdown pill. All pure.
 */
import { haversineMeters } from '../../../utils/geoUtils';
import type { PresenceDoc, PresenceState, RollCallDoc } from '../../../models/domain';

export const AT_MEETUP_M = 150;
export const MIN_MOVING_MPS = 2;
export const PRECISE_GPS_M = 10;

export interface Point {
  lat: number;
  lng: number;
}

export interface FixLike extends Point {
  speed_mps?: number;
}

export interface MemberStatus {
  label: string;
  ready: boolean;
  kind: 'ready' | 'here' | 'eta' | 'none';
}

export function memberStatus(input: { ready: boolean; fix: FixLike | null; meetup: Point | null }): MemberStatus {
  const { ready, fix, meetup } = input;
  if (ready) return { label: '✓ ready', ready: true, kind: 'ready' };
  if (!fix || !meetup || !Number.isFinite(fix.lat) || !Number.isFinite(fix.lng)) return { label: 'no signal yet', ready: false, kind: 'none' };
  const d = haversineMeters(fix.lat, fix.lng, meetup.lat, meetup.lng);
  if (d <= AT_MEETUP_M) return { label: 'at meetup', ready: false, kind: 'here' };
  const v = fix.speed_mps;
  if (v != null && Number.isFinite(v) && v > MIN_MOVING_MPS) {
    const min = Math.max(1, Math.ceil(d / v / 60));
    return { label: `in ${min} min`, ready: false, kind: 'eta' };
  }
  return { label: 'no signal yet', ready: false, kind: 'none' };
}

/** uids whose roll call says `ready`. */
export function readySet(docs: readonly RollCallDoc[]): Set<string> {
  return new Set(docs.filter((d) => d.state === 'ready').map((d) => d.uid));
}

export function everyoneReady(memberIds: readonly string[], ready: ReadonlySet<string>): boolean {
  return memberIds.length > 0 && memberIds.every((id) => ready.has(id));
}

export interface ReadyCheck {
  key: 'gps' | 'location' | 'sos' | 'voice';
  label: string;
  ok: boolean;
}

export function readyChecks(input: {
  accuracyM: number | null;
  locationGranted: boolean;
  contacts: number;
  voiceLive: boolean;
}): ReadyCheck[] {
  const { accuracyM, locationGranted, contacts, voiceLive } = input;
  const precise = accuracyM != null && Number.isFinite(accuracyM) && accuracyM <= PRECISE_GPS_M;
  return [
    { key: 'gps', ok: precise, label: precise ? 'GPS precise' : accuracyM == null ? 'Finding GPS' : 'GPS rough' },
    { key: 'location', ok: locationGranted, label: locationGranted ? 'Always-on location' : 'Location not always on' },
    { key: 'sos', ok: contacts > 0, label: contacts > 0 ? 'SOS contact set' : 'No SOS contact' },
    { key: 'voice', ok: voiceLive, label: voiceLive ? 'Voice channel on' : 'Voice channel off' },
  ];
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** "6:30 ∙ IN 49 MIN" — start time and the countdown to it (demo's pill). */
export function countdownLabel(startMs: number | null, now: number): string | null {
  if (startMs == null || !Number.isFinite(startMs)) return null;
  const d = new Date(startMs);
  const h = d.getHours() % 12 || 12;
  const clock = `${h}:${pad2(d.getMinutes())}`;
  const mins = Math.round((startMs - now) / 60000);
  if (mins > 0) {
    if (mins >= 60) return `${clock} ∙ IN ${Math.floor(mins / 60)}H ${pad2(mins % 60)}`;
    return `${clock} ∙ IN ${mins} MIN`;
  }
  if (mins === 0) return `${clock} ∙ NOW`;
  const late = -mins;
  return late >= 60 ? `${clock} ∙ ${Math.floor(late / 60)}H ${pad2(late % 60)} AGO` : `${clock} ∙ ${late} MIN AGO`;
}

/** Stop screen tile label from a presence state (ready / fuelling / pulling in / on a break). */
export function presenceLabel(state: PresenceState | undefined, isMe = false): { label: string; ready: boolean } {
  switch (state) {
    case 'ready':
      return { label: '✓ ready', ready: true };
    case 'fuel':
      return { label: 'fuelling', ready: false };
    case 'stopped':
      return { label: 'on a break', ready: false };
    case 'riding':
      return { label: 'pulling in', ready: false };
    default:
      return { label: isMe ? 'on a break' : 'pulling in', ready: false };
  }
}

export function presenceMap(docs: readonly PresenceDoc[]): Map<string, PresenceState> {
  return new Map(docs.map((d) => [d.uid, d.state]));
}
