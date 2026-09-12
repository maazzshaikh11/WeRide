/**
 * Hazard markers overlay — owned by Person B.
 * Renders hazard_cluster markers from Firestore real-time listener.
 * Color by hazard_type (via hazardColor() from theme). Tap → info card.
 * Resolved hazards → faded.
 *
 * Split into two components:
 * - HazardOverlayMapLayer: renders Mapbox layers (ShapeSource, MarkerView) as children of MapScreen's MapView
 * - HazardOverlayInfoCard: renders the bottom info card for selected hazard (outside MapView)
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { WeRideColors, hazardColor } from '../../../theme/theme';
import { subscribeToHazardClusters, HazardCluster, resolveHazard } from '@hazard/services/hazardService';

const { ShapeSource, ShapeLayer, FillLayer, SymbolLayer, MarkerView } = MapboxGL;

interface MapLayerProps {
  groupId: string;
  onHazardPress?: (cluster: HazardCluster) => void;
}

interface InfoCardProps {
  selectedCluster: HazardCluster | null;
  onDismiss: () => void;
  onResolve: (clusterId: string) => void;
}

interface ClusterGeoJSON {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    id: string;
    geometry: {
      type: 'Point';
      coordinates: [number, number]; // [lng, lat]
    };
    properties: {
      cluster_id: string;
      hazard_type: string;
      hazard_score: number;
      report_count: number;
      status: string;
      centroid_lat: number;
      centroid_lng: number;
    };
  }>;
}

interface PolygonGeoJSON {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    id: string;
    geometry: {
      type: 'Polygon';
      coordinates: Array<Array<[number, number]>>;
    };
    properties: {
      cluster_id: string;
      hazard_type: string;
      hazard_score: number;
      status: string;
    };
  }>;
}

/**
 * Map layer component — renders ShapeSource/MarkerView as direct children of MapScreen's MapView.
 * Does NOT wrap in its own MapboxGL.MapView.
 */
export function HazardOverlayMapLayer({ groupId, onHazardPress }: MapLayerProps) {
  const [clusters, setClusters] = useState<HazardCluster[]>([]);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!groupId) return;

    unsubRef.current = subscribeToHazardClusters(groupId, (newClusters) => {
      setClusters(newClusters);
    });

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [groupId]);

  // Build GeoJSON for point markers
  const clusterGeoJSON: ClusterGeoJSON = {
    type: 'FeatureCollection',
    features: clusters.map((c) => ({
      type: 'Feature',
      id: c.cluster_id,
      geometry: {
        type: 'Point',
        coordinates: [c.centroid_lng, c.centroid_lat],
      },
      properties: {
        cluster_id: c.cluster_id,
        hazard_type: c.hazard_type,
        hazard_score: c.hazard_score,
        report_count: c.report_count,
        status: c.status,
        centroid_lat: c.centroid_lat,
        centroid_lng: c.centroid_lng,
      },
    })),
  };

  // Build GeoJSON for polygons
  const polygonGeoJSON: PolygonGeoJSON = {
    type: 'FeatureCollection',
    features: clusters
      .filter((c) => c.polygon_points && c.polygon_points.length >= 4)
      .map((c) => ({
        type: 'Feature',
        id: `${c.cluster_id}-polygon`,
        geometry: {
          type: 'Polygon',
          coordinates: [
            c.polygon_points.map((p) => [p[1], p[0]]), // [lng, lat]
          ],
        },
        properties: {
          cluster_id: c.cluster_id,
          hazard_type: c.hazard_type,
          hazard_score: c.hazard_score,
          status: c.status,
        },
      })),
  };

  const handleMarkerPress = useCallback((cluster: HazardCluster) => {
    onHazardPress?.(cluster);
  }, [onHazardPress]);

  return (
    <>
      {/* Polygon layer for hazard areas */}
      <ShapeSource id="hazard-polygons" shape={polygonGeoJSON}>
        <FillLayer
          id="hazard-polygon-fill"
          style={{
            fillColor: [
              'match',
              ['get', 'hazard_type'],
              'pothole', WeRideColors.hazardPothole,
              'oil_spill', WeRideColors.hazardOilSpill,
              'accident', WeRideColors.hazardAccident,
              'debris', WeRideColors.hazardDebris,
              'other', WeRideColors.hazardOther,
              WeRideColors.hazardOther,
            ],
            fillOpacity: [
              'match',
              ['get', 'status'],
              'resolved', 0.15,
              0.35,
            ],
            fillOutlineColor: [
              'match',
              ['get', 'hazard_type'],
              'pothole', WeRideColors.hazardPothole,
              'oil_spill', WeRideColors.hazardOilSpill,
              'accident', WeRideColors.hazardAccident,
              'debris', WeRideColors.hazardDebris,
              'other', WeRideColors.hazardOther,
              WeRideColors.hazardOther,
            ],
          }}
        />
      </ShapeSource>

      {/* Marker layer for hazard centroids */}
      <ShapeSource id="hazard-markers" shape={clusterGeoJSON} cluster={false}>
        <SymbolLayer
          id="hazard-marker"
          style={{
            iconImage: 'hazard-marker',
            iconSize: [
              'interpolate',
              ['linear'],
              ['get', 'hazard_score'],
              0, 0.6,
              1, 1.2,
            ],
            iconOpacity: [
              'match',
              ['get', 'status'],
              'resolved', 0.5,
              1,
            ],
            textField: '{report_count}',
            textFont: ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            textSize: 12,
            textColor: '#fff',
            textHaloColor: '#000',
            textHaloWidth: 1,
            textAllowOverlap: true,
          }}
        />
      </ShapeSource>

      {/* Interactive markers for tap handling */}
      {clusters.map((cluster) => (
        <MarkerView
          key={cluster.cluster_id}
          coordinate={[cluster.centroid_lng, cluster.centroid_lat]}
          onPress={() => handleMarkerPress(cluster)}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View
            style={[
              styles.marker,
              {
                backgroundColor: cluster.status === 'resolved'
                  ? WeRideColors.hazardResolved
                  : hazardColor(cluster.hazard_type),
                width: 24 + cluster.hazard_score * 16,
                height: 24 + cluster.hazard_score * 16,
              },
            ]}
          >
            <Text style={styles.markerText}>
              {cluster.report_count > 9 ? '9+' : cluster.report_count}
            </Text>
          </View>
        </MarkerView>
      ))}
    </>
  );
}

/**
 * Info card component — renders outside MapView as absolutely positioned bottom sheet.
 */
export function HazardOverlayInfoCard({ selectedCluster, onDismiss, onResolve }: InfoCardProps) {
  if (!selectedCluster) return null;

  const handleResolve = useCallback(async () => {
    try {
      await resolveHazard(selectedCluster.cluster_id);
      onDismiss();
    } catch (err) {
      console.error('[HazardOverlayInfoCard] Failed to resolve hazard:', err);
      Alert.alert('Error', 'Failed to resolve hazard');
    }
  }, [selectedCluster.cluster_id, onDismiss]);

  return (
    <View style={styles.infoCard}>
      <View style={styles.infoHeader}>
        <View
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: selectedCluster.status === 'resolved'
              ? WeRideColors.hazardResolved
              : hazardColor(selectedCluster.hazard_type),
          }}
        />
        <Text style={[
          styles.infoTitle,
          { color: selectedCluster.status === 'resolved' ? WeRideColors.textSecondary : WeRideColors.textPrimary }
        ]}>
          {selectedCluster.hazard_type.charAt(0).toUpperCase() + selectedCluster.hazard_type.slice(1)}
          {selectedCluster.status === 'resolved' && ' (Resolved)'}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Reports</Text>
        <Text style={styles.infoValue}>{selectedCluster.report_count}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Hazard Score</Text>
        <Text style={styles.infoValue}>
          {(selectedCluster.hazard_score * 100).toFixed(0)}%
        </Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Status</Text>
        <Text style={[
          styles.infoValue,
          {
            color: selectedCluster.status === 'resolved'
              ? WeRideColors.textSecondary
              : WeRideColors.hazardAccident,
          },
        ]}>
          {selectedCluster.status}
        </Text>
      </View>

      {selectedCluster.status === 'active' && (
        <TouchableOpacity
          style={styles.resolveButton}
          onPress={handleResolve}
        >
          <Text style={styles.resolveButtonText}>Resolve Hazard</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
        <Text style={styles.dismissButtonText}>Dismiss</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  marker: {
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  markerText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  infoCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: WeRideColors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: WeRideColors.textSecondary + '20',
  },
  infoLabel: {
    fontSize: 14,
    color: WeRideColors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  resolveButton: {
    backgroundColor: WeRideColors.hazardAccident,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  resolveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dismissButton: {
    backgroundColor: WeRideColors.surface,
    borderWidth: 1,
    borderColor: WeRideColors.textSecondary + '40',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  dismissButtonText: {
    color: WeRideColors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
