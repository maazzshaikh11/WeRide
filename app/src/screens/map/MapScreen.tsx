/**
 * Live Ride screen — demo.html "Road mode", on a real Mapbox map.
 * Layer 0: Mapbox map (dark/light by theme)
 * Layer 1: map overlays (riders, hazards, SOS, route line) + the rider's own avatar,
 *          with a small floating distance label pinned to its RIGHT (distance to the
 *          nearest live crew member, from real verified fixes — nothing simulated)
 * Layer 2: floating UI — header (back, ride name, live pill), one status plate
 *          ("is the group OK?"), side buttons (group, follow/fit),
 *          speed + ETA cluster, and the control keys (SOS hold, Signal, Hazard, Talk).
 *          Signal / Hazard / Route open as sheets.
 *
 * There is no separate crew-ahead/behind panel: the readout belongs next to the avatar.
 *
 * Demo parity (docs/DEMO_PARITY_SPEC.md §3 Live): the plate also shows hazard-ahead, signal-from-the-crew,
 * stop-ahead and rider-no-signal; after passing a hazard the plate is replaced by STILL THERE / GONE;
 * GROUP fits every rider for 7 s; the Talk key is push-to-talk on the crew voice channel; SOS goes through
 * triggerSosFlow; glove mode and units follow the rider's prefs; own fixes and riders feed the ride recorder;
 * own presence is written while live; Stop / Arrive open automatically.
 *
 * Person A/B/C/D functionality fully preserved:
 *  - TrackingService lifecycle (Person A)
 *  - Hazard/SOS Firestore subscriptions (Person B)
 *  - RoutingClient + route store (Person C)
 *  - The screen stays mounted underneath Stop / Arrive (they are pushed on top), so tracking never restarts
 */
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, Linking, ScrollView } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAPBOX_TOKEN } from '@env';
import { Plate } from '../../ui';
import RiderMarkerOverlay, { RiderInfoCard } from './overlays/RiderMarkerOverlay';
import { HazardOverlayMapLayer, HazardOverlayInfoCard } from './overlays/HazardOverlay';
import { SosOverlayMapLayer, SosOverlayInfoCards, ActiveSos } from './overlays/SosOverlay';
import RouteOverlay from './overlays/RouteOverlay';
import FlStatusOverlay from './overlays/FlStatusOverlay';
import { useAppStore } from '../../store/appStore';
import { useRidersStore } from '../../store/ridersStore';
import { useRouteStore } from '@routing/client/routeStore';
import { useToastStore } from '../../store/toastStore';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import { getToggleAvoidHazards } from './overlays/routeControls';
import LivePill from '../../components/LivePill';
import ToastContainer from '../../components/ToastContainer';
import NetworkBanner from '../../components/NetworkBanner';
import SignalSheet from '../../components/SignalSheet';
import HazardSheet from '../../components/HazardSheet';
import RouteSheet from '../../components/RouteSheet';
import SosFab from '../../components/SosFab';
import { googleMapsDeepLink } from '@routing/client/deepLink';
import { GroupService } from '@routing/group/groupService';
import { resolveSos } from '@hazard/services/sosService';
import { resolveHazard } from '@hazard/services/hazardService';
import { logError, warn } from '../../utils/log';
import { resetRideSession } from '../../store/rideSession';
import { useRidePlanStore } from '../../store/ridePlanStore';
import { useRidesStore } from '../../store/ridesStore';
import { riderName, useProfileStore } from '../../store/profileStore';
import { usePrefsStore } from '../../store/prefsStore';
import { useStopsStore } from '../../store/stopsStore';
import { Icon, PressableScale } from '../../ui';
import { fitPadding, planFit } from '../../utils/mapFit';
import { nextNetworkBanner, NetworkTracker } from '../../utils/networkBanner';
import { fitPointsFor, fitSignature } from './rideGeometry';
import { useRouteFit } from './useRouteFit';
import LiveAvatar from './live/LiveAvatar';
import { ControlKey, SideButton, SpeedCluster, Vignettes, clockAfter, useLiveLayout } from './live/LiveChrome';
import { CONTROL_GAP, HEADER_BAR_H, HEADER_PAD } from './live/liveLayout';
import { hazardName } from './live/liveRide';
import { formatGap, freshRiders, groupSpreadM, liveStatus, nearestRider, staleRider } from './live/liveGeometry';
import { HazardConfirmButtons, TalkPlate } from './live/LiveOverlays';
import { useLiveFlow, FlowStop } from './live/useLiveFlow';
import { markStopVisited, startRecorderOnce } from '../../services/rideFlow';
import { rideRecorder } from '../../services/rideRecorder';
import { setPresence } from '../../services/rideService';
import { noteAnyFix, triggerSosFlow } from '../../services/sosFlowService';
import { setTalking, startVoice, stopVoice, useVoiceChannel } from '../../hooks/useVoiceChannel';

// Phase 6 — tracking service wiring (Person A, unchanged)
import { Ekf } from '@tracking/ekf';
import { SensorStream } from '@tracking/sensorStream';
import { OwnLocationPublisher, isUsableOwnFix } from '../../services/ownLocationPublisher';
import { TrackingService } from '@tracking/trackingService';
import { loadHlc } from '@tracking/hlcStore';
import { getLocationSocket } from '../../services/socketService';

MapboxGL.setAccessToken(MAPBOX_TOKEN ?? '');

// Floating-UI footprint the route must stay clear of when the camera frames it. The numbers are height-aware and
// come from liveLayout() (live/liveLayout.ts): the header, status plate, side buttons, cluster and controls below are
// all laid out from them, so a short screen or glove mode changes them in one place.
const NETWORK_BANNER_H = 64;                          // reserved height of the banner (toasts stack below it)
const FOLLOW_ZOOM = 16;
const GROUP_VIEW_MS = 7000;                           // GROUP button: fit everyone for 7 s, then follow again
const PRESENCE_MS = 15000;                            // own presence (riding) is refreshed this often while live
const GAP_EVENT_M = 500;                              // the recorded "gap" event starts past this spread

/** Minimal slice of the tab navigator's `navigation` prop that MapScreen uses. */
export interface MapScreenNavigation {
  goBack: () => void;
  navigate?: (name: string, params?: object) => void;
  reset?: (state: { index: number; routes: { name: string; params?: object }[] }) => void;
  canGoBack?: () => boolean;
  isFocused?: () => boolean;
  getParent?: () => { goBack: () => void } | undefined;
}

interface MapScreenProps {
  navigation?: MapScreenNavigation;
  route?: { params?: { groupId?: string } };
}

export default function MapScreen({ navigation, route: navRoute }: MapScreenProps = {}) {
  // No demo fallback: without a real group there is nothing to track.
  // The component renders a "no group selected" placeholder instead.
  const storeGroupId = useAppStore((s) => s.groupId);
  const groupId = navRoute?.params?.groupId ?? storeGroupId;
  const userId = useAppStore((s) => s.userId);
  const riders = useRidersStore((s) => s.riders);
  const connected = useRidersStore((s) => s.connected);
  const lastValidLocation = useRouteStore((s) => s.lastValidLocation);
  const route = useRouteStore((s) => s.route);
  const activeClusters = useRouteStore((s) => s.activeClusters);
  const avoidHazardTypes = useRouteStore((s) => s.avoidHazardTypes);
  const units = usePrefsStore((s) => s.prefs.units);
  const glove = usePrefsStore((s) => s.prefs.glove);
  const ride = useRidesStore((s) => s.rides.find((r) => r.id === groupId) ?? null);
  const profiles = useProfileStore((s) => s.byId);
  const push = useToastStore((s) => s.push);
  const insets = useSafeAreaInsets();
  const { road, scheme } = useTheme();
  const layout = useLiveLayout(glove);
  const hudX = layout.sideMargin + layout.gutter;
  // Height of the header + plate block as laid out (it grows if the plate wraps); the side column, banner and toasts hang off it.
  const [topH, setTopH] = useState(0);
  const styles = useStyles(({ road: r, roadType: t }) => ({
    container: { flex: 1, backgroundColor: r.bg },
    map: { flex: 1 },
    top: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
    headerRow: { height: HEADER_BAR_H, flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: r.card, borderWidth: 1.5, borderColor: r.line, alignItems: 'center', justifyContent: 'center' },
    titleBox: { flex: 1, minWidth: 0, justifyContent: 'center', paddingHorizontal: 12, height: 44, borderRadius: 14, backgroundColor: r.card, borderWidth: 1.5, borderColor: r.line },
    title: { ...t.h3, fontSize: 16, lineHeight: 20 },
    bannerWrap: { position: 'absolute', left: 0, right: 0, zIndex: 20 },
    sideColumn: { position: 'absolute', zIndex: 30 },
    bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 25 },
    controls: { position: 'absolute', flexDirection: 'row', gap: CONTROL_GAP, zIndex: 25 },
    noGroup: { flex: 1, backgroundColor: r.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
    noGroupTitle: { ...t.h2 },
    noGroupSub: { ...t.body, textAlign: 'center' },
  }));
  const [signalOpen, setSignalOpen] = useState(false);
  const [hazardOpen, setHazardOpen] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);
  const [groupView, setGroupView] = useState(false);
  const groupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Camera: frame the route (Google Maps style); follow the rider only on request.
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const [mapReady, setMapReady] = useState(false);
  const planStart = useRidePlanStore((s) => s.start);
  const planStops = useRidePlanStore((s) => s.stops);
  const planDestination = useRidePlanStore((s) => s.destination);
  // null = automatic (follow only when there is nothing to frame), else rider's choice.
  const [followPref, setFollowPref] = useState<boolean | null>(null);

  // UI state
  const [sosEvents, setSosEvents] = useState<ActiveSos[]>([]);
  const [selectedHazard, setSelectedHazard] = useState<any>(null);
  const [networkBanner, setNetworkBanner] = useState<'lost' | 'recovered' | null>(null);
  // Ride name for the header (demo shows "Lonavala Loop", not the group ID).
  const [rideName, setRideName] = useState<string | null>(null);

  const networkRef = useRef<NetworkTracker>({ everConnected: false, prev: null });

  // Keep a stable ref to the service so useEffect cleanup can always call .stop()
  const serviceRef = useRef<TrackingService | null>(null);

  // Latest finite fix regardless of accuracy/spoof gates. Routing and hazard
  // reports require a trusted fix (lastValidLocation), but an SOS must still
  // carry the best position we have: a rough one beats none in an emergency.
  // A ref, not state, so the 1 Hz stream does not re-render the screen.
  const lastAnyFixRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    // Guard: do not start tracking without a valid identity.
    if (!userId || !groupId) {
      return;
    }
    if (serviceRef.current) {
      return;
    }

    const ekf      = new Ekf({ lat: 0, lng: 0 });
    const sensors  = new SensorStream();
    const socket   = getLocationSocket();
    const hlc      = loadHlc();

    // Own fixes never come back over the socket (server excludes the sender),
    // so the publisher feeds the route/alerts/stops stores directly.
    const publisher = new OwnLocationPublisher(
      { socket, riderId: userId, groupId },
      (fix) => {
        lastAnyFixRef.current = { lat: fix.lat, lng: fix.lng };
        noteAnyFix({ lat: fix.lat, lng: fix.lng, accuracy_m: fix.accuracy_m });
        if (!isUsableOwnFix(fix)) return;
        const routeState = useRouteStore.getState();
        routeState.setCurrentLocation(fix);
        routeState.setLastValidLocation(fix);
        // the ride recorder takes the same trusted fixes (1 Hz)
        rideRecorder.onOwnFix(fix);
      },
    );

    const service = new TrackingService({ ekf, sensors, publisher, hlc });
    serviceRef.current = service;

    // Prefer background tracking; fall back to foreground when the native
    // background module is unavailable (permissions, platform limits).
    service.start(true).then((started) => {
      if (started) return;
      warn('[MapScreen] Background tracking unavailable; falling back to foreground.');
      push('Background location unavailable — using foreground tracking', 'warn');
      return service.start(false).then((fgStarted) => {
        if (!fgStarted) {
          logError('[MapScreen] TrackingService.start failed (foreground too).');
          push('Could not start location tracking', 'error');
        }
      });
    }).catch((err: unknown) => {
      logError('[MapScreen] TrackingService.start failed:', err);
    });

    // Subscribe riders store to location updates (other riders' markers).
    useRidersStore.getState().subscribe(groupId);

    // Seed other riders' last-known positions so the map is not empty on join.
    publisher
      .fetchGroupLastKnown(groupId)
      .then((docs) => useRidersStore.getState().seedRiders(docs))
      .catch((e: unknown) => {
        warn('[MapScreen] Rider seed failed:', e);
      });

    // Load the ride plan saved at group creation (Create Ride modal).
    const groupService = new GroupService();
    groupService
      .getGroup(groupId)
      .then((group) => {
        if (group?.name) {
          setRideName(group.name);
          useAppStore.getState().setGroupName?.(group.name);
        }
      })
      .catch((e: unknown) => {
        warn('[MapScreen] Group name load failed:', e);
      });
    groupService
      .getRidePlan(groupId)
      .then((plan) => {
        if (!plan) return;
        const planStore = useRidePlanStore.getState();
        planStore.clearPlan();
        planStore.setStart(plan.start ?? null);
        planStore.setDestination(plan.destination ?? null);
        plan.stops.forEach((s) =>
          planStore.addStop({ id: s.id, label: s.label, lat: s.lat, lng: s.lng, icon: s.icon })
        );
        useStopsStore.getState().syncFromPlan();
      })
      .catch((e: unknown) => {
        warn('[MapScreen] Ride plan load failed:', e);
      });

    return () => {
      service.stop().catch((err: unknown) => {
        logError('[MapScreen] TrackingService.stop failed:', err);
      });
      serviceRef.current = null;
      useRidersStore.getState().unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `push` is a stable store action; restarting tracking for it would be wrong
  }, [userId, groupId]);

  // Opened for a ride other than the one the app remembers (e.g. rolled out from the roll call): switch the session to it.
  useEffect(() => {
    const id = navRoute?.params?.groupId;
    if (!id || id === storeGroupId) return;
    resetRideSession();
    useAppStore.getState().setGroupId(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the route param decides
  }, [navRoute?.params?.groupId]);

  // Names and avatars for everyone in the ride.
  useEffect(() => {
    if (ride?.member_ids?.length) useProfileStore.getState().ensure(ride.member_ids);
  }, [ride?.member_ids]);

  // Recording: start (once) if the roll-out overlay did not already, and feed the recorder the other riders every second.
  useEffect(() => {
    if (ride && ride.status === 'live') startRecorderOnce(ride);
  }, [ride]);
  useEffect(() => {
    const id = setInterval(() => {
      const list = freshRiders(useRidersStore.getState().riders, userId).map((r) => r.location);
      rideRecorder.onRiders(list);
    }, 1000);
    return () => clearInterval(id);
  }, [userId]);

  // Presence: "riding" while this screen is the one in front (Stop / Arrive write their own).
  useEffect(() => {
    if (!groupId || !userId) return;
    const write = () => {
      if (navigation?.isFocused && !navigation.isFocused()) return;
      setPresence(groupId, userId, 'riding').catch(() => undefined);
    };
    write();
    const id = setInterval(write, PRESENCE_MS);
    return () => clearInterval(id);
  }, [groupId, userId, navigation]);

  // Crew voice channel (joins only when the microphone is already allowed) + push-to-talk.
  const voice = useVoiceChannel(groupId, userId);
  const talkHeld = useRef(false);
  const onTalkIn = useCallback(() => {
    if (!groupId || !userId) return;
    if (voice.status !== 'live') {
      push("Voice channel isn't live yet", 'warn');
      // the first hold asks for the microphone / connects, so the next hold can work
      startVoice(groupId, userId, { prompt: true }).catch(() => undefined);
      return;
    }
    if (setTalking(true)) talkHeld.current = true;
    else push("Voice channel isn't live yet", 'warn');
  }, [groupId, userId, voice.status, push]);
  const onTalkOut = useCallback(() => {
    if (!talkHeld.current) return;
    talkHeld.current = false;
    setTalking(false);
  }, []);
  useEffect(
    () => () => {
      if (talkHeld.current) setTalking(false);
      stopVoice().catch(() => undefined);
    },
    [],
  );

  // Network banner: only after the socket was actually up and then dropped
  // (the first connect after mount is not a recovery).
  useEffect(() => {
    const { tracker, banner } = nextNetworkBanner(networkRef.current, connected);
    networkRef.current = tracker;
    if (banner) setNetworkBanner(banner);
  }, [connected]);

  const plan = useMemo(
    () => ({ start: planStart, stops: planStops, destination: planDestination }),
    [planStart, planStops, planDestination],
  );
  const fitPoints = useMemo(() => fitPointsFor(route, plan), [route, plan]);
  const signature = useMemo(() => fitSignature(plan, route != null), [plan, route]);
  const following = followPref ?? fitPoints.length === 0;
  const padding = useMemo(
    () =>
      fitPadding({
        headerHeight: insets.top + layout.topChromeH,
        fabColumnWidth: layout.sideColumnW + layout.sideMargin,
        sheetHeight: layout.controlsBottom + layout.controlH + layout.clusterH + 8,
      }),
    [insets.top, layout],
  );
  const { fit, markFitted } = useRouteFit({
    cameraRef,
    mapReady,
    following,
    points: fitPoints,
    signature,
    padding,
  });

  // Recenter control: toggles between "frame the route" and "follow me".
  const toggleFollow = useCallback(() => {
    if (fitPoints.length === 0) {
      push('Nothing to frame yet — follow mode is on', 'warn');
      return;
    }
    setFollowPref(!following);
  }, [following, fitPoints.length, push]);

  // FAB: open Google Maps deep link (Person C's deepLink util)
  const openGoogleMaps = useCallback(() => {
    const origin = lastValidLocation
      ? { lat: lastValidLocation.lat, lng: lastValidLocation.lng }
      : null;
    const dest = route?.path_points?.length
      ? { lat: route.path_points[route.path_points.length - 1][0], lng: route.path_points[route.path_points.length - 1][1] }
      : null;
    if (!dest) {
      push('No route destination yet', 'warn');
      return;
    }
    const url = origin
      ? googleMapsDeepLink(origin, dest)
      : `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}`;
    Linking.openURL(url).catch(() => push('Could not open Google Maps', 'warn'));
  }, [lastValidLocation, route, push]);

  const handleResolveSos = useCallback(async (sosId: string) => {
    if (!groupId) return;
    try {
      await resolveSos(sosId, groupId);
      push('SOS cancelled');
    } catch (e) {
      logError('[MapScreen] resolveSos failed:', e);
      push('Failed to cancel SOS', 'error');
    }
  }, [groupId, push]);

  const onSosEventsChange = useCallback((events: ActiveSos[]) => {
    setSosEvents(events);
  }, []);

  // "‹ Rides": return to the Groups list (the tab navigator's parent stack).
  const goToRides = useCallback(() => {
    const parent = navigation?.getParent?.();
    if (parent) {
      parent.goBack();
    } else if (navigation?.canGoBack && !navigation.canGoBack() && navigation.reset) {
      // Live is usually the only screen in the stack (reset to by the roll-out): go home instead of nowhere.
      navigation.reset({ index: 0, routes: [{ name: 'GarageTabs' }] });
    } else {
      navigation?.goBack();
    }
  }, [navigation]);

  // GROUP: fit every rider for 7 s, then the camera goes back to following / framing the route.
  const showGroup = useCallback(() => {
    const pts: { lat: number; lng: number }[] = [];
    if (lastValidLocation) pts.push({ lat: lastValidLocation.lat, lng: lastValidLocation.lng });
    useRidersStore.getState().riders.forEach((r) => pts.push({ lat: r.location.lat, lng: r.location.lng }));
    const fitPlan = planFit(pts);
    if (!fitPlan) {
      push('No riders to show yet', 'warn');
      return;
    }
    setGroupView(true);
    if (fitPlan.kind === 'bounds') cameraRef.current?.fitBounds(fitPlan.ne, fitPlan.sw, padding, 600);
    else cameraRef.current?.setCamera({ centerCoordinate: fitPlan.center, zoomLevel: fitPlan.zoom, animationDuration: 600 });
    if (groupTimer.current) clearTimeout(groupTimer.current);
    groupTimer.current = setTimeout(() => {
      groupTimer.current = null;
      setGroupView(false);
      if (!following) fit(true);
    }, GROUP_VIEW_MS);
  }, [lastValidLocation, padding, following, fit, push]);
  useEffect(() => () => {
    if (groupTimer.current) clearTimeout(groupTimer.current);
  }, []);

  // ---- live values: all from real data; null/empty when there is nothing to show ----
  const others = useMemo(() => freshRiders(riders, userId), [riders, userId]);
  const own = lastValidLocation ? { lat: lastValidLocation.lat, lng: lastValidLocation.lng } : null;
  const nearest = nearestRider(own, others);
  const gapLabel = nearest ? formatGap(nearest.distanceM) : null;
  const sosFrom = sosEvents.find((e) => !e.resolved && !e.isSender)?.rider_id ?? null;
  const nameOf = useCallback((id: string) => riderName(profiles, id, userId), [profiles, userId]);
  const flowStops = useMemo<FlowStop[]>(
    () => planStops.map((st) => ({ id: st.id, label: st.label, lat: st.lat, lng: st.lng, name: st.label.split(',')[0] })),
    [planStops],
  );
  const flow = useLiveFlow({
    groupId,
    userId,
    fix: lastValidLocation,
    routePath: route?.path_points ?? null,
    clusters: activeClusters,
    stops: flowStops,
    destination: planDestination ? { lat: planDestination.lat, lng: planDestination.lng } : null,
    nameOf,
    push,
    onOpenStop: (stopId) => {
      if (groupId) navigation?.navigate?.('Stop', { groupId, stopId });
    },
    onArrive: () => {
      if (groupId) navigation?.navigate?.('Arrive', { groupId });
    },
  });
  const stale = staleRider(riders, userId);
  const status = liveStatus({
    own,
    others,
    signalLost: networkBanner === 'lost',
    sosFrom,
    hazard: flow.hazard,
    signal: flow.signal,
    stop: flow.stop,
    staleRider: stale ? { name: nameOf(stale.riderId), ageS: stale.ageS } : null,
    nameOf,
    units,
  });
  const sosRiderIds = useMemo(() => sosEvents.filter((e) => !e.resolved).map((e) => e.rider_id), [sosEvents]);
  const sosActive = sosEvents.some((e) => e.isSender && !e.resolved);
  const speedKmh = lastValidLocation && Number.isFinite(lastValidLocation.speed_mps) ? Math.max(0, lastValidLocation.speed_mps * 3.6) : null;
  const etaClock = route && Number.isFinite(route.eta_minutes) ? clockAfter(route.eta_minutes) : null;
  const remainingKm = route && Number.isFinite(route.distance_km) ? route.distance_km : null;
  const toLabel = planDestination?.label?.split(',')[0] ?? null;
  const ctlH = layout.controlH;
  const controlsBottom = layout.controlsBottom;

  // Recorder events that start on a transition: a gap opening (> 500 m spread) — once per gap.
  const gapOpen = own != null && others.length > 0 && groupSpreadM([own, ...others.map((r) => r.location)]) > GAP_EVENT_M;
  const gapWas = useRef(false);
  useEffect(() => {
    if (gapOpen && !gapWas.current) rideRecorder.addEvent('gap', status.key === 'gap' ? (status.subtitle ?? 'Gap opened') : 'Gap opened');
    gapWas.current = gapOpen;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the edge is what matters
  }, [gapOpen]);

  // Tapping the plate: the useful next step for what it says.
  const onPlateTap = useCallback(() => {
    switch (status.key) {
      case 'gap':
        setSignalOpen(true);
        break;
      case 'stop-ahead':
        if (groupId && flow.stop) {
          markStopVisited(groupId, flow.stop.id);
          navigation?.navigate?.('Stop', { groupId, stopId: flow.stop.id });
        }
        break;
      case 'together':
        push('Everyone is within 600 m. We alert you past that', 'info');
        break;
      case 'sos':
        break;
      default:
        showGroup();
    }
  }, [status.key, groupId, flow.stop, navigation, push, showGroup]);

  // Explicit empty state: no demo-group fallback. All hooks above run
  // unconditionally, so this early return is hook-safe.
  if (!groupId) {
    return (
      <View style={styles.noGroup}>
        <Text style={styles.noGroupTitle}>No ride selected</Text>
        <Text style={styles.noGroupSub}>
          Join or create a group ride to see the live map.
        </Text>
      </View>
    );
  }

  const topInset = Math.max(topH, insets.top + layout.topChromeH - HEADER_PAD) + HEADER_PAD;

  return (
    <View style={styles.container}>
      {/* Layer 0 — Map */}
      <MapboxGL.MapView
        style={styles.map}
        styleURL={scheme === 'dark' ? MapboxGL.StyleURL.Dark : MapboxGL.StyleURL.Light}
        scaleBarEnabled={false}
        onDidFinishLoadingMap={() => setMapReady(true)}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          followUserLocation={following && !groupView}
          followUserMode={MapboxGL.UserTrackingMode.FollowWithHeading}
          followZoomLevel={FOLLOW_ZOOM}
          onUserTrackingModeChange={(e) => {
            // The rider dragged the map out of follow mode: leave the camera
            // where they put it instead of snapping back to the route.
            if (!e.nativeEvent.payload.followUserLocation) {
              markFitted();
              setFollowPref(false);
            }
          }}
        />
        {/* The system puck only until our own avatar (below) has a fix to sit on. */}
        <MapboxGL.UserLocation showsUserHeadingIndicator visible={!lastValidLocation} />
        {/* Layer 1 — map overlays */}
        <RiderMarkerOverlay groupId={groupId} sosRiderIds={sosRiderIds} />
        <HazardOverlayMapLayer groupId={groupId} onHazardPress={setSelectedHazard} />
        <SosOverlayMapLayer groupId={groupId} userId={userId ?? undefined} onSosEventsChange={onSosEventsChange} />
        <RouteOverlay groupId={groupId} />
        {/* Own avatar, with the live distance label to its right. */}
        {lastValidLocation ? (
          <MapboxGL.MarkerView
            id="own-avatar"
            coordinate={[lastValidLocation.lng, lastValidLocation.lat]}
            anchor={{ x: 0.5, y: 0.5 }}
            allowOverlap
          >
            <LiveAvatar label={gapLabel} talking={voice.talking} />
          </MapboxGL.MarkerView>
        ) : null}
      </MapboxGL.MapView>

      <Vignettes />

      {/* Layer 2 — floating UI */}

      {/* Header row + the one status plate */}
      <View
        style={[styles.top, { paddingTop: insets.top + HEADER_PAD, paddingHorizontal: hudX }]}
        pointerEvents="box-none"
        onLayout={(e) => setTopH(Math.round(e.nativeEvent.layout.height))}
      >
        <View style={styles.headerRow}>
          {navigation ? (
            <PressableScale
              style={styles.iconBtn}
              onPress={goToRides}
              haptic="tap"
              accessibilityLabel="Back to rides"
              accessibilityRole="button"
            >
              <Icon name="back" size={22} color={road.ink} />
            </PressableScale>
          ) : null}
          <View style={styles.titleBox}>
            <Text style={styles.title} numberOfLines={1}>
              {ride?.name ?? rideName ?? groupId.slice(0, 8)}
            </Text>
            <FlStatusOverlay />
          </View>
          <LivePill variant={connected ? 'live' : 'grey'} />
        </View>
        <View style={{ marginTop: HEADER_PAD }}>
          {voice.talking ? (
            <TalkPlate />
          ) : flow.confirm ? (
            <HazardConfirmButtons onAnswer={flow.answerConfirm} name={hazardName(flow.confirm.cluster.hazard_type)} />
          ) : (
            <Plate
              key={status.key}
              testID="status-plate"
              tone={status.tone}
              icon={status.icon}
              title={status.title}
              subtitle={status.subtitle}
              titleSize={status.title.length > 17 ? 23 : 28}
              style={{ minHeight: layout.plateH }}
              onPress={onPlateTap}
            />
          )}
        </View>
      </View>

      {/* Network banner */}
      {networkBanner && (
        <View style={[styles.bannerWrap, { top: topInset }]}>
          <NetworkBanner
            state={networkBanner}
            riderName={userId ? `Rider ${userId.slice(-4)}` : 'A rider'}
            onDismiss={() => setNetworkBanner(null)}
          />
        </View>
      )}

      {/* Toasts: below the plate (and below the banner when it is up) */}
      <ToastContainer top={topInset + (networkBanner ? NETWORK_BANNER_H : 0)} />

      {/* Side buttons: group view, follow/fit. Route details + Google Maps live behind the speed / ETA cluster. */}
      <View style={[styles.sideColumn, { top: topInset + layout.sideGap, right: hudX, gap: layout.sideGap }]} pointerEvents="box-none">
        <SideButton icon="group" label="GROUP" active={groupView} onPress={showGroup} accessibilityLabel="Show the whole group" testID="side-group" />
        <SideButton
          icon={following ? 'gps' : 'target'}
          label={following ? 'FOLLOW' : 'FIT'}
          active={following}
          onPress={toggleFollow}
          accessibilityLabel={following ? 'Show the whole route' : 'Follow my location'}
          testID="side-follow"
        />
      </View>

      {/* Info cards (hazard / SOS / rider) sit above the controls */}
      <View style={[styles.bottom, { bottom: controlsBottom + ctlH + 12 }]} pointerEvents="box-none">
        <ScrollView
          style={{ maxHeight: layout.infoCardsMaxH, marginHorizontal: layout.sideMargin }}
          contentContainerStyle={{ paddingRight: layout.sideColumnW - layout.gutter }}
          pointerEvents="box-none"
        >
          {selectedHazard ? (
            <HazardOverlayInfoCard
              selectedCluster={selectedHazard}
              onDismiss={() => setSelectedHazard(null)}
              onResolve={async (clusterId: string) => {
                try {
                  await resolveHazard(clusterId);
                  setSelectedHazard(null);
                  push('Hazard resolved');
                } catch {
                  push('Failed to resolve hazard', 'error');
                }
              }}
            />
          ) : null}
          <SosOverlayInfoCards
            sosEvents={sosEvents}
            userId={userId ?? ''}
            onResolve={handleResolveSos}
            onNavigate={(lat, lng) => {
              Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`).catch(
                () => push('Could not open Google Maps', 'warn'),
              );
            }}
          />
          <RiderInfoCard />
        </ScrollView>
      </View>

      {/* Speed, ETA, distance left — tap for route details */}
      <View style={{ position: 'absolute', left: layout.sideMargin, right: layout.sideMargin, bottom: controlsBottom + ctlH + 8, zIndex: 20 }} pointerEvents="box-none">
        <SpeedCluster
          speedKmh={speedKmh}
          etaClock={etaClock}
          remainingKm={remainingKm}
          toLabel={toLabel}
          onPress={() => setRouteOpen(true)}
          units={units}
          glove={glove}
        />
      </View>

      {/* Control keys: SOS (hold) ∙ Signal ∙ Hazard ∙ Talk (hold) */}
      <View style={[styles.controls, { alignItems: 'flex-end', left: hudX, right: hudX, bottom: controlsBottom }]}>
        <View style={{ height: ctlH, justifyContent: 'center' }}>
          <SosFab
            width={layout.sosKeyW}
            height={ctlH}
            onHoldComplete={() => {
              rideRecorder.addEvent('sos', 'SOS sent');
              triggerSosFlow(groupId).catch((e: unknown) => warn('[MapScreen] triggerSosFlow failed:', e));
            }}
            disabled={sosActive}
          />
        </View>
        <ControlKey icon="signal" label="Signal" glove={glove} onPress={() => setSignalOpen(true)} accessibilityLabel="Send a quick signal" testID="key-signal" />
        <ControlKey icon="haz" label="Hazard" glove={glove} onPress={() => setHazardOpen(true)} accessibilityLabel="Report a hazard" testID="key-hazard" />
        <ControlKey
          icon="mic"
          label="Talk"
          glove={glove}
          active={voice.talking}
          onPressIn={onTalkIn}
          onPressOut={onTalkOut}
          accessibilityLabel="Talk to the crew"
          accessibilityHint="Press and hold to talk, release to stop"
          testID="key-talk"
        />
      </View>

      {/* Sheets */}
      <SignalSheet
        visible={signalOpen}
        groupId={groupId}
        riderId={userId ?? ''}
        onSend={() => {
          setSignalOpen(false);
          rideRecorder.countSignal();
        }}
        onClose={() => setSignalOpen(false)}
      />
      <HazardSheet
        visible={hazardOpen}
        onClose={() => setHazardOpen(false)}
        groupId={groupId}
        riderId={userId}
        location={lastValidLocation}
        onReported={(type) => {
          rideRecorder.countHazard();
          rideRecorder.addEvent('hazard', `Reported ${hazardName(type).toLowerCase()}`);
        }}
      />
      <RouteSheet
        visible={routeOpen}
        onClose={() => setRouteOpen(false)}
        avoidHazards={avoidHazardTypes.length > 0}
        onToggleAvoidHazards={() => {
          const toggle = getToggleAvoidHazards();
          if (toggle) {
            toggle();
          } else {
            push('Route not ready yet', 'warn');
          }
        }}
        onOpenInGoogleMaps={openGoogleMaps}
      />
    </View>
  );
}
