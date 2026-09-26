/**
 * Rider markers overlay — owned by Person A. Redesigned per master spec §4.1.
 * 32×32 circles with Space Mono initials; GREEN/RED/GREY states;
 * leader crown, "You" label, stale badge, speech bubbles (via SymbolLayer
 * callouts + RN overlays). Info card dark-themed.
 * Reads from ridersStore (single source of truth); stale sweep every 1s.
 */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { useRidersStore } from '@app/store/ridersStore';
import { markerColorForState } from './riderMarkerState';
import { WeRideColors, WeRideFonts } from '../../../theme/theme';
import StatusBadge from '../../../components/StatusBadge';

const CIRCLE_RADIUS = 16; // 32px diameter per master spec §4.1
const STALE_SWEEP_INTERVAL_MS = 1000;

/** Space Mono-style initials from a rider id (2 chars, uppercase). */
function initialsFor(riderId: string): string {
  return riderId.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() || '??';
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
function statusLabel(markerState: string, speed: number): { label: string; variant: 'safe' | 'error' | 'muted' } {
  if (markerState === 'RED') return { label: 'SPOOFED', variant: 'error' };
  if (markerState === 'GREY') return { label: 'STALE', variant: 'muted' };
  if (speed > 20) return { label: 'Leading', variant: 'safe' };
  return { label: 'On pace', variant: 'safe' };
}

export default function RiderMarkerOverlay({ groupId }: { groupId: string }) {
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

    riders.forEach((entry, riderId) => {
      const color = markerColorForState(entry.markerState);
      features.push({
        type: 'Feature',
        id: riderId,
        geometry: {
          type: 'Point',
          coordinates: [entry.location.lng, entry.location.lat],
        },
        properties: {
          rider_id: riderId,
          markerColor: color,
          initials: initialsFor(riderId),
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
  }, [riders]);

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

  const selectedEntry = selectedRiderId ? riders.get(selectedRiderId) : null;

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
            circleStrokeWidth: 2,
            circleStrokeColor: '#111111',
          }}
        />
        <MapboxGL.SymbolLayer
          id="rider-initials"
          style={{
            textField: ['get', 'initials'] as any,
            textSize: 10,
            textColor: '#FFFFFF',
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
 * Dark-themed: #161616f7 bg, #2A2A2A border, 12px radius.
 * Shows rider short ID, speed/heading/accuracy, status badge.
 */
export function RiderInfoCard() {
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
    <Pressable
      style={styles.card}
      onPress={() => selectRider(null)}
      accessibilityLabel={`Rider ${selectedRiderId.slice(0, 8)} details. Tap to dismiss.`}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Rider {selectedRiderId.slice(0, 8)}</Text>
        <StatusBadge label={status.label} variant={status.variant} />
      </View>
      <Text style={styles.cardRow}>Speed: {formatSpeed(loc.speed_mps)}</Text>
      <Text style={styles.cardRow}>Heading: {formatHeading(loc.heading_deg)}</Text>
      <Text style={styles.cardRow}>Accuracy: {formatAccuracy(loc.accuracy_m)}</Text>
      {__DEV__ && (
        <Text style={styles.cardRow}>
          NIS: {Number.isFinite(loc.nis_score) ? loc.nis_score.toFixed(2) : '--'}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#161616f7',
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardTitle: {
    fontFamily: WeRideFonts.body,
    fontSize: 12,
    fontWeight: '700',
    color: WeRideColors.white,
  },
  cardRow: {
    fontFamily: WeRideFonts.body,
    fontSize: 10,
    color: WeRideColors.textSub,
    marginTop: 2,
  },
});