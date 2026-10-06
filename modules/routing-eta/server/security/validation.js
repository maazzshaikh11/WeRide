// Payload validation for realtime events. Returns a sanitised copy (only
// whitelisted fields) or null. Callers drop null; nothing is ever forwarded as-is.

import { ID_RE, GROUP_ID_RE } from './auth.js';

export const SIGNAL_LABELS = ['Wait up', 'Wait for me', 'Pull over', 'All good', 'Need fuel'];
export const MAX_HLC_LEN = 64;

const isStr = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;
const inRange = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** @returns {object|null} sanitised verified_location payload */
export function sanitizeLocationPayload(p) {
  if (p == null || typeof p !== 'object' || Array.isArray(p)) return null;
  if (!isStr(p.rider_id, 128) || !ID_RE.test(p.rider_id)) return null;
  if (!isStr(p.group_id, 128) || !GROUP_ID_RE.test(p.group_id)) return null;
  if (!isStr(p.timestamp_hlc, MAX_HLC_LEN)) return null;
  if (!inRange(p.lat, -90, 90) || !inRange(p.lng, -180, 180)) return null;

  const out = {
    rider_id: p.rider_id,
    group_id: p.group_id,
    timestamp_hlc: p.timestamp_hlc,
    lat: p.lat,
    lng: p.lng,
  };
  // Optional contract fields: absent is fine, present-but-absurd is rejected.
  if (p.speed_mps !== undefined) {
    // The EKF can briefly report a slightly negative speed; bound the magnitude only.
    if (!inRange(p.speed_mps, -200, 200)) return null; // 200 m/s ~ 720 km/h
    out.speed_mps = p.speed_mps;
  }
  if (p.heading_deg !== undefined) {
    // The EKF heading is unwrapped (it can exceed 360); bound it, then normalise to [0, 360).
    if (!inRange(p.heading_deg, -1e6, 1e6)) return null;
    out.heading_deg = ((p.heading_deg % 360) + 360) % 360;
  }
  if (p.accuracy_m !== undefined) {
    if (!inRange(p.accuracy_m, 0, 100_000)) return null;
    out.accuracy_m = p.accuracy_m;
  }
  if (p.nis_score !== undefined) {
    if (!inRange(p.nis_score, 0, 1e9)) return null;
    out.nis_score = p.nis_score;
  }
  if (p.spoof_flag !== undefined) {
    if (typeof p.spoof_flag !== 'boolean') return null;
    out.spoof_flag = p.spoof_flag;
  }
  return out;
}

/** @returns {{group_id:string, rider_id:string, label:string}|null} */
export function sanitizeSignalPayload(p) {
  if (p == null || typeof p !== 'object' || Array.isArray(p)) return null;
  if (!isStr(p.group_id, 128) || !GROUP_ID_RE.test(p.group_id)) return null;
  if (!isStr(p.rider_id, 128) || !ID_RE.test(p.rider_id)) return null;
  if (!SIGNAL_LABELS.includes(p.label)) return null;
  return { group_id: p.group_id, rider_id: p.rider_id, label: p.label };
}

/** join-group / leave-group argument: "g" or {groupId:"g"}. */
export function parseGroupId(msg) {
  const g = typeof msg === 'string' ? msg : msg && typeof msg === 'object' ? msg.groupId : undefined;
  return typeof g === 'string' && GROUP_ID_RE.test(g) ? g : null;
}
