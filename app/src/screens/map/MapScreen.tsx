/**
 * Live Map (core screen) — redesigned per master spec §3.3.
 * Layer 0: Mapbox map (dark style)
 * Layer 1: map overlays (riders, hazards, SOS, route line)
 * Layer 2: floating UI — header w/ live pill, FL badge, toasts, banners,
 *          FAB column (nav / signal / SOS), signal menu, bottom sheet,
 *          nav hint, info cards, SOS modal.
 *
 * Person A/B/C/D functionality fully preserved:
 *  - TrackingService lifecycle (Person A)
 *  - Hazard/SOS Firestore subscriptions (Person B)
 *  - RoutingClient + route store (Person C)
 *  - VoxClient untouched — Voice tab owns voice now (Person D)
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Text, Linking, Pressable, ScrollView } from 'react-native';
import MapboxGL from '@rnmapbox/maps';

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
import { WeRideColors, WeRideFonts } from '../../theme/theme';
import { getToggleAvoidHazards } from './overlays/routeControls';
import LivePill from '../../components/LivePill';
import ToastContainer from '../../components/ToastContainer';
import NetworkBanner from '../../components/NetworkBanner';
import FuelBanner from '../../components/FuelBanner';
import SignalMenu from '../../components/SignalMenu';
import NavHint from '../../components/NavHint';
import RoutePanel from '../../components/RoutePanel';
import SosModal from '../../components/SosModal';
import Fab from '../../components/Fab';
import SosFab from '../../components/SosFab';
import { googleMapsDeepLink } from '@routing/client/deepLink';
import { GroupService } from '@routing/group/groupService';
import { resolveSos } from '@hazard/services/sosService';
import { resolveHazard } from '@hazard/services/hazardService';
import { useRidePlanStore } from '../../store/ridePlanStore';
import { useStopsStore } from '../../store/stopsStore';

// Phase 6 — tracking service wiring (Person A, unchanged)
import { Ekf } from '@tracking/ekf';
import { SensorStream } from '@tracking/sensorStream';
import { LocationPublisher } from '@tracking/locationPublisher';
import { TrackingService } from '@tracking/trackingService';
import { loadHlc } from '@tracking/hlcStore';
import { getLocationSocket } from '../../services/socketService';

MapboxGL.setAccessToken(MAPBOX_TOKEN ?? '');

export default function MapScreen() {
  const groupId = useAppStore((s) => s.groupId) ?? 'demo-group';
  const userId = useAppStore((s) => s.userId);
  const riders = useRidersStore((s) => s.riders);
  const connected = useRidersStore((s) => s.connected);
  const lastValidLocation = useRouteStore((s) => s.lastValidLocation);
  const route = useRouteStore((s) => s.route);
  const avoidHazardTypes = useRouteStore((s) => s.avoidHazardTypes);
  const push = useToastStore((s) => s.push);

  // UI state
  const [signalMenuOpen, setSignalMenuOpen] = useState(false);
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [sosEvents, setSosEvents] = useState<ActiveSos[]>([]);
  const [selectedHazard, setSelectedHazard] = useState<any>(null);
  const [showFuelBanner, setShowFuelBanner] = useState(true);
  const [networkBanner, setNetworkBanner] = useState<'lost' | 'recovered' | null>(null);
  const [sosActive, setSosActive] = useState(false);

  const prevConnectedRef = useRef<boolean | null>(null);

  // Keep a stable ref to the service so useEffect cleanup can always call .stop()
  const serviceRef = useRef<TrackingService | null>(null);

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

    const publisher = new LocationPublisher({
      socket,
      riderId: userId,
      groupId,
    });

    const service = new TrackingService({ ekf, sensors, publisher, hlc });
    serviceRef.current = service;

    service.start().catch((err: unknown) => {
      console.error('[MapScreen] TrackingService.start failed:', err);
    });

    // Subscribe riders store to location updates (other riders' markers).
    useRidersStore.getState().subscribe(groupId);

    // Load the ride plan saved at group creation (Create Ride modal).
    const groupService = new GroupService();
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

  return (
    <View style={styles.container}>
      {/* Layer 0 — Map */}
      <MapboxGL.MapView style={styles.map} styleURL={MapboxGL.StyleURL.Dark}>
        <MapboxGL.Camera
          defaultSettings={{
            centerCoordinate: [-122.4194, 37.7749],
            zoomLevel: 14,
          }}
          followUserLocation
          followUserMode={MapboxGL.UserTrackingMode.FollowWithHeading}
        />
        <MapboxGL.UserLocation showsUserHeadingIndicator />
        {/* Layer 1 — map overlays */}
        <RiderMarkerOverlay groupId={groupId} />
        <HazardOverlayMapLayer groupId={groupId} onHazardPress={setSelectedHazard} />
        <SosOverlayMapLayer groupId={groupId} userId={userId ?? undefined} onSosEventsChange={onSosEventsChange} />
        <RouteOverlay groupId={groupId} />
      </MapboxGL.MapView>

      {/* Layer 2 — floating UI */}

      {/* 3.3.1 Screen header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>RIDE OVERVIEW</Text>
          <Text style={styles.title} numberOfLines={1}>
            {groupId.slice(0, 8)}
          </Text>
        </View>
        <LivePill variant={connected ? 'live' : 'grey'} />
      </View>

      {/* 4.5 FL status badge */}
      <FlStatusOverlay />

      {/* 3.3.4 Fuel banner (conditional, stub threshold per spec) */}
      {showFuelBanner && route && route.distance_km > 50 && (
        <View style={styles.bannerWrap}>
          <FuelBanner
            message="Nearest fuel stop is far — plan a refill"
            onDismiss={() => setShowFuelBanner(false)}
          />
        </View>
      )}

      {/* 3.3.5 Network banner */}
      {networkBanner && (
        <View style={styles.bannerWrap}>
          <NetworkBanner
            state={networkBanner}
            riderName={userId ? `Rider ${userId.slice(-4)}` : 'A rider'}
            onDismiss={() => setNetworkBanner(null)}
          />
        </View>
      )}

      {/* 3.3.3 Toasts */}
      <ToastContainer top={90} />

      {/* 3.3.7 Signal menu */}
      <SignalMenu
        visible={signalMenuOpen}
        groupId={groupId}
        riderId={userId ?? ''}
        onSend={() => setSignalMenuOpen(false)}
      />

      {/* 3.3.6 FAB column */}
      <View style={styles.fabColumn}>
        <Fab onPress={openGoogleMaps} accessibilityLabel="Navigate in Google Maps">
          <View style={styles.fabNav}>
            <Text style={styles.fabIcon}>🧭</Text>
          </View>
        </Fab>
        <Fab
          onPress={() => setSignalMenuOpen((v) => !v)}
          accessibilityLabel="Send a quick signal"
        >
          <View style={styles.fabSignal}>
            <Text style={styles.fabIcon}>💬</Text>
          </View>
        </Fab>
        <SosFab
          onHoldComplete={() => setSosModalOpen(true)}
          disabled={sosActive}
        />
      </View>

      {/* Bottom stack: info cards, SOS info cards, nav hint, bottom sheet */}
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
          <NavHint />
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
            duckReason={sosActive ? 'SOS active' : null}
          />
        </View>
      </View>

      {/* 3.3.11 SOS modal */}
      <SosModal
        visible={sosModalOpen}
        riderId={userId ?? ''}
        groupId={groupId}
        riderCount={Math.max(riderCount, 1)}
        location={lastValidLocation ? { lat: lastValidLocation.lat, lng: lastValidLocation.lng } : null}
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
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 10,
    zIndex: 10,
  },
  eyebrow: {
    fontFamily: WeRideFonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: WeRideColors.primary,
  },
  title: {
    fontFamily: WeRideFonts.heading,
    fontSize: 24,
    color: WeRideColors.text,
    marginTop: 2,
  },
  bannerWrap: { position: 'absolute', top: 96, left: 0, right: 0, zIndex: 20 },
  fabColumn: {
    position: 'absolute',
    right: 12,
    bottom: 190,
    gap: 10,
    zIndex: 30,
  },
  fabNav: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: WeRideColors.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabSignal: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: WeRideColors.dark2,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabSos: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: WeRideColors.red,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabSosActive: { opacity: 0.5 },
  fabIcon: { fontSize: 19, color: WeRideColors.white },
  fabSosText: { fontFamily: WeRideFonts.mono, fontSize: 10, fontWeight: '700', color: WeRideColors.white },
  bottomStack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 25,
  },
  infoCardsScroll: { maxHeight: 200 },
  infoCardsContent: { paddingBottom: 4 },
});