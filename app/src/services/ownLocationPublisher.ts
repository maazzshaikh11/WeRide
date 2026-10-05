/**
 * OwnLocationPublisher — hands the rider's own EKF-verified fix back to the app.
 *
 * Why this exists: the server fans `location:update` out with `socket.to(room)`,
 * which deliberately excludes the sender. A rider therefore never receives their
 * own fix over the socket, so anything that needs "where am I" (route origin,
 * hazard reports, stop distances) must be fed from the publish path itself.
 *
 * Subclasses Person A's LocationPublisher without modifying it: publishing
 * behaviour (socket + throttled Firestore write) is untouched.
 */
import {
  LocationPublisher,
  LocationPublisherParams,
  VerifiedLocationPayload,
} from '@tracking/locationPublisher';
import { VerifiedLocation } from '../models/verifiedLocation';

// Same gates the route origin has always used (Phase 6 T-16).
export const ACCEPTABLE_ACCURACY_M = 50;

/** True when a fix may be used as the rider's position for routing/reporting. */
export function isUsableOwnFix(fix: VerifiedLocation): boolean {
  return (
    Number.isFinite(fix.lat) &&
    Number.isFinite(fix.lng) &&
    !fix.spoof_flag &&
    fix.accuracy_m <= ACCEPTABLE_ACCURACY_M
  );
}

export class OwnLocationPublisher extends LocationPublisher {
  private _onOwnFix: (fix: VerifiedLocation) => void;

  constructor(params: LocationPublisherParams, onOwnFix: (fix: VerifiedLocation) => void) {
    super(params);
    this._onOwnFix = onOwnFix;
  }

  publish(p: VerifiedLocationPayload): void {
    super.publish(p);
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return;
    this._onOwnFix({
      rider_id: this.riderId,
      group_id: this.groupId,
      timestamp_hlc: p.timestampHlc,
      lat: p.lat,
      lng: p.lng,
      speed_mps: p.speedMps,
      heading_deg: p.headingDeg,
      spoof_flag: p.spoofFlag,
      nis_score: p.nisScore,
      accuracy_m: p.accuracyM,
    });
  }
}
