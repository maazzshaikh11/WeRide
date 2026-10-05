/**
 * Live Ride screen — demo.html "Road mode", on a real Mapbox map.
 * Layer 0: Mapbox map (dark/light by theme)
 * Layer 1: map overlays (riders, hazards, SOS, route line) + the rider's own avatar,
 *          with a small floating distance label pinned to its RIGHT (distance to the
 *          nearest live crew member, from real verified fixes — nothing simulated)
 * Layer 2: floating UI — header (back, ride name, live pill), one status plate
 *          ("is the group OK?"), side buttons (follow/fit, Google Maps, route details),
 *          speed + ETA cluster, and the control keys (SOS hold, Signal, Hazard, Talk).
 *          Signal / Hazard / Route open as sheets.
 *
 * There is no separate crew-ahead/behind panel: the readout belongs next to the avatar.
 *
 * Person A/B/C/D functionality fully preserved:
 *  - TrackingService lifecycle (Person A)
 *  - Hazard/SOS Firestore subscriptions (Person B)
 *  - RoutingClient + route store (Person C)
 *  - VoxClient untouched — Voice tab owns voice now (Person D); Talk opens it
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
import SosModal from '../../components/SosModal';
import SosFab from '../../components/SosFab';
import { googleMapsDeepLink } from '@routing/client/deepLink';
import { GroupService } from '@routing/group/groupService';
import { resolveSos } from '@hazard/services/sosService';
import { resolveHazard } from '@hazard/services/hazardService';
import { useRidePlanStore } from '../../store/ridePlanStore';
import { useStopsStore } from '../../store/stopsStore';
import { Icon, PressableScale } from '../../ui';
import { fitPadding } from '../../utils/mapFit';
import { nextNetworkBanner, NetworkTracker } from '../../utils/networkBanner';
import { fitPointsFor, fitSignature } from './rideGeometry';
import { useRouteFit } from './useRouteFit';
import LiveAvatar from './live/LiveAvatar';
import { ControlKey, CONTROL_GAP, CONTROL_H, SIDE_BTN, SideButton, SpeedCluster, Vignettes, clockAfter } from './live/LiveChrome';
import { formatGap, freshRiders, liveStatus, nearestRider } from './live/liveGeometry';

// Phase 6 — tracking service wiring (Person A, unchanged)
import { Ekf } from '@tracking/ekf';
import { SensorStream } from '@tracking/sensorStream';
import { OwnLocationPublisher, isUsableOwnFix } from '../../services/ownLocationPublisher';
import { TrackingService } from '@tracking/trackingService';
import { loadHlc } from '@tracking/hlcStore';
import { getLocationSocket } from '../../services/socketService';

MapboxGL.setAccessToken(MAPBOX_TOKEN ?? '');

// Floating-UI footprint the route must stay clear of when the camera frames it.
// Single source of truth: the header, status plate, side buttons, cluster and
// controls below are all laid out from these numbers.
const GUTTER = 14;                                    // screen side gutter (demo: 14)
const HEADER_PAD = 8;                                 // gap above / below the header row
const HEADER_BAR_H = 44;                              // back chip / title / live pill row
const PLATE_H = 82;                                   // status plate (demo min-height 82)
const TOP_CHROME_H = HEADER_PAD + HEADER_BAR_H + HEADER_PAD + PLATE_H + HEADER_PAD; // below the status-bar inset
const SIDE_COLUMN_W = SIDE_BTN + GUTTER;              // side buttons + right gutter
const CLUSTER_H = 132;                                // speed / ETA cluster
const CONTROLS_BOTTOM = 16;                           // controls sit this far above the tab bar
const BOTTOM_CHROME_H = CONTROLS_BOTTOM + CONTROL_H + CLUSTER_H + 8;
const SIDE_GAP = 12;
const NETWORK_BANNER_H = 64;                          // reserved height of the banner (toasts stack below it)
const FOLLOW_ZOOM = 16;

/** Minimal slice of the tab navigator's `navigation` prop that MapScreen uses. */
export interface MapScreenNavigation {
  goBack: () => void;
  navigate?: (name: string) => void;
  getParent?: () => { goBack: () => void } | undefined;
}

interface MapScreenProps {
  navigation?: MapScreenNavigation;
}

export default function MapScreen({ navigation }: MapScreenProps = {}) {
  // No demo fallback: without a real group there is nothing to track.
  // The component renders a "no group selected" placeholder instead.
  const groupId = useAppStore((s) => s.groupId);
  const userId = useAppStore((s) => s.userId);
  const riders = useRidersStore((s) => s.riders);
  const connected = useRidersStore((s) => s.connected);
  const lastValidLocation = useRouteStore((s) => s.lastValidLocation);
  const route = useRouteStore((s) => s.route);
  const avoidHazardTypes = useRouteStore((s) => s.avoidHazardTypes);
  const push = useToastStore((s) => s.push);
  const insets = useSafeAreaInsets();
  const { road, scheme } = useTheme();
  const styles = useStyles(({ road: r, roadType: t }) => ({
    container: { flex: 1, backgroundColor: r.bg },
    map: { flex: 1 },
    top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: GUTTER, zIndex: 10 },
    headerRow: { height: HEADER_BAR_H, flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: r.card, borderWidth: 1.5, borderColor: r.line, alignItems: 'center', justifyContent: 'center' },
    titleBox: { flex: 1, minWidth: 0, justifyContent: 'center', paddingHorizontal: 12, height: 44, borderRadius: 14, backgroundColor: r.card, borderWidth: 1.5, borderColor: r.line },
    title: { ...t.h3, fontSize: 16, lineHeight: 20 },
    bannerWrap: { position: 'absolute', left: 0, right: 0, zIndex: 20 },
    sideColumn: { position: 'absolute', right: GUTTER, gap: SIDE_GAP, zIndex: 30 },
    bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 25 },
    infoCardsScroll: { maxHeight: 220 },
    infoCardsContent: { paddingRight: SIDE_COLUMN_W - GUTTER },
    controls: { position: 'absolute', left: GUTTER, right: GUTTER, bottom: CONTROLS_BOTTOM, flexDirection: 'row', gap: CONTROL_GAP, zIndex: 25 },
    noGroup: { flex: 1, backgroundColor: r.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
    noGroupTitle: { ...t.h2 },
    noGroupSub: { ...t.body, textAlign: 'center' },
  }));
  const [signalOpen, setSignalOpen] = useState(false);
  const [hazardOpen, setHazardOpen] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);

  // Camera: frame the route (Google Maps style); follow the rider only on request.
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const [mapReady, setMapReady] = useState(false);
  const planStart = useRidePlanStore((s) => s.start);
  const planStops = useRidePlanStore((s) => s.stops);
  const planDestination = useRidePlanStore((s) => s.destination);
  // null = automatic (follow only when there is nothing to frame), else rider's choice.
  const [followPref, setFollowPref] = useState<boolean | null>(null);

  // UI state
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [sosEvents, setSosEvents] = useState<ActiveSos[]>([]);
  const [selectedHazard, setSelectedHazard] = useState<any>(null);
  const [networkBanner, setNetworkBanner] = useState<'lost' | 'recovered' | null>(null);
  const [sosActive, setSosActive] = useState(false);
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
        if (!isUsableOwnFix(fix)) return;
        const routeState = useRouteStore.getState();
        routeState.setCurrentLocation(fix);
        routeState.setLastValidLocation(fix);
      },
    );

    const service = new TrackingService({ ekf, sensors, publisher, hlc });
    serviceRef.current = service;

    // Prefer background tracking; fall back to foreground when the native
    // background module is unavailable (permissions, platform limits).
    service.start(true).then((started) => {
      if (started) return;
      console.warn('[MapScreen] Background tracking unavailable; falling back to foreground.');
      push('Background location unavailable — using foreground tracking', 'warn');
      return service.start(false).then((fgStarted) => {
        if (!fgStarted) {
          console.error('[MapScreen] TrackingService.start failed (foreground too).');
          push('Could not start location tracking', 'error');
        }
      });
    }).catch((err: unknown) => {
      console.error('[MapScreen] TrackingService.start failed:', err);
    });

    // Subscribe riders store to location updates (other riders' markers).
    useRidersStore.getState().subscribe(groupId);

    // Seed other riders' last-known positions so the map is not empty on join.
    publisher
      .fetchGroupLastKnown(groupId)
      .then((docs) => useRidersStore.getState().seedRiders(docs))
      .catch((e: unknown) => {
        console.warn('[MapScreen] Rider seed failed:', e);
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
        console.warn('[MapScreen] Group name load failed:', e);
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
        console.warn('[MapScreen] Ride plan load failed:', e);
      });

    return () => {
      service.stop().catch((err: unknown) => {
        console.error('[MapScreen] TrackingService.stop failed:', err);
      });
      serviceRef.current = null;
      useRidersStore.getState().unsubscribe();
    };
  }, [userId, groupId]);

  // Quick signals from the rest of the group (server relays as signal:received).
  useEffect(() => {
    if (!groupId) return;
    const socket = getLocationSocket();
    const onSignal = (p: { group_id?: string; rider_id?: string; label?: string }) => {
      if (!p || p.group_id !== groupId || p.rider_id === userId || !p.label) return;
      push(`Rider ${String(p.rider_id ?? '').slice(-4)}: ${p.label}`, 'warn');
    };
    socket.on('signal:received', onSignal);
    return () => {
      socket.off('signal:received', onSignal);
    };
  }, [groupId, userId, push]);

  // Network banner: only after the socket was actually up and then dropped
  // (the first connect after mount is not a recovery).
  useEffect(() => {
    const { tracker, banner } = nextNetworkBanner(networkRef.current, connected);
    networkRef.current = tracker;
    if (banner) setNetworkBanner(banner);
  }, [connected]);

  const riderCount = riders.size;

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
        headerHeight: insets.top + TOP_CHROME_H,
        fabColumnWidth: SIDE_COLUMN_W,
        sheetHeight: BOTTOM_CHROME_H,
      }),
    [insets.top],
  );
  const { markFitted } = useRouteFit({
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

  const handleSosSent = useCallback(() => {
    setSosModalOpen(false);
    setSosActive(true);
  }, []);

  const handleResolveSos = useCallback(async (sosId: string) => {
    if (!groupId) return;
    try {
      await resolveSos(sosId, groupId);
      setSosActive(false);
      push('SOS cancelled');
    } catch (e) {
      console.error('[MapScreen] resolveSos failed:', e);
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
    } else {
      navigation?.goBack();
    }
  }, [navigation]);

  // ---- live values: all from real data; null/empty when there is nothing to show ----
  const others = useMemo(() => freshRiders(riders, userId), [riders, userId]);
  const own = lastValidLocation ? { lat: lastValidLocation.lat, lng: lastValidLocation.lng } : null;
  const nearest = nearestRider(own, others);
  const gapLabel = nearest ? formatGap(nearest.distanceM) : null;
  const sosFrom = sosEvents.find((e) => !e.resolved && !e.isSender)?.rider_id ?? null;
  const status = liveStatus({ own, others, signalLost: networkBanner === 'lost', sosFrom });
  const speedKmh = lastValidLocation && Number.isFinite(lastValidLocation.speed_mps) ? Math.max(0, lastValidLocation.speed_mps * 3.6) : null;
  const etaClock = route && Number.isFinite(route.eta_minutes) ? clockAfter(route.eta_minutes) : null;
  const remainingKm = route && Number.isFinite(route.distance_km) ? route.distance_km : null;
  const toLabel = planDestination?.label?.split(',')[0] ?? null;

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

  const topInset = insets.top + TOP_CHROME_H;

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
          followUserLocation={following}
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
        <RiderMarkerOverlay groupId={groupId} />
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
            <LiveAvatar label={gapLabel} />
          </MapboxGL.MarkerView>
        ) : null}
      </MapboxGL.MapView>

      <Vignettes />

      {/* Layer 2 — floating UI */}

      {/* Header row + the one status plate */}
      <View style={[styles.top, { paddingTop: insets.top + HEADER_PAD }]} pointerEvents="box-none">
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
              {rideName ?? groupId.slice(0, 8)}
            </Text>
            <FlStatusOverlay />
          </View>
          <LivePill variant={connected ? 'live' : 'grey'} />
        </View>
        <View style={{ marginTop: HEADER_PAD }}>
          <Plate
            key={status.key}
            testID="status-plate"
            tone={status.tone}
            icon={status.icon}
            title={status.title}
            subtitle={status.subtitle}
            titleSize={status.title.length > 17 ? 23 : 28}
            style={{ minHeight: PLATE_H }}
          />
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

      {/* Side buttons: follow/fit, Google Maps, route details */}
      <View style={[styles.sideColumn, { top: topInset + SIDE_GAP }]} pointerEvents="box-none">
        <SideButton
          icon={following ? 'gps' : 'target'}
          label={following ? 'FOLLOW' : 'FIT'}
          active={following}
          onPress={toggleFollow}
          accessibilityLabel={following ? 'Show the whole route' : 'Follow my location'}
          testID="side-follow"
        />
        <SideButton icon="nav" label="MAPS" onPress={openGoogleMaps} accessibilityLabel="Open route in Google Maps" testID="side-maps" />
        <SideButton icon="route" label="ROUTE" onPress={() => setRouteOpen(true)} accessibilityLabel="Route details" testID="side-route" />
      </View>

      {/* Info cards (hazard / SOS / rider) sit above the controls */}
      <View style={[styles.bottom, { bottom: CONTROLS_BOTTOM + CONTROL_H + 12 }]} pointerEvents="box-none">
        <ScrollView
          style={styles.infoCardsScroll}
          contentContainerStyle={styles.infoCardsContent}
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
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: CONTROLS_BOTTOM + CONTROL_H + 8, zIndex: 20 }} pointerEvents="box-none">
        <SpeedCluster
          speedKmh={speedKmh}
          etaClock={etaClock}
          remainingKm={remainingKm}
          toLabel={toLabel}
          onPress={() => setRouteOpen(true)}
        />
      </View>

      {/* Control keys: SOS (hold) · Signal · Hazard · Talk */}
      <View style={styles.controls}>
        <SosFab onHoldComplete={() => setSosModalOpen(true)} disabled={sosActive} />
        <ControlKey icon="signal" label="Signal" onPress={() => setSignalOpen(true)} accessibilityLabel="Send a quick signal" testID="key-signal" />
        <ControlKey icon="haz" label="Hazard" onPress={() => setHazardOpen(true)} accessibilityLabel="Report a hazard" testID="key-hazard" />
        <ControlKey icon="mic" label="Talk" onPress={() => navigation?.navigate?.('Voice')} accessibilityLabel="Talk to the crew" testID="key-talk" />
      </View>

      {/* Sheets */}
      <SignalSheet
        visible={signalOpen}
        groupId={groupId}
        riderId={userId ?? ''}
        onSend={() => setSignalOpen(false)}
        onClose={() => setSignalOpen(false)}
      />
      <HazardSheet
        visible={hazardOpen}
        onClose={() => setHazardOpen(false)}
        groupId={groupId}
        riderId={userId}
        location={lastValidLocation}
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

      {/* SOS modal */}
      <SosModal
        visible={sosModalOpen}
        riderId={userId ?? ''}
        groupId={groupId}
        riderCount={Math.max(riderCount, 1)}
        location={
          lastValidLocation
            ? { lat: lastValidLocation.lat, lng: lastValidLocation.lng }
            : lastAnyFixRef.current
        }
        onCancel={() => setSosModalOpen(false)}
        onSent={handleSosSent}
      />
    </View>
  );
}
