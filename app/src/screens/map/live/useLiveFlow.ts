/**
 * The live screen's ride flow as one hook: hazard-ahead + the post-hazard "Still there / Gone" confirm, signals from
 * the crew, the stop-ahead plate, and the automatic hand-offs to Stop (stationary at a planned stop) and Arrive
 * (within 150 m of the destination). All inputs are real (own verified fix, route, active clusters, ride plan).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HazardCluster } from '../../../models/hazardCluster';
import type { VerifiedLocation } from '../../../models/verifiedLocation';
import { getLocationSocket } from '../../../services/socketService';
import { rideRecorder } from '../../../services/rideRecorder';
import { markStopVisited, visitedStopIds } from '../../../services/rideFlow';
import { confirmStillThere, voteGone } from '../../../services/hazardConfirmService';
import type { PlateHazard, PlateSignal, PlateStop } from './liveGeometry';
import {
  ArriveState, CONFIRM_WINDOW_MS, DwellState, EMPTY_DWELL, EMPTY_TRACKER, HazardTracker, SIGNAL_PLATE_MS, StopLike,
  buildRouteLine, hazardAhead, hazardName, hazardPositions, stepArrive, stepDwell, stepHazardTracker, stopAhead, stopInZone,
} from './liveRide';
import { warn } from '../../../utils/log';

export interface FlowStop extends StopLike {
  /** Name shown on the plate ("Chai Point"). */
  name: string;
}

export interface LiveFlowInput {
  groupId: string | null;
  userId: string | null;
  fix: VerifiedLocation | null;
  routePath: readonly number[][] | null;
  clusters: readonly HazardCluster[];
  stops: readonly FlowStop[];
  destination: { lat: number; lng: number } | null;
  nameOf: (riderId: string) => string;
  push: (message: string, variant?: 'success' | 'error' | 'warn' | 'info') => void;
  onOpenStop: (stopId: string) => void;
  onArrive: () => void;
}

export interface HazardConfirm {
  cluster: HazardCluster;
  until: number;
}

export interface LiveFlow {
  hazard: PlateHazard | null;
  signal: PlateSignal | null;
  stop: (PlateStop & { id: string }) | null;
  confirm: HazardConfirm | null;
  answerConfirm: (answer: 'still' | 'gone') => void;
}

export function useLiveFlow(input: LiveFlowInput): LiveFlow {
  const { groupId, userId, fix, routePath, clusters, stops, destination, nameOf, push, onOpenStop, onArrive } = input;
  const [signal, setSignal] = useState<(PlateSignal & { until: number }) | null>(null);
  const [confirm, setConfirm] = useState<HazardConfirm | null>(null);
  const tracker = useRef<HazardTracker>(EMPTY_TRACKER);
  const dwell = useRef<DwellState>(EMPTY_DWELL);
  const arrive = useRef<ArriveState>({ armed: false });
  const arrivedRef = useRef(false);
  const latest = useRef({ nameOf, onOpenStop, onArrive });
  latest.current = { nameOf, onOpenStop, onArrive };

  const line = useMemo(() => buildRouteLine(routePath), [routePath]);
  const pose = useMemo(
    () => (fix ? { lat: fix.lat, lng: fix.lng, headingDeg: fix.heading_deg, speedMps: fix.speed_mps } : null),
    [fix],
  );

  // ---- signals from the rest of the crew (server relays as signal:received) ----
  useEffect(() => {
    if (!groupId) return;
    const socket = getLocationSocket();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onSignal = (p: { group_id?: string; rider_id?: string; label?: string }) => {
      if (!p || p.group_id !== groupId || !p.rider_id || p.rider_id === userId || !p.label) return;
      const name = latest.current.nameOf(p.rider_id);
      setSignal({ name, label: p.label, until: Date.now() + SIGNAL_PLATE_MS });
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setSignal(null), SIGNAL_PLATE_MS);
    };
    socket.on('signal:received', onSignal);
    return () => {
      socket.off('signal:received', onSignal);
      if (timer) clearTimeout(timer);
    };
  }, [groupId, userId]);

  // ---- hazard ahead (plate) ----
  const hazardNow = useMemo(() => (pose ? hazardAhead(line, pose, clusters) : null), [line, pose, clusters]);
  const hazard: PlateHazard | null = hazardNow
    ? { id: hazardNow.cluster.cluster_id, name: hazardName(hazardNow.cluster.hazard_type), distanceM: hazardNow.aheadM, reportCount: hazardNow.cluster.report_count }
    : null;

  // ---- hazard passed -> confirm window (~4 min) ----
  useEffect(() => {
    if (!pose) return;
    const step = stepHazardTracker(tracker.current, hazardPositions(line, pose, clusters));
    tracker.current = step.state;
    if (step.passed) setConfirm({ cluster: step.passed, until: Date.now() + CONFIRM_WINDOW_MS });
  }, [line, pose, clusters]);
  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(null), Math.max(0, confirm.until - Date.now()));
    return () => clearTimeout(t);
  }, [confirm]);

  const answerConfirm = useCallback(
    (answer: 'still' | 'gone') => {
      const c = confirm;
      setConfirm(null);
      if (!c || !userId || !groupId) return;
      const name = hazardName(c.cluster.hazard_type);
      if (answer === 'still') {
        push('Confirmed. Crew alerted', 'success');
        rideRecorder.countHazard();
        rideRecorder.addEvent('hazard', `Confirmed ${name.toLowerCase()}`);
        confirmStillThere({
          type: c.cluster.hazard_type,
          lat: c.cluster.centroid_lat,
          lng: c.cluster.centroid_lng,
          riderId: userId,
          groupId,
          hlc: fix?.timestamp_hlc ?? '',
        }).catch((e) => {
          warn('[live] confirm still-there failed:', e);
          push('Could not send the confirmation', 'error');
        });
      } else {
        push('Marked as gone. We clear it after one more rider agrees', 'info');
        voteGone(c.cluster.cluster_id, userId)
          .then((r) => {
            if (r.resolved) push('Hazard cleared', 'success');
          })
          .catch((e) => {
            warn('[live] gone vote failed:', e);
            push('Could not record your answer', 'error');
          });
      }
    },
    [confirm, userId, groupId, fix, push],
  );

  // ---- stop ahead (plate) + stationary-at-a-stop -> Stop ----
  const stopNow = useMemo(
    () => (pose ? stopAhead(line, pose, stops, groupId ? visitedStopIds(groupId) : new Set<string>()) : null),
    [line, pose, stops, groupId],
  );
  const stop = stopNow ? { id: stopNow.stop.id, name: stopNow.stop.name, distanceM: stopNow.distanceM } : null;

  useEffect(() => {
    if (!pose || !groupId || stops.length === 0) return;
    const zone = stopInZone(pose, stops, visitedStopIds(groupId));
    const speedKmh = Number.isFinite(pose.speedMps) ? (pose.speedMps as number) * 3.6 : null;
    const step = stepDwell(dwell.current, { zoneStopId: zone?.id ?? null, speedKmh, now: Date.now() });
    dwell.current = step.state;
    if (step.open) {
      markStopVisited(groupId, step.open);
      latest.current.onOpenStop(step.open);
    }
  }, [pose, groupId, stops]);

  // ---- arrival ----
  useEffect(() => {
    if (!pose || arrivedRef.current) return;
    const step = stepArrive(arrive.current, pose, destination);
    arrive.current = step.state;
    if (step.arrived) {
      arrivedRef.current = true;
      latest.current.onArrive();
    }
  }, [pose, destination]);

  // The plate keeps the signal only while it is fresh.
  const liveSignal = signal && signal.until > Date.now() ? { name: signal.name, label: signal.label } : null;

  return { hazard, signal: liveSignal, stop, confirm, answerConfirm };
}
