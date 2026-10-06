/**
 * Rider markers overlay — owned by Person A. Redesigned per master spec §4.1.
 * Avatar circles with initials, ringed in the page background like the demo
 * `.av`; verified / stale / flagged states are the theme's ok / ink3 / bad.
 * Info card uses the shared themed card family.
 * Reads from ridersStore (single source of truth); stale sweep every 1s.
 */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { useRidersStore } from '@app/store/ridersStore';
import { riderMarkerLook } from './riderMarkerState';
import { useTheme } from '../../../theme/ThemeProvider';
import { avatarColor } from '../../../theme/palettes';
import { useAppStore } from '../../../store/appStore';
import { useProfileStore, riderInitials, riderName } from '../../../store/profileStore';
import { useRidesStore } from '../../../store/ridesStore';
import { useRouteStore } from '@routing/client/routeStore';
import { haversineMeters } from '../../../utils/geoUtils';
import { GAP_THRESHOLD_M } from '../live/liveGeometry';
import { useInfoCardStyles, INFO_CARD_RADIUS } from './infoCardStyles';
import { FadeIn, Pill, PressableCard } from '../../../ui';
import type { PillTone } from '../../../ui';

const CIRCLE_RADIUS = 18; // demo .av is 36px
const RING_WIDTH = 2.5; // demo .av ring: 2.5px in the page background
const STALE_SWEEP_INTERVAL_MS = 1000;

/** A stable colour for a rider who is not in the ride's crew order (should not happen; never random). */
function hashedColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return avatarColor(h);
}

function formatSpeed(mps: number): string {
  if (!Number.isFinite(mps)) return '--';
  return `${(mps * 3.6).toFixed(1)} km/h`;
}

function formatHeading(deg: number): string {
  if (!Number.isFinite(deg)) return '--';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(((deg % 360 + 360) % 360) / 45) % 8;
  return `${Math.round(deg)}° ${dirs[idx]}`;
}

function formatAccuracy(m: number): string {
  if (!Number.isFinite(m)) return '--';
  return `${m.toFixed(1)} m`;
}

/** Status label per spec §11 — never color-only. */
function statusLabel(markerState: string, speed: number): { label: string; tone: PillTone } {
  if (markerState === 'RED') return { label: 'SPOOFED', tone: 'bad' };
  if (markerState === 'GREY') return { label: 'STALE', tone: 'default' };
  if (speed > 20) return { label: 'Leading', tone: 'ok' };
  return { label: 'On pace', tone: 'ok' };
}

export default function RiderMarkerOverlay({ groupId, sosRiderIds }: { groupId: string; sosRiderIds?: readonly string[] }) {
  const { colors } = useTheme();
  const profiles = useProfileStore((state) => state.byId);
  const myUid = useAppStore((state) => state.userId);
  const memberIds = useRidesStore((state) => state.rides.find((r) => r.id === groupId)?.member_ids);
  const own = useRouteStore((state) => state.lastValidLocation);
  const riders = useRidersStore((state) => state.riders);
  const refreshStaleStates = useRidersStore((state) => state.refreshStaleStates);
  const selectedRiderId = useRidersStore((state) => state.selectedRiderId);
  const selectRider = useRidersStore((state) => state.selectRider);

  // Stale sweep: re-evaluate marker states every 1 second
  useEffect(() => {
    const intervalId = setInterval(() => {
      refreshStaleStates();
    }, STALE_SWEEP_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [refreshStaleStates]);

  const geojson = useMemo(() => {
    const features: GeoJSON.Feature<GeoJSON.Point>[] = [];

    const order = [...new Set(memberIds ?? [])];
    riders.forEach((entry, riderId) => {
      // Crew colour = position in the ride's member order (same as every other avatar in the app).
      const idx = order.indexOf(riderId);
      const avatar = idx >= 0 ? avatarColor(idx) : hashedColor(riderId);
      const sos = sosRiderIds?.includes(riderId) ?? false;
      const distM = own ? haversineMeters(own.lat, own.lng, entry.location.lat, entry.location.lng) : 0;
      const far = entry.markerState === 'GREEN' && own != null && distM > GAP_THRESHOLD_M;
      const look = riderMarkerLook({ state: entry.markerState, avatar, sos, far }, colors);
      const first = riderName(profiles, riderId, myUid).split(/\s+/)[0];
      features.push({
        type: 'Feature',
        id: riderId,
        geometry: {
          type: 'Point',
          coordinates: [entry.location.lng, entry.location.lat],
        },
        properties: {
          rider_id: riderId,
          markerColor: look.fill,
          ringColor: look.ring,
          initialsColor: look.text,
          initials: riderInitials(profiles, riderId),
          // demo `.ld .nm`: a name chip for the riders that need attention (far, no signal, SOS)
          name: far || sos || entry.markerState === 'GREY' ? first.toUpperCase() : '',
          speed_mps: entry.location.speed_mps,
          heading_deg: entry.location.heading_deg,
          nis_score: entry.location.nis_score,
          accuracy_m: entry.location.accuracy_m,
          spoof_flag: entry.location.spoof_flag,
          markerState: entry.markerState,
        },
      });
    });

    return {
      type: 'FeatureCollection' as const,
      features,
    };
  }, [riders, colors, profiles, myUid, memberIds, own, sosRiderIds]);

  const shapeSourceRef = useRef<MapboxGL.ShapeSource>(null);

  const onPress = useCallback(
    (event: { features?: Array<{ properties?: unknown }> }) => {
      const features = event?.features ?? [];
      if (features.length === 0) {
        selectRider(null);
        return;
      }
      const props = features[0].properties as Record<string, any> | null | undefined;
      const riderId = props?.rider_id as string | undefined;
      if (riderId === selectedRiderId) {
        selectRider(null);
      } else {
        selectRider(riderId ?? null);
      }
    },
    [selectedRiderId, selectRider],
  );

  // Dismiss info card when selected rider is removed from store
  useEffect(() => {
    if (selectedRiderId && !riders.has(selectedRiderId)) {
      selectRider(null);
    }
  }, [riders, selectedRiderId, selectRider]);

  if (riders.size === 0) {
    return null;
  }

  return (
    <>
      <MapboxGL.ShapeSource
        id="rider-markers"
        shape={geojson}
        ref={shapeSourceRef}
        onPress={onPress}
      >
        <MapboxGL.CircleLayer
          id="rider-circles"
          style={{
            circleRadius: CIRCLE_RADIUS,
            circleColor: ['get', 'markerColor'],
            circleStrokeWidth: RING_WIDTH,
            circleStrokeColor: ['get', 'ringColor'],
          }}
        />
        <MapboxGL.SymbolLayer
          id="rider-initials"
          style={{
            textField: ['get', 'initials'] as any,
            textSize: 11,
            textColor: ['get', 'initialsColor'] as any,
            textAllowOverlap: true,
          }}
        />
        <MapboxGL.SymbolLayer
          id="rider-names"
          filter={['!=', ['get', 'name'], '']}
          style={{
            textField: ['get', 'name'] as any,
            textSize: 12,
            textAnchor: 'left',
            textOffset: [1.9, 0],
            textColor: colors.ink,
            textHaloColor: colors.bg,
            textHaloWidth: 2,
            textAllowOverlap: true,
          }}
        />
      </MapboxGL.ShapeSource>

      {/* Info card — rendered outside MapView via MapScreen */}
      {/* This component only renders the card if selectedEntry exists.
          The actual rendering position is handled by MapScreen. */}
    </>
  );
}

/**
 * Rider info card component (spec §4.1).
 * Rendered as a sibling of MapView in MapScreen (not inside MapView).
 * Shared info-card style (infoCardStyles).
 * Shows rider short ID, speed/heading/accuracy, status badge.
 */
export function RiderInfoCard() {
  const styles = useInfoCardStyles();
  const selectedRiderId = useRidersStore((state) => state.selectedRiderId);
  const riders = useRidersStore((state) => state.riders);
  const selectRider = useRidersStore((state) => state.selectRider);

  const entry = selectedRiderId ? riders.get(selectedRiderId) : null;

  if (!entry || !selectedRiderId) {
    return null;
  }

  const loc = entry.location;
  const status = statusLabel(entry.markerState, loc.speed_mps);

  return (
    <FadeIn key={selectedRiderId} style={styles.cardWrap}>
      <PressableCard
        radius={INFO_CARD_RADIUS}
        style={styles.cardBody}
        onPress={() => selectRider(null)}
        accessibilityLabel={`Rider ${selectedRiderId.slice(0, 8)} details. Tap to dismiss.`}
      >
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>Rider {selectedRiderId.slice(0, 8)}</Text>
          <Pill label={status.label} tone={status.tone} />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Speed</Text>
          <Text style={styles.value}>{formatSpeed(loc.speed_mps)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Heading</Text>
          <Text style={styles.value}>{formatHeading(loc.heading_deg)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Accuracy</Text>
          <Text style={styles.value}>{formatAccuracy(loc.accuracy_m)}</Text>
        </View>
        {__DEV__ && (
          <View style={styles.row}>
            <Text style={styles.label}>NIS</Text>
            <Text style={styles.value}>
              {Number.isFinite(loc.nis_score) ? loc.nis_score.toFixed(2) : '--'}
            </Text>
          </View>
        )}
      </PressableCard>
    </FadeIn>
  );
}
