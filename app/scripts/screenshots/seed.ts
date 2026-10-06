// @ts-nocheck
// Seeds the in-memory Firestore (stubs/firestore.js) and the zustand stores with the teamDSY demo account, using the
// same shapes and content as infra/firebase/seed/teamdsy-data.js, so the real screens show what the demo shows.
import T from '../../../infra/firebase/seed/teamdsy-data.js';
import { useSessionStore } from '@app/store/sessionStore';
import { useAppStore } from '@app/store/appStore';
import { useProfileStore } from '@app/store/profileStore';
import { usePrefsStore } from '@app/store/prefsStore';
import { useCrewsStore } from '@app/store/crewsStore';
import { useRidesStore } from '@app/store/ridesStore';
import { useRideLogsStore } from '@app/store/rideLogsStore';
import { useRidersStore } from '@app/store/ridersStore';
import { useRidePlanStore } from '@app/store/ridePlanStore';
import { useStopsStore } from '@app/store/stopsStore';
import { usePlanDraftStore } from '@app/store/planDraftStore';
import { useOverlayStore } from '@app/store/overlayStore';
import { useToastStore } from '@app/store/toastStore';
import { useThemeStore } from '@app/theme/themeStore';
import { useRouteStore } from '@routing/client/routeStore';
import { rideFromDoc } from '@app/services/rideService';
import { haversineMeters } from '@app/utils/geoUtils';

export const ME = 'teamdsy-me';
export const MEERA = T.CREW.meera, ZOYA = T.CREW.zoya, DEV = T.CREW.dev, ISHAN = T.CREW.ishan, KABIR = T.CREW.kabir;
export type RideVariant = 'planned' | 'meetup' | 'live' | 'finished';
export interface SeedOpts {
  ride?: RideVariant;       // state of the next ride (Sunday Ghat Run)
  signedIn?: boolean;       // false = first-launch screens
  onboarded?: boolean;
  contacts?: boolean;       // emergency contact(s) saved
  logs?: boolean;
  rides?: boolean;
  crews?: boolean;
  /** roll call: who is ready (default 3 crew) */
  ready?: string[];
  /** presence docs: uid -> state */
  presence?: Record<string, string>;
  /** groups/{ride}/locations docs: uid -> metres east of the meetup + speed */
  locations?: Record<string, { eastM: number; speed?: number }>;
  /** keep only the next ride (so a finished ride leads the Ride tab) */
  onlyNextRide?: boolean;
}
const DB: Map<string, any> = (globalThis as any).__FS__;
const HOUR = 3600e3;
const MIN = 60e3;

export const rideId = (key: string) => T.groupDocId(key);
export const RIDE0_KEY = 'sunday-ghat-run';
export const RIDE0 = rideId(RIDE0_KEY);
export const CREW0 = T.crewDocId('ghosts');

/** Route path for a ride plan (start → stops → destination), [lat,lng] pairs, gently curved. */
export function planPath(plan: any, perSeg = 70): number[][] {
  const pts = [plan.start, ...plan.stops, plan.destination].filter(Boolean);
  const out: number[][] = [];
  for (let s = 0; s < pts.length - 1; s++) {
    const a = pts[s], b = pts[s + 1];
    for (let i = 0; i < perSeg; i++) {
      const t = i / perSeg;
      const w = Math.sin(t * Math.PI * 4 + s) * 0.0016 + Math.sin(t * Math.PI) * 0.012 * (s === 0 ? 1 : -1);
      out.push([+(a.lat + (b.lat - a.lat) * t + w * 0.5).toFixed(5), +(a.lng + (b.lng - a.lng) * t - w * 0.5).toFixed(5)]);
    }
  }
  const e = pts[pts.length - 1];
  out.push([e.lat, e.lng]);
  return out;
}

export function cumulative(path: number[][]): number[] {
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + haversineMeters(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]));
  return cum;
}
/** Point `m` metres along the path, with the heading of its segment. */
export function alongPath(path: number[][], m: number) {
  const cum = cumulative(path);
  const total = cum[cum.length - 1];
  const d = Math.max(0, Math.min(total, m));
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const f = (d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
  const a = path[i - 1], b = path[i];
  const lat = a[0] + (b[0] - a[0]) * f, lng = a[1] + (b[1] - a[1]) * f;
  const heading = ((Math.atan2((b[1] - a[1]) * Math.cos((a[0] * Math.PI) / 180), b[0] - a[0]) * 180) / Math.PI + 360) % 360;
  return { lat, lng, heading, total };
}

export function fixAt(path: number[][], m: number, speedKmh = 48, riderId = ME, groupId = RIDE0, ageMs = 0) {
  const p = alongPath(path, m);
  return { rider_id: riderId, group_id: groupId, timestamp_hlc: `${Date.now() - ageMs}:0`, lat: p.lat, lng: p.lng, speed_mps: speedKmh / 3.6, heading_deg: p.heading, spoof_flag: false, nis_score: 0.4, accuracy_m: 5 };
}

export function seed(o: SeedOpts = {}) {
  const { ride = 'planned', signedIn = true, onboarded = true, contacts = true, logs = true, rides: withRides = true, crews: withCrews = true } = o;
  const now = Date.now();
  DB.clear();
  (globalThis as any).__AUTH_UID__ = signedIn ? ME : null;
  (globalThis as any).__CLUSTERS__ = [];
  (globalThis as any).__SOS__ = [];

  // ── people ──
  const myDoc = T.myProfile(ME, now);
  const meP = { uid: ME, ...myDoc };
  const byId: any = { [ME]: meP };
  for (const p of T.crewProfiles(now)) byId[p.uid] = { uid: p.uid, ...p.doc };
  DB.set(`users/${ME}`, myDoc);
  for (const p of T.crewProfiles(now)) DB.set(`users/${p.uid}`, p.doc);

  // ── crews ──
  const crewDocs = T.crews(ME, now).map((c: any) => ({ id: T.crewDocId(c.key), name: c.name, created_by: c.created_by, member_ids: c.member_ids, roles: c.roles, join_code: c.code, created_ms: c.created_ms }));
  crewDocs.forEach((c: any) => DB.set(`crews/${c.id}`, c));

  // ── rides ──
  const base = T.rides(ME, now);
  const startToday = new Date(now); startToday.setHours(6, 30, 0, 0);
  const rideList = base.map((g: any, i: number) => {
    const r: any = {
      id: rideId(g.key), name: g.name, created_by: g.created_by, member_ids: g.member_ids, crew_id: T.crewDocId(g.crew_key), join_code: g.code,
      ride_type: g.ride_type, pace: g.pace, start_time_ms: g.start_time_ms, status: g.status, started_ms: g.started_ms ?? null, finished_ms: g.finished_ms ?? null,
      meetup: g.meetup, ride_plan: g.ride_plan, invited_ids: g.invited_ids, created_ms: g.created_ms,
    };
    if (i === 0) {
      r.start_time_ms = startToday.getTime();
      r.status = ride;
      if (ride === 'live') r.started_ms = now - 38 * MIN;
      if (ride === 'finished') { r.started_ms = now - 3.2 * HOUR; r.finished_ms = now - 40 * MIN; }
    }
    return r;
  });
  // Planned second ride's route stats so the card has numbers.
  const path0 = planPath(rideList[0].ride_plan);
  rideList[0].ride_plan = { ...rideList[0].ride_plan, route: { distance_km: 84.2, eta_minutes: 125, safety_score: 0.91, path: path0.flat() } };
  rideList.forEach((r: any) => {
    DB.set(`groups/${r.id}`, r);
  });
  const rsv = T.rsvps(ME, now);
  for (const [key, list] of Object.entries(rsv)) for (const d of list as any[]) DB.set(`groups/${rideId(key)}/rsvp/${d.uid}`, { status: d.status, updated_ms: d.updated_ms });
  const readyList = o.ready ?? [MEERA, ZOYA, KABIR];
  if (ride === 'meetup' || ride === 'live') {
    for (const uid of rideList[0].member_ids) DB.set(`groups/${RIDE0}/roll_call/${uid}`, { state: readyList.includes(uid) || ride === 'live' ? 'ready' : 'notready', updated_ms: now - 4 * MIN });
  }
  if (ride === 'live') for (const uid of rideList[0].member_ids) DB.set(`groups/${RIDE0}/presence/${uid}`, { state: 'riding', updated_ms: now - 20e3 });
  for (const [uid, state] of Object.entries(o.presence ?? {})) DB.set(`groups/${RIDE0}/presence/${uid}`, { state, updated_ms: now - 30e3 });

  const meet = rideList[0].meetup;
  for (const [uid, l] of Object.entries(o.locations ?? {})) {
    DB.set(`groups/${RIDE0}/locations/${uid}`, { rider_id: uid, group_id: RIDE0, timestamp_hlc: `${now - 5000}:0`, lat: meet.lat, lng: meet.lng + l.eastM / (111320 * Math.cos((meet.lat * Math.PI) / 180)), speed_mps: l.speed ?? 0, heading_deg: 270, spoof_flag: false, nis_score: 0.4, accuracy_m: 5 });
  }

  // ── logs ──
  const logDocs = T.logs(ME, now).sort((a: any, b: any) => b.started_ms - a.started_ms);
  if (ride === 'finished') {
    const src = logDocs.find((l: any) => l.name === 'Lonavala Sunrise Loop');
    logDocs.unshift({ ...src, ride_id: RIDE0, name: rideList[0].name, started_ms: rideList[0].started_ms, ended_ms: rideList[0].finished_ms, crew_id: CREW0, riders: 6, together_pct: 91, longest_gap_m: 600, hazards_shared: 2, signals_sent: 3, km: 84.2, duration_s: 7860, avg_kmh: 39, max_kmh: 68 });
  }
  logDocs.forEach((l: any) => DB.set(`users/${ME}/ride_logs/${l.ride_id}`, l));

  // ── settings ──
  const contactList = contacts ? [{ id: 'c1', name: 'Mom', number: '+919876521034' }] : [];
  DB.set(`users/${ME}/private/settings`, { onboarded, prefs: T.mySettings().prefs, contacts: contactList });

  // ── stores ──
  useSessionStore.setState({ authKnown: true, uid: signedIn ? ME : null });
  useAppStore.setState({ userId: signedIn ? ME : null, groupId: null, groupName: null, rideStartedAt: null });
  useProfileStore.setState({ me: signedIn ? meP : null, byId });
  usePrefsStore.setState({ prefs: T.mySettings().prefs, contacts: contactList, onboarded, phone: '+919876543210', loaded: true, uid: signedIn ? ME : null });
  useCrewsStore.setState({ crews: withCrews ? crewDocs : [], loaded: true, error: false, muted: {} });
  if (o.onlyNextRide) rideList.forEach((r: any) => { if (r.id !== RIDE0 && r.status === 'planned') { r.status = 'finished'; r.start_time_ms = now - 20 * 24 * HOUR; r.started_ms = r.start_time_ms; r.finished_ms = r.start_time_ms + 2 * HOUR; DB.set(`groups/${r.id}`, r); } });
  const rideObjs = rideList.map((r: any) => rideFromDoc(r.id, DB.get(`groups/${r.id}`)));
  useRidesStore.setState({ rides: withRides ? rideObjs : [], loaded: true, error: false });
  useRideLogsStore.setState({ logs: logs ? logDocs : [], loaded: true, error: false, uid: ME });
  useRidersStore.getState().clear();
  useRouteStore.setState({ route: null, avoidHazardTypes: [], isLoading: false, currentLocation: null, lastValidLocation: null, activeClusters: [] });
  useRidePlanStore.getState().clearPlan();
  useStopsStore.getState().reset?.();
  usePlanDraftStore.getState().reset();
  useOverlayStore.setState({ current: null });
  useToastStore.setState({ toasts: [] });

  // intel (hazard clusters on the next ride)
  (globalThis as any).__CLUSTERS__ = T.hazards(RIDE0, now);
  return { now, rides: rideObjs, crews: crewDocs, logs: logDocs, byId, path0 };
}

/** Everything a live ride needs: the plan, the route, own fix, crew positions. */
export function seedLive(o: { atM?: number; speedKmh?: number; riders?: Record<string, number | { m: number; ageMs?: number }>; clusters?: any[]; routeStats?: boolean; plan?: boolean } & SeedOpts = {}) {
  const w = seed({ ride: 'live', ...o });
  const r0 = w.rides[0];
  const path = w.path0;
  const atM = o.atM ?? 1500;
  if (o.plan !== false) {
    const plan = useRidePlanStore.getState();
    plan.setStart({ ...r0.ride_plan.start, id: 's' });
    plan.setDestination({ ...r0.ride_plan.destination, id: 'd' });
    r0.ride_plan.stops.forEach((s: any) => plan.addStop(s));
    useStopsStore.getState().syncFromPlan();
  }
  useAppStore.setState({ groupId: RIDE0, groupName: r0.name, rideStartedAt: Date.now() - 38 * MIN, userId: ME });
  const fix = fixAt(path, atM, o.speedKmh ?? 48);
  useRouteStore.setState({
    route: { route_id: 'r1', path_points: path, distance_km: 84.2 - atM / 1000, eta_minutes: 125, safety_score: 0.91, recalculated_at_hlc: `${Date.now()}:0` },
    currentLocation: fix, lastValidLocation: fix, activeClusters: o.clusters ?? [],
  });
  (globalThis as any).__CLUSTERS__ = o.clusters ?? [];
  (globalThis as any).__MAP__ = { lat: fix.lat, lng: fix.lng, mpp: 2.3, heading: fix.heading_deg };
  useRidersStore.setState({ connected: true });
  const riders = o.riders ?? { [MEERA]: 320, [ZOYA]: 140, [DEV]: -110, [ISHAN]: -190, [KABIR]: -300 };
  for (const [uid, v] of Object.entries(riders)) {
    const m = typeof v === 'number' ? v : v.m;
    const age = typeof v === 'number' ? 0 : v.ageMs ?? 0;
    useRidersStore.getState().upsertRider(fixAt(path, atM + m, 47, uid, RIDE0, age));
  }
  return { ...w, fix, path };
}

export const hazardCluster = (path: number[][], atM: number, type = 'pothole', count = 3, id = 'c-live') => {
  const p = alongPath(path, atM);
  return { cluster_id: id, group_id: RIDE0, hazard_type: type, centroid_lat: p.lat, centroid_lng: p.lng, polygon_points: [], report_count: count, hazard_score: 0.6, created_at_hlc: `${Date.now() - 6 * MIN}:0`, status: 'active' };
};

export function setTheme(themeId: string, scheme: string) {
  useThemeStore.setState({ themeId, mode: scheme });
}
