/**
 * Live Map (core screen) — redesigned per master spec §3.3.
 * Layer 0: Mapbox map (dark style)
 * Layer 1: map overlays (riders, hazards, SOS, route line)
 * Layer 2: floating UI — one header bar (back, ride name, live pill), toasts,
 *          banners, FAB column (recenter / nav / signal / SOS), signal menu,
 *          bottom sheet, info cards, SOS modal.
 *
 * Person A/B/C/D functionality fully preserved:
 *  - TrackingService lifecycle (Person A)
 *  - Hazard/SOS Firestore subscriptions (Person B)
 *  - RoutingClient + route store (Person C)
 *  - VoxClient untouched — Voice tab owns voice now (Person D)
 */
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Text, Linking, Pressable, ScrollView } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAPBOX_TOKEN } from '@env';
import RiderMarkerOverlay, { RiderInfoCard } from './overlays/RiderMarkerOverlay';
import { HazardOverlayMapLayer, HazardOverlayInfoCard } from './overlays/HazardOverlay';
import { SosOverlayMapLayer, SosOverlayInfoCards, ActiveSos } from './overlays/SosOverlay';
import RouteOverlay from './overlays/RouteOverlay';
import FlStatusOverlay from './overlays/FlStatusOverlay';
import { useAppStore } from '../../store/appStore';
import { useRidersStore } from '../../store/ridersStore';
import { useRouteStore } from '@routing/client/routeStore';
import { useToastStore } from '../../store/toastStore';
import { WeRideColors, WeRideRadius } from '../../theme/theme';
import { type } from '../../theme/typography';
import { getToggleAvoidHazards } from './overlays/routeControls';
import LivePill from '../../components/LivePill';
import ToastContainer from '../../components/ToastContainer';
import NetworkBanner from '../../components/NetworkBanner';
import SignalMenu from '../../components/SignalMenu';
import RoutePanel from '../../components/RoutePanel';
import { COLLAPSED_HEIGHT as ROUTE_PANEL_COLLAPSED_H } from '../../components/routePanelState';
import SosModal from '../../components/SosModal';
import Fab, { FAB_SIZE } from '../../components/Fab';
import NavFab from '../../components/NavFab';
import SosFab from '../../components/SosFab';
import { googleMapsDeepLink } from '@routing/client/deepLink';
import { GroupService } from '@routing/group/groupService';
import { resolveSos } from '@hazard/services/sosService';
import { resolveHazard } from '@hazard/services/hazardService';
import { useRidePlanStore } from '../../store/ridePlanStore';
import { useStopsStore } from '../../store/stopsStore';
import { fitPadding } from '../../utils/mapFit';
import { fitPointsFor, fitSignature } from './rideGeometry';
import { useRouteFit } from './useRouteFit';
import { ROUTE_COLOR } from './mapStyle';

// Phase 6 — tracking service wiring (Person A, unchanged)
import { Ekf } from '@tracking/ekf';
import { SensorStream } from '@tracking/sensorStream';
import { OwnLocationPublisher, isUsableOwnFix } from '../../services/ownLocationPublisher';
import { TrackingService } from '@tracking/trackingService';
import { loadHlc } from '@tracking/hlcStore';
import { getLocationSocket } from '../../services/socketService';

MapboxGL.setAccessToken(MAPBOX_TOKEN ?? '');

// Floating-UI footprint the route must stay clear of when the camera frames it.
// Single source of truth: the header, FAB column and sheet below are all laid
// out from these numbers.
const GUTTER = 16;                                    // screen side gutter
const HEADER_PAD = 8;                                 // gap above / below the header bar
const HEADER_BAR_H = 52;                              // header bar (back chip, ride name, live pill)
const HEADER_CONTENT_H = HEADER_PAD + HEADER_BAR_H + HEADER_PAD; // below the status-bar inset
const FAB_GAP = 12;
const FAB_COLUMN_W = FAB_SIZE + GUTTER;               // FAB + right gutter
const SHEET_COLLAPSED_H = ROUTE_PANEL_COLLAPSED_H;    // RoutePanel collapsed height
const FAB_COLUMN_BOTTOM = SHEET_COLLAPSED_H + GUTTER; // FAB column sits above the collapsed sheet
const NETWORK_BANNER_H = 64;                          // reserved height of the banner (toasts stack below it)
const FOLLOW_ZOOM = 16;

/** Minimal slice of the tab navigator's `navigation` prop that MapScreen uses. */
export interface MapScreenNavigation {
  goBack: () => void;
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

  // Camera: frame the route (Google Maps style); follow the rider only on request.
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const [mapReady, setMapReady] = useState(false);
  const planStart = useRidePlanStore((s) => s.start);
  const planStops = useRidePlanStore((s) => s.stops);
  const planDestination = useRidePlanStore((s) => s.destination);
  // null = automatic (follow only when there is nothing to frame), else rider's choice.
  const [followPref, setFollowPref] = useState<boolean | null>(null);

  // UI state
  const [signalMenuOpen, setSignalMenuOpen] = useState(false);
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [sosEvents, setSosEvents] = useState<ActiveSos[]>([]);
  const [selectedHazard, setSelectedHazard] = useState<any>(null);
  const [networkBanner, setNetworkBanner] = useState<'lost' | 'recovered' | null>(null);
  const [sosActive, setSosActive] = useState(false);
  // Ride name for the header (demo shows "Lonavala Loop", not the group ID).
  const [rideName, setRideName] = useState<string | null>(null);

  const prevConnectedRef = useRef<boolean | null>(null);

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
        if (group?.name) setRideName(group.name);
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

  // Network banner state transitions (spec §3.3.5, FLOW 12)
  useEffect(() => {
    if (prevConnectedRef.current === null) {
      prevConnectedRef.current = connected;
      return;
    }
    if (prevConnectedRef.current && !connected) {
      setNetworkBanner('lost');
    } else if (!prevConnectedRef.current && connected) {
      setNetworkBanner('recovered');
    }
    prevConnectedRef.current = connected;
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
        headerHeight: insets.top + HEADER_CONTENT_H,
        fabColumnWidth: FAB_COLUMN_W,
        sheetHeight: SHEET_COLLAPSED_H,
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

  return (
    <View style={styles.container}>
      {/* Layer 0 — Map */}
      <MapboxGL.MapView
        style={styles.map}
        styleURL={MapboxGL.StyleURL.Dark}
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
        <MapboxGL.UserLocation showsUserHeadingIndicator />
        {/* Layer 1 — map overlays */}
        <RiderMarkerOverlay groupId={groupId} />
        <HazardOverlayMapLayer groupId={groupId} onHazardPress={setSelectedHazard} />
        <SosOverlayMapLayer groupId={groupId} userId={userId ?? undefined} onSosEventsChange={onSosEventsChange} />
        <RouteOverlay groupId={groupId} />
      </MapboxGL.MapView>

      {/* Layer 2 — floating UI */}

      {/* 3.3.1 Screen header: one bar — back, ride name + FL/privacy line, live pill */}
      <View
        style={[styles.header, { paddingTop: insets.top + HEADER_PAD, paddingBottom: HEADER_PAD }]}
        pointerEvents="box-none"
      >
        <View style={[styles.headerBar, navigation ? styles.headerBarWithBack : null]}>
          {navigation ? (
            <Pressable
              style={styles.backBtn}
              onPress={goToRides}
              accessibilityLabel="Back to rides"
              accessibilityRole="button"
            >
              <Text style={styles.backText}>‹ Rides</Text>
            </Pressable>
          ) : null}
          <View style={styles.headerTitles}>
            <Text style={styles.title} numberOfLines={1}>
              {rideName ?? groupId.slice(0, 8)}
            </Text>
            <FlStatusOverlay />
          </View>
          <LivePill variant={connected ? 'live' : 'grey'} />
        </View>
      </View>

      {/* 3.3.5 Network banner */}
      {networkBanner && (
        <View style={[styles.bannerWrap, { top: insets.top + HEADER_CONTENT_H }]}>
          <NetworkBanner
            state={networkBanner}
            riderName={userId ? `Rider ${userId.slice(-4)}` : 'A rider'}
            onDismiss={() => setNetworkBanner(null)}
          />
        </View>
      )}

      {/* 3.3.3 Toasts: below the header (and below the banner when it is up) */}
      <ToastContainer
        top={insets.top + HEADER_CONTENT_H + (networkBanner ? NETWORK_BANNER_H : 0)}
      />

      {/* 3.3.7 Signal menu: opens beside the signal FAB */}
      <SignalMenu
        visible={signalMenuOpen}
        groupId={groupId}
        riderId={userId ?? ''}
        onSend={() => setSignalMenuOpen(false)}
        right={FAB_COLUMN_W + FAB_GAP}
        bottom={FAB_COLUMN_BOTTOM + FAB_SIZE + FAB_GAP}
      />

      {/* 3.3.6 FAB column */}
      <View style={styles.fabColumn}>
        <Fab
          onPress={toggleFollow}
          active={following}
          accessibilityLabel={following ? 'Show the whole route' : 'Follow my location'}
          accessibilityRole="button"
        >
          <View style={[styles.locateRing, following && styles.locateRingOn]}>
            <View style={[styles.locateDot, following && styles.locateDotOn]} />
          </View>
        </Fab>
        <NavFab onPress={openGoogleMaps} />
        <Fab
          onPress={() => setSignalMenuOpen((v) => !v)}
          active={signalMenuOpen}
          accessibilityLabel="Send a quick signal"
          accessibilityRole="button"
        >
          <View style={styles.bubble}>
            <View style={styles.bubbleDot} />
            <View style={styles.bubbleDot} />
            <View style={styles.bubbleDot} />
          </View>
        </Fab>
        <SosFab
          onHoldComplete={() => setSosModalOpen(true)}
          disabled={sosActive}
        />
      </View>

      {/* Bottom stack: info cards, SOS info cards, bottom sheet */}
      <View style={styles.bottomStack} pointerEvents="box-none">
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

        <View pointerEvents="box-none">
          <RoutePanel
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
      </View>

      {/* 3.3.11 SOS modal */}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: WeRideColors.dark },
  map: { flex: 1 },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: GUTTER,
    zIndex: 10,
  },
  headerBar: {
    height: HEADER_BAR_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: GUTTER,
    backgroundColor: '#111111F2',
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: WeRideRadius.xxl,
  },
  headerBarWithBack: { paddingLeft: 4 },
  backBtn: {
    minWidth: 44,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: WeRideRadius.xl,
    backgroundColor: WeRideColors.dark3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { ...type.bodyStrong },
  headerTitles: { flex: 1, justifyContent: 'center' },
  title: { ...type.titleSm },
  bannerWrap: { position: 'absolute', left: 0, right: 0, zIndex: 20 },
  noGroup: {
    flex: 1,
    backgroundColor: WeRideColors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  noGroupTitle: { ...type.titleSm },
  noGroupSub: { ...type.body, color: WeRideColors.textSub, textAlign: 'center' },
  fabColumn: {
    position: 'absolute',
    right: GUTTER,
    bottom: FAB_COLUMN_BOTTOM, // clear of the collapsed route sheet
    gap: FAB_GAP,
    zIndex: 30,
  },
  locateRing: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: WeRideColors.text,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locateRingOn: { borderColor: ROUTE_COLOR },
  locateDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: WeRideColors.text },
  locateDotOn: { backgroundColor: ROUTE_COLOR },
  bubble: {
    width: 24,
    height: 18,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: WeRideColors.text,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  bubbleDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: WeRideColors.text },
  bottomStack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 25,
  },
  infoCardsScroll: { maxHeight: 220 },
  // Cards keep their own 16 px side margin; the extra right padding keeps them
  // clear of the FAB column (FAB width + gap, minus the card's own margin).
  infoCardsContent: { paddingRight: FAB_COLUMN_W + FAB_GAP - GUTTER },
});
