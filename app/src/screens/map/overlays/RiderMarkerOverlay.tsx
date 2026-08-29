/**
 * Rider markers overlay — owned by Person A.
 * Renders rider markers on the map, color-coded by marker state:
 *   GREEN = verified + fresh, RED = spoofed, GREY = stale/missing
 *
 * Uses a single ShapeSource + CircleLayer for all riders.
 * Reads from ridersStore (single source of truth).
 * Staleness is determined via HLC physical time comparison.
 * A 1-second interval refreshes stale states so riders that
 * stop sending go GREY within ~1s of the 10s boundary.
 */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { useRidersStore } from '@app/store/ridersStore';
import { markerColorForState } from './riderMarkerState';

const CIRCLE_RADIUS = 8;
const STALE_SWEEP_INTERVAL_MS = 1000;

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
    (event: { features?: Array<{ properties?: Record<string, any> }> }) => {
      if (!event.features || event.features.length === 0) {
        selectRider(null);
        return;
      }
      const props = event.features[0].properties;
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
            circleStrokeColor: '#FFFFFF',
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
 * Rider info card component.
 * Rendered as a sibling of MapView in MapScreen (not inside MapView).
 * Shows rider short ID, speed, heading, accuracy.
 * NIS score visible only under __DEV__.
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

  return (
    <Pressable
      style={styles.card}
      onPress={() => selectRider(null)}
    >
      <Text style={styles.cardTitle}>
        Rider {selectedRiderId.slice(0, 8)}
      </Text>
      <Text style={styles.cardRow}>
        Speed: {formatSpeed(loc.speed_mps)}
      </Text>
      <Text style={styles.cardRow}>
        Heading: {formatHeading(loc.heading_deg)}
      </Text>
      <Text style={styles.cardRow}>
        Accuracy: {formatAccuracy(loc.accuracy_m)}
      </Text>
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
    position: 'absolute',
    bottom: 24,
    left: 12,
    right: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  cardRow: {
    fontSize: 12,
    color: '#6C757D',
    marginTop: 2,
  },
});