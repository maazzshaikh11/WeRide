/**
 * SosListener (OWNER: package E) — mounted once at the root. While the rider is in a ride (appStore.groupId) it watches
 * that ride's active SOS events (the real offline-first service, so resolved ones drop out) and raises the full-screen
 * "needs help" overlay for another rider's SOS: once per event id per session, never for events older than 10 minutes,
 * and not over the rider's own SOS / crash countdown / 112 call (it waits until those close).
 */
import { useEffect, useRef } from 'react';
import { subscribeToSosEvents, SOSElement } from '@hazard/services/sosService';
import { useAppStore } from '../store/appStore';
import { OverlayState, useOverlayStore } from '../store/overlayStore';
import { useSessionStore } from '../store/sessionStore';
import { sosCreatedMs } from '../services/sosFormat';
import { useSosEventsStore } from './sosEventsStore';

/** An SOS older than this is stale: not raised. */
export const SOS_MAX_AGE_MS = 10 * 60 * 1000;
const BLOCKING: ReadonlySet<OverlayState['kind']> = new Set(['sos-sent', 'crash', 'call112', 'sos-incoming']);

export interface IncomingDecision {
  /** The event to raise now, or null. */
  raise: SOSElement | null;
}

/**
 * Pure decision: which (if any) event should open the incoming-SOS screen right now.
 * Candidates are another rider's events that are fresh and not seen before; the newest one is raised first.
 * While a blocking overlay is up nothing is raised (and nothing is marked seen, so it is raised once that closes).
 */
export function decideIncoming(input: {
  events: readonly SOSElement[];
  me: string | null;
  seen: ReadonlySet<string>;
  now: number;
  current: OverlayState | null;
}): IncomingDecision {
  const { events, me, seen, now, current } = input;
  if (current && BLOCKING.has(current.kind)) return { raise: null };
  const fresh = events
    .filter((e) => e.rider_id && e.rider_id !== me && !seen.has(e.sos_id))
    .filter((e) => {
      const t = sosCreatedMs(e.created_at_hlc);
      return t == null || now - t <= SOS_MAX_AGE_MS;
    })
    .sort((a, b) => (sosCreatedMs(b.created_at_hlc) ?? 0) - (sosCreatedMs(a.created_at_hlc) ?? 0));
  return { raise: fresh[0] ?? null };
}

export default function SosListener() {
  const groupId = useAppStore((s) => s.groupId);
  const sessionUid = useSessionStore((s) => s.uid);
  const appUid = useAppStore((s) => s.userId);
  const me = sessionUid ?? appUid;
  const current = useOverlayStore((s) => s.current);
  const events = useSosEventsStore((s) => s.events);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    seen.current = new Set();
    useSosEventsStore.getState().setEvents([]);
    if (!groupId) return;
    const unsub = subscribeToSosEvents(groupId, (list) => useSosEventsStore.getState().setEvents(list));
    return () => {
      unsub();
      useSosEventsStore.getState().setEvents([]);
    };
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return;
    const { raise } = decideIncoming({ events, me, seen: seen.current, now: Date.now(), current });
    if (!raise) return;
    seen.current.add(raise.sos_id);
    useOverlayStore.getState().show({
      kind: 'sos-incoming',
      sosId: raise.sos_id,
      riderId: raise.rider_id,
      groupId: raise.group_id || groupId,
      lat: raise.lat,
      lng: raise.lng,
      startedMs: sosCreatedMs(raise.created_at_hlc) ?? undefined,
    });
  }, [events, current, me, groupId]);

  return null;
}
