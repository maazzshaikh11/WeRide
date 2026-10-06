// @ts-nocheck
import './clock';
import './mocks';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Animated, Text, View } from 'react-native';

/**
 * Visual-parity scenes: every real screen, sheet and overlay of the app, rendered by react-native-web with native
 * modules stubbed (./stubs) and the stores + in-memory Firestore seeded from the teamDSY demo account (./seed.ts).
 * Scene keys equal the file names in docs/demo-screens/ so each render can be put next to its demo reference.
 *   index.html#<scene>[:<theme>[:<light|dark>]]       garage scenes default to Demo/light, road + SOS scenes to Demo/dark.
 * Animations are finished instantly (headless Chrome does not advance frames) and looping pulses are held still.
 */
const done = (v: any, cfg: any) => ({ start(cb?: any) { try { v.setValue(cfg.toValue); } catch {} cb?.({ finished: true }); }, stop() {}, reset() {} });
(Animated as any).timing = done;
(Animated as any).spring = done;
(Animated as any).loop = () => ({ start() {}, stop() {}, reset() {} });
(Animated as any).sequence = (list: any[]) => ({ start(cb?: any) { list.forEach((a) => a.start()); cb?.({ finished: true }); }, stop() {} });
(Animated as any).parallel = (Animated as any).sequence;
(Animated as any).delay = () => ({ start(cb?: any) { cb?.({ finished: true }); }, stop() {} });

import { ThemeContext, buildTheme, useTheme } from '@app/theme/ThemeProvider';
import { THEMES } from '@app/theme/palettes';
import { GarageTabBar } from '@app/navigation/GarageTabs';
import OverlayHost from '@app/overlays/OverlayHost';
import ToastContainer from '@app/components/ToastContainer';
import { useOverlayStore } from '@app/store/overlayStore';
import { useToastStore } from '@app/store/toastStore';
import { useRouteStore } from '@routing/client/routeStore';
import { useRidersStore } from '@app/store/ridersStore';
import { usePlanDraftStore } from '@app/store/planDraftStore';
import { usePrefsStore } from '@app/store/prefsStore';
import { useVoiceStore } from '@app/hooks/useVoiceChannel';
import { useSosSessionStore } from '@app/services/sosFlowService';
import { useSosEventsStore } from '@app/overlays/sosEventsStore';
import { startPhoneSignIn } from '@app/services/authService';

import SplashScreen from '@app/screens/onboarding/SplashScreen';
import PromiseScreen from '@app/screens/onboarding/PromiseScreen';
import AuthPhoneScreen from '@app/screens/onboarding/AuthPhoneScreen';
import AuthOtpScreen from '@app/screens/onboarding/AuthOtpScreen';
import ProfileScreen from '@app/screens/onboarding/ProfileScreen';
import PermsScreen from '@app/screens/onboarding/PermsScreen';
import ContactScreen from '@app/screens/onboarding/ContactScreen';
import DrillScreen from '@app/screens/onboarding/DrillScreen';
import CrewStartScreen from '@app/screens/onboarding/CrewStartScreen';
import JoinScreen from '@app/screens/garage/JoinScreen';
import RideHomeScreen from '@app/screens/garage/RideHomeScreen';
import CrewsScreen from '@app/screens/garage/CrewsScreen';
import CrewScreen from '@app/screens/garage/CrewScreen';
import LogScreen from '@app/screens/garage/LogScreen';
import RecapScreen from '@app/screens/garage/RecapScreen';
import MeScreen from '@app/screens/garage/MeScreen';
import SafetyScreen from '@app/screens/garage/SafetyScreen';
import DisplayScreen from '@app/screens/garage/DisplayScreen';
import PrivacyScreen from '@app/screens/garage/PrivacyScreen';
import PlanWhereScreen from '@app/screens/garage/PlanWhereScreen';
import PlanRouteScreen from '@app/screens/garage/PlanRouteScreen';
import PlanWhenScreen from '@app/screens/garage/PlanWhenScreen';
import PlanDoneScreen from '@app/screens/garage/PlanDoneScreen';
import MeetupScreen from '@app/screens/road/MeetupScreen';
import StopScreen from '@app/screens/road/StopScreen';
import ArriveScreen from '@app/screens/road/ArriveScreen';
import MapScreen from '@app/screens/map/MapScreen';

import IntelSheet from '@app/sheets/IntelSheet';
import RideInfoSheet from '@app/sheets/RideInfoSheet';
import NewCrewSheet from '@app/sheets/NewCrewSheet';
import CrewMenuSheet from '@app/sheets/CrewMenuSheet';
import InviteSheet from '@app/sheets/InviteSheet';
import MemberSheet from '@app/sheets/MemberSheet';
import ShareCardSheet from '@app/sheets/ShareCardSheet';
import RateRouteSheet from '@app/sheets/RateRouteSheet';
import FamilySheet from '@app/sheets/FamilySheet';
import VoicePrefsSheet from '@app/sheets/VoicePrefsSheet';
import PermsSheet from '@app/sheets/PermsSheet';
import AddContactSheet from '@app/sheets/AddContactSheet';

import { seed, seedLive, hazardCluster, setTheme, fixAt, alongPath, planPath, ME, MEERA, ZOYA, DEV, ISHAN, KABIR, RIDE0, CREW0, rideId } from './seed';
import T from '../../../infra/firebase/seed/teamdsy-data.js';

const nav: any = {
  navigate() {}, goBack() {}, replace() {}, reset() {}, dispatch() {}, setOptions() {}, push() {}, popToTop() {},
  getParent: () => ({ goBack() {}, navigate() {} }), addListener: () => () => {}, canGoBack: () => true, isFocused: () => true,
};
const rt = (params: any = {}) => ({ params, key: 'k', name: 'x' });
const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;
const byText = (txt: string) => Array.from(document.querySelectorAll('[role=button],button,[tabindex="0"]')).find((e) => (e as HTMLElement).innerText?.trim().toLowerCase().startsWith(txt.toLowerCase())) as HTMLElement | undefined;
/** Click the control matching a CSS selector, or `text=Label`, once it exists (polls up to 4 s). */
const tap = (sel: string, delay = 500) => {
  const start = Date.now();
  const go = () => {
    const el = sel.startsWith('text=') ? byText(sel.slice(5)) : q(sel);
    if (el) { el.click(); return; }
    if (Date.now() - start < 4000) setTimeout(go, 150);
  };
  setTimeout(go, delay);
};
const press = (sel: string, delay = 800) => setTimeout(() => {
  const el = q(sel);
  if (!el) return;
  for (const t of ['pointerdown', 'mousedown']) el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true }));
}, delay);
const typeInto = (sel: string, text: string, delay = 600) => setTimeout(() => {
  const el = q(sel) as HTMLInputElement | null;
  if (!el) return;
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  set.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}, delay);
const later = (fn: () => void, ms: number) => setTimeout(fn, ms);

const W = 390, H = 844;
const Frame = ({ children, bg }: any) => {
  const { colors } = useTheme();
  return <View style={{ width: W, height: H, backgroundColor: bg ?? colors.bg, overflow: 'hidden' }}>{children}</View>;
};
const tabState = (idx: number) => {
  const names = ['Ride', 'Crews', 'Log', 'Me'];
  return {
    state: { index: idx, key: 'tab', routes: names.map((n) => ({ key: n, name: n })) },
    descriptors: Object.fromEntries(names.map((n) => [n, { options: {} }])),
    navigation: { emit: () => ({ defaultPrevented: false }), dispatch() {} },
  } as any;
};
/** A Garage tab screen exactly as the navigator lays it out: content, then the real tab bar. */
const Tab = ({ idx, children, after }: any) => (
  <Frame><View style={{ flex: 1, minHeight: 0 }}>{children}</View><GarageTabBar {...tabState(idx)} />{after}</Frame>
);
const Plain = ({ children }: any) => <Frame>{children}</Frame>;
const Road = ({ children }: any) => { const { road } = useTheme(); return <Frame bg={road.bg}>{children}</Frame>; };
const Overlay = ({ base }: any) => <Frame bg="#101216">{base}<OverlayHost /></Frame>;

interface Scene { kind?: 'garage' | 'road'; setup?: () => Promise<void> | void; render: () => React.ReactElement; wait?: number }
const S: Record<string, Scene> = {};
const sheets = (k: string, tab: number | null, host: () => React.ReactElement, sheet: (w: any) => React.ReactElement, o: any = {}) => {
  S[k] = { setup: () => { (globalThis as any).__W__ = seed(o); }, render: () => { const w = (globalThis as any).__W__; return tab == null ? <Plain>{host()}{sheet(w)}</Plain> : <Tab idx={tab}>{host()}</Tab>; } };
};

// ───────────────────────── first launch ─────────────────────────
S['01-splash'] = { kind: 'road', setup: () => { seed({ signedIn: false, onboarded: false }); }, render: () => <Plain><SplashScreen navigation={nav} route={rt()} /></Plain> };
S['02-promise'] = { kind: 'road', setup: () => { seed({ signedIn: false, onboarded: false }); }, render: () => <Plain><PromiseScreen navigation={nav} route={rt()} /></Plain> };
S['03-auth-phone'] = { setup: () => { seed({ signedIn: false, onboarded: false }); }, render: () => <Plain><AuthPhoneScreen navigation={nav} route={rt()} /></Plain> };
const otp = async () => { seed({ signedIn: false, onboarded: false }); await startPhoneSignIn('+919876543210'); };
S['04-auth-otp'] = { setup: otp, render: () => <Plain><AuthOtpScreen navigation={nav} route={rt()} /></Plain> };
S['auth-otp-typed'] = { setup: otp, render: () => { ['4', '8', '2'].forEach((k, i) => tap(`[aria-label="${k}"]`, 500 + i * 200)); return <Plain><AuthOtpScreen navigation={nav} route={rt()} /></Plain>; } };
const first = { onboarded: false, contacts: false, crews: false, rides: false, logs: false };
S['05-profile'] = { setup: () => { seed(first); useProfileStoreMe(null); }, render: () => { typeInto('input', 'Arjun Rao', 600); return <Plain><ProfileScreen navigation={nav} route={rt()} /></Plain>; } };
S['06-perms'] = { setup: () => { seed(first); }, render: () => <Plain><PermsScreen navigation={nav} route={rt()} /></Plain> };
S['perm-prompt-location'] = { setup: () => { seed(first); }, render: () => { tap('[data-testid="perm-btn-location"]', 700); return <Plain><PermsScreen navigation={nav} route={rt()} /></Plain>; } };
S['07-contact'] = { setup: () => { seed({ ...first, contacts: true }); }, render: () => <Plain><ContactScreen navigation={nav} route={rt()} /></Plain> };
S['08-drill'] = { setup: () => { seed({ ...first, contacts: true }); }, render: () => <Plain><DrillScreen navigation={nav} route={rt({})} /></Plain> };
S['09-crew-start'] = { setup: () => { seed({ ...first, contacts: true }); }, render: () => <Plain><CrewStartScreen navigation={nav} route={rt()} /></Plain> };
S['10-join'] = { setup: () => { seed({ ...first, contacts: true }); }, render: () => <Plain><JoinScreen navigation={nav} route={rt({})} /></Plain> };
S['join-error'] = { setup: () => { seed({ ...first, contacts: true }); }, render: () => { 'K4N9TZ'.split('').forEach((k, i) => tap(`[aria-label="${k}"]`, 500 + i * 150)); tap('text=Join crew', 1800); return <Plain><JoinScreen navigation={nav} route={rt({})} /></Plain>; }, wait: 2200 };
function useProfileStoreMe(v: any) { const { useProfileStore } = require_profile(); useProfileStore.setState({ me: v }); }
import * as profileMod from '@app/store/profileStore';
function require_profile() { return profileMod; }

// ───────────────────────── garage ─────────────────────────
const home = (ride: any, o: any = {}) => ({ setup: () => { seed({ ride, ...o }); }, render: () => <Tab idx={0}><RideHomeScreen navigation={nav} route={rt()} /></Tab>, wait: 1800 });
S['11-home'] = home('planned');
S['11b-home-meetup'] = home('meetup');
S['11c-home-live'] = home('live');
S['11d-home-finished'] = home('finished', { onlyNextRide: true });
S['12-crews'] = { setup: () => { seed({}); }, render: () => <Tab idx={1}><CrewsScreen navigation={nav} route={rt()} /></Tab> };
S['13-crew'] = { setup: () => { seed({}); }, render: () => <Plain><CrewScreen navigation={nav} route={rt({ crewId: CREW0 })} /></Plain> };
S['14-log'] = { setup: () => { seed({}); }, render: () => <Tab idx={2}><LogScreen navigation={nav} route={rt()} /></Tab> };
const recapId = rideId('lonavala-sunrise-loop');
S['15-recap'] = { setup: () => { seed({}); }, render: () => <Plain><RecapScreen navigation={nav} route={rt({ rideId: recapId })} /></Plain>, wait: 1500 };
S['16-me'] = { setup: () => { seed({}); }, render: () => <Tab idx={3}><MeScreen navigation={nav} route={rt()} /></Tab> };
S['17-safety'] = { setup: () => { seed({}); }, render: () => <Plain><SafetyScreen navigation={nav} route={rt()} /></Plain> };
S['18-display'] = { setup: () => { seed({}); }, render: () => <Plain><DisplayScreen navigation={nav} route={rt()} /></Plain> };
S['19-privacy'] = { setup: () => { seed({}); }, render: () => <Plain><PrivacyScreen navigation={nav} route={rt()} /></Plain> };

// plan flow
const lonavala = { label: 'Lonavala, Maharashtra', lat: 18.7481, lng: 73.4072 };
const bandra = { label: 'Bandra Fort, Mumbai', lat: 19.0419, lng: 72.8188 };
S['20-plan-where'] = { setup: () => { seed({}); }, render: () => <Plain><PlanWhereScreen navigation={nav} route={rt()} /></Plain> };
S['21-plan-route'] = { setup: () => { seed({}); const d = usePlanDraftStore.getState(); d.setStart(bandra); d.setDestination(lonavala); }, render: () => <Plain><PlanRouteScreen navigation={nav} route={rt()} /></Plain>, wait: 2800 };
S['22-plan-when'] = { setup: () => {
  const w = seed({}); const d = usePlanDraftStore.getState();
  d.setStart(bandra); d.setDestination(lonavala);
  const p = planPath({ start: bandra, stops: [], destination: lonavala });
  d.setOptions([{ route_id: 'r1', path_points: p, distance_km: 84.2, eta_minutes: 125, safety_score: 0.91, hazard_count: 1, label: 'Fastest' }], 0);
  d.setCrew(CREW0, w.crews[0].member_ids.filter((u: string) => u !== ME), true);
}, render: () => <Plain><PlanWhenScreen navigation={nav} route={rt()} /></Plain>, wait: 1500 };
S['23-plan-done'] = { setup: () => {
  const w = seed({}); const d = usePlanDraftStore.getState();
  d.setStart(bandra); d.setDestination(lonavala);
  d.setOptions([{ route_id: 'r1', path_points: planPath({ start: bandra, stops: [], destination: lonavala }), distance_km: 84.2, eta_minutes: 125, safety_score: 0.91, hazard_count: 1, label: 'Fastest' }], 0);
  d.setCrew(CREW0, w.crews[0].member_ids.filter((u: string) => u !== ME), true);
}, render: () => <Plain><PlanDoneScreen navigation={nav} route={rt({ rideId: RIDE0 })} /></Plain>, wait: 1500 };

// ───────────────────────── road ─────────────────────────
const WAITING_LOC = { [MEERA]: { eastM: 20 }, [ZOYA]: { eastM: 35 }, [KABIR]: { eastM: 60 }, [DEV]: { eastM: 700, speed: 9 }, [ISHAN]: { eastM: 1500, speed: 7 } };
S['24-meetup'] = { setup: () => { seed({ ride: 'meetup', ready: [MEERA], locations: WAITING_LOC }); }, render: () => <Plain><MeetupScreen navigation={nav} route={rt({ groupId: RIDE0 })} /></Plain>, wait: 1800 };
S['meetup-waiting'] = S['24-meetup'];
S['meetup-ready'] = { setup: () => { seed({ ride: 'meetup', ready: [ME, MEERA, ZOYA, KABIR, DEV], locations: { ...WAITING_LOC, [DEV]: { eastM: 30 } } }); }, render: () => <Plain><MeetupScreen navigation={nav} route={rt({ groupId: RIDE0 })} /></Plain>, wait: 1800 };

const live = (o: any = {}, after?: () => void) => ({ kind: 'road' as const, setup: () => { seedLive(o); }, render: () => { after?.(); return <Plain><MapScreen navigation={nav} route={rt({ groupId: RIDE0 })} /></Plain>; }, wait: 1800 });
const TOGETHER = { [MEERA]: 300, [ZOYA]: 140, [DEV]: -110, [ISHAN]: -190, [KABIR]: -280 };
S['road-live'] = live({ riders: TOGETHER });
S['live-gap'] = live({ riders: { [MEERA]: 320, [ZOYA]: 140, [DEV]: -110, [ISHAN]: -520, [KABIR]: -1300 } });
const pathOf = () => planPath(T.rides(ME)[0].ride_plan);
S['live-hazard-ahead'] = { kind: 'road', setup: () => { const p = pathOf(); seedLive({ atM: 3000, riders: TOGETHER, clusters: [hazardCluster(p, 3380)] }); }, render: () => <Plain><MapScreen navigation={nav} route={rt({ groupId: RIDE0 })} /></Plain>, wait: 1800 };
S['live-hazard-confirm'] = { kind: 'road', setup: () => {
  const p = pathOf(); const c = hazardCluster(p, 3200);
  seedLive({ atM: 3050, riders: TOGETHER, clusters: [c] });
  later(() => { const f = fixAt(p, 3340); useRouteStore.setState({ currentLocation: f, lastValidLocation: f }); (globalThis as any).__MAP__ = { lat: f.lat, lng: f.lng, mpp: 2.3, heading: f.heading_deg }; }, 500);
}, render: () => <Plain><MapScreen navigation={nav} route={rt({ groupId: RIDE0 })} /></Plain>, wait: 2200 };
S['live-signal-incoming'] = live({ riders: TOGETHER }, () => later(() => (globalThis as any).__SOCK__.fire('signal:received', { group_id: RIDE0, rider_id: MEERA, label: 'Wait up' }), 900));
S['live-rider-nosignal'] = live({ riders: { ...TOGETHER, [KABIR]: { m: -280, ageMs: 70000 } } });
S['live-ptt'] = live({ riders: TOGETHER }, () => later(() => useVoiceStore.setState({ status: 'live', talking: true }), 900));
S['live-sheet-signals'] = live({ riders: TOGETHER }, () => tap('[data-testid="key-signal"]', 900));
S['live-sheet-hazard'] = live({ riders: TOGETHER }, () => tap('[data-testid="key-hazard"]', 900));

const stopSetup = () => { seedLive({ atM: 42000, presence: { [MEERA]: 'ready', [ZOYA]: 'ready', [ISHAN]: 'ready', [DEV]: 'fuel', [KABIR]: 'riding', [ME]: 'stopped' } }); };
S['road-stop'] = { kind: 'road', setup: stopSetup, render: () => <Plain><StopScreen navigation={nav} route={rt({ groupId: RIDE0, stopId: 's1' })} /></Plain>, wait: 1800 };
S['road-stop-late'] = { kind: 'road', setup: () => { seedLive({ atM: 42000, presence: { [MEERA]: 'ready', [ZOYA]: 'ready', [DEV]: 'ready', [ISHAN]: 'riding', [KABIR]: 'riding', [ME]: 'stopped' } }); }, render: () => <Plain><StopScreen navigation={nav} route={rt({ groupId: RIDE0, stopId: 's1' })} /></Plain>, wait: 1800 };
S['road-arrive'] = { kind: 'road', setup: () => { const p = pathOf(); seedLive({ atM: 90000, presence: { [ME]: 'arrived', [MEERA]: 'arrived', [ZOYA]: 'arrived', [DEV]: 'arrived', [ISHAN]: 'arrived', [KABIR]: 'riding' } }); }, render: () => <Plain><ArriveScreen navigation={nav} route={rt({ groupId: RIDE0 })} /></Plain>, wait: 1800 };

// ───────────────────────── SOS & overlays ─────────────────────────
const sosSession = (o: any) => { const f = useRouteStore.getState().lastValidLocation; useSosSessionStore.getState().setSession({ sosId: 'sos1', groupId: RIDE0, drill: false, auto: false, startedMs: Date.now() - 12000, fix: { lat: f.lat, lng: f.lng, accuracy_m: 5 }, queued: false, ...o }); };
const goingDocs = () => { const D = (globalThis as any).__FS__; D.set('sos_events/sos1/responders/' + MEERA, { state: 'going', updated_ms: Date.now() - 5000 }); D.set('sos_events/sos1/responders/' + ZOYA, { state: 'going', updated_ms: Date.now() - 4000 }); };
const sosScene = (state: any, session: any, extra?: () => void) => ({ kind: 'road' as const, setup: () => { (globalThis as any).__QUEUE__ = []; seedLive({ riders: TOGETHER }); sosSession(session); extra?.(); useOverlayStore.getState().show(state); }, render: () => <Overlay base={null} />, wait: 1500 });
S['sos-sent'] = sosScene({ kind: 'sos-sent', sosId: 'sos1', groupId: RIDE0 }, {}, goingDocs);
S['sos-queued'] = sosScene({ kind: 'sos-sent', sosId: 'sos1', groupId: RIDE0 }, { queued: true }, () => { (globalThis as any).__QUEUE__ = [{ type: 'sos_event', data: { sos_id: 'sos1' } }]; useRidersStore.setState({ connected: false }); });
S['sos-drill'] = sosScene({ kind: 'sos-sent', sosId: 'sos1', groupId: RIDE0, drill: true }, { drill: true });
S['sos-auto'] = sosScene({ kind: 'sos-sent', sosId: 'sos1', groupId: RIDE0, auto: true }, { auto: true }, goingDocs);
const incoming = { kind: 'sos-incoming', sosId: 'sos9', riderId: KABIR, groupId: RIDE0, lat: 0, lng: 0, startedMs: Date.now() - 40000 };
const inSetup = () => { seedLive({ riders: TOGETHER }); const D = (globalThis as any).__FS__; D.set('sos_events/sos9/responders/' + MEERA, { state: 'going', updated_ms: Date.now() - 9000 }); D.set('sos_events/sos9/responders/' + ZOYA, { state: 'going', updated_ms: Date.now() - 6000 }); const f = fixAt(pathOf(), 1500 - 1400, 0, KABIR); incoming.lat = f.lat; incoming.lng = f.lng; useOverlayStore.getState().show(incoming); };
S['sos-incoming'] = { kind: 'road', setup: inSetup, render: () => <Overlay base={null} />, wait: 1500 };
S['sos-incoming-going'] = { kind: 'road', setup: inSetup, render: () => { tap('[data-testid="sosin-going"]', 900); return <Overlay base={null} />; }, wait: 2000 };
S['crash-countdown'] = { kind: 'road', setup: () => { seedLive({}); useOverlayStore.getState().show({ kind: 'crash' }); }, render: () => <Overlay base={null} />, wait: 1200 };
S['call-112'] = { kind: 'road', setup: () => { seedLive({}); useOverlayStore.getState().show({ kind: 'call112' }); }, render: () => <Overlay base={null} />, wait: 1200 };

// ───────────────────────── sheets ─────────────────────────
const homeHost = () => <Tab idx={0}><RideHomeScreen navigation={nav} route={rt()} /></Tab>;
const sh = (k: string, idx: number, host: () => any, sheet: () => any, o: any = {}) => {
  S[k] = { setup: () => { (globalThis as any).__W__ = seed(o); }, render: () => <Frame>{host()}{sheet()}</Frame>, wait: 1500 };
};
const hostTab = (idx: number, el: any) => () => (<View style={{ flex: 1 }}><View style={{ flex: 1, minHeight: 0 }}>{el}</View><GarageTabBar {...tabState(idx)} /></View>);
const w = () => (globalThis as any).__W__;
sh('sheet-intel', 0, hostTab(0, <RideHomeScreen navigation={nav} route={rt()} />), () => {
  const r = w().rides[0]; const path = planPath(r.ride_plan);
  return <IntelSheet visible onClose={() => {}} clusters={(globalThis as any).__CLUSTERS__} path={path.map((p) => ({ lat: p[0], lng: p[1] }))} safety={0.91} />;
});
sh('sheet-rideinfo', 0, hostTab(0, <RideHomeScreen navigation={nav} route={rt()} />), () => <RideInfoSheet visible onClose={() => {}} ride={w().rides[1]} />);
sh('sheet-newcrew', 1, hostTab(1, <CrewsScreen navigation={nav} route={rt()} />), () => <NewCrewSheet visible onClose={() => {}} />);
sh('sheet-crewmenu', 1, () => <CrewScreen navigation={nav} route={rt({ crewId: CREW0 })} />, () => <CrewMenuSheet visible onClose={() => {}} crewName="Ghat Ghosts" muted={false} />);
sh('sheet-invite', 1, () => <CrewScreen navigation={nav} route={rt({ crewId: CREW0 })} />, () => <InviteSheet visible onClose={() => {}} crew={w().crews[0]} />);
sh('sheet-member', 1, () => <CrewScreen navigation={nav} route={rt({ crewId: CREW0 })} />, () => <MemberSheet visible onClose={() => {}} profile={w().byId[MEERA]} uid={MEERA} role="lead" isMe={false} />);
sh('sheet-sharecard', 1, () => <RecapScreen navigation={nav} route={rt({ rideId: recapId })} />, () => <ShareCardSheet visible onClose={() => {}} log={w().logs.find((l: any) => l.ride_id === recapId)} />);
sh('sheet-rate', 1, () => <RecapScreen navigation={nav} route={rt({ rideId: recapId })} />, () => <RateRouteSheet visible onClose={() => {}} rideId={recapId} current={null} />);
sh('sheet-family', 3, hostTab(3, <MeScreen navigation={nav} route={rt()} />), () => <FamilySheet visible onClose={() => {}} />);
sh('sheet-voiceprefs', 3, hostTab(3, <MeScreen navigation={nav} route={rt()} />), () => <VoicePrefsSheet visible onClose={() => {}} />);
sh('sheet-perms', 3, hostTab(3, <MeScreen navigation={nav} route={rt()} />), () => { (globalThis as any).__NOTIF__ = 1; return <PermsSheet visible onClose={() => {}} />; });
sh('sheet-addcontact', 0, () => <SafetyScreen navigation={nav} route={rt()} />, () => <AddContactSheet visible onClose={() => {}} />, { contacts: false });

// ───────────────────────── runner ─────────────────────────
class Boundary extends React.Component<any, { err: any }> {
  state = { err: null };
  static getDerivedStateFromError(err: any) { return { err }; }
  componentDidCatch(err: any) { (window as any).__ERR__ = String(err?.stack || err).slice(0, 1500); }
  render() { return this.state.err ? <View style={{ width: W, height: H, backgroundColor: '#fee', padding: 16 }}><Text style={{ color: '#900', fontFamily: 'monospace', fontSize: 11 }}>{String((this.state.err as any)?.stack || this.state.err).slice(0, 1400)}</Text></View> : this.props.children; }
}
const errs: string[] = [];
(window as any).__ERRS__ = errs;
window.addEventListener('error', (e) => errs.push('uncaught: ' + (e.error?.stack || e.message).toString().slice(0, 600)));
window.addEventListener('unhandledrejection', (e) => errs.push('rejection: ' + String((e.reason && e.reason.stack) || e.reason).slice(0, 600)));
const ce = console.error.bind(console);
console.error = (...a: any[]) => { const s = a.map((x) => (x && x.stack) || String(x)).join(' ').slice(0, 500); if (!/Warning: |React does not recognize|validateDOMNesting|Unknown event handler|act\(/.test(s)) errs.push('console.error: ' + s); ce(...a); };

const [name, themeArg = 'demo', schemeArg = ''] = (location.hash || '#11-home').slice(1).split(':');
(async () => {
  const sc = S[name];
  if (!sc) { document.body.innerHTML = `<pre id="noscene">NO SCENE ${name}</pre>`; (window as any).__READY__ = 'noscene'; return; }
  const themeId = themeArg === 'ember' ? 'ember' : 'demo';
  const scheme = (schemeArg || (sc.kind === 'road' ? 'dark' : 'light')) as any;
  try {
    setTheme(themeId, scheme);
    await sc.setup?.();
    // setup may reset stores: theme again so DisplayScreen shows the right choice
    setTheme(themeId, scheme);
  } catch (e: any) { errs.push('setup: ' + (e?.stack || e)); }
  document.body.style.background = THEMES[themeId][scheme].bg;
  const theme = buildTheme(themeId, THEMES[themeId][scheme], sc.kind === 'road' ? scheme : undefined);
  createRoot(document.getElementById('root')!).render(
    <ThemeContext.Provider value={theme}><Boundary>{sc.render()}</Boundary></ThemeContext.Provider>,
  );
  (window as any).__WAIT__ = sc.wait ?? 1200;
  (window as any).__READY__ = 'ok';
})();
