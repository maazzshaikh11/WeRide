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
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { hazardColor } from '../../../theme/theme';
import { Plates } from '../../../theme/palettes';
import { useStyles, useTheme } from '../../../theme/ThemeProvider';
import { useInfoCardStyles } from './infoCardStyles';
import { Button, FadeIn } from '../../../ui';
import { subscribeToHazardClusters, HazardCluster, resolveHazard } from '@hazard/services/hazardService';

const { ShapeSource, FillLayer, SymbolLayer, MarkerView } = MapboxGL;

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
  const styles = useStyles(({ colors: c, type }) => ({
    // demo hazard sign: a yellow rounded diamond with a dark rim and a `!`
    marker: {
      borderRadius: 8,
      transform: [{ rotate: '45deg' }],
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: Plates.yellow.rim,
      backgroundColor: Plates.yellow.bg,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
    },
    resolved: { backgroundColor: c.card2, borderColor: c.ink3, opacity: 0.7 },
    markerText: { ...type.button, fontSize: 15, lineHeight: 18, color: Plates.yellow.fg, transform: [{ rotate: '-45deg' }] },
    markerTextResolved: { color: c.ink3 },
  }));
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
              'pothole', hazardColor('pothole'),
              'oil_spill', hazardColor('oil_spill'),
              'accident', hazardColor('accident'),
              'debris', hazardColor('debris'),
              'other', hazardColor('other'),
              hazardColor('other'),
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
              'pothole', hazardColor('pothole'),
              'oil_spill', hazardColor('oil_spill'),
              'accident', hazardColor('accident'),
              'debris', hazardColor('debris'),
              'other', hazardColor('other'),
              hazardColor('other'),
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
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <TouchableOpacity
            onPress={() => handleMarkerPress(cluster)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.marker,
                cluster.status === 'resolved' && styles.resolved,
                {
                  width: 26 + cluster.hazard_score * 10,
                  height: 26 + cluster.hazard_score * 10,
                },
              ]}
            >
              <Text style={[styles.markerText, cluster.status === 'resolved' && styles.markerTextResolved]}>!</Text>
            </View>
          </TouchableOpacity>
        </MarkerView>
      ))}
    </>
  );
}

/**
 * Info card component — renders outside MapView as absolutely positioned bottom sheet.
 */
export function HazardOverlayInfoCard({ selectedCluster, onDismiss, onResolve: _onResolve }: InfoCardProps) {
  const { colors } = useTheme();
  const cardStyles = useInfoCardStyles();
  const handleResolve = useCallback(async () => {
    if (!selectedCluster) return;
    try {
      await resolveHazard(selectedCluster.cluster_id);
      onDismiss();
    } catch (err) {
      console.error('[HazardOverlayInfoCard] Failed to resolve hazard:', err);
      Alert.alert('Error', 'Failed to resolve hazard');
    }
  }, [selectedCluster, onDismiss]);

  if (!selectedCluster) return null;

  const resolved = selectedCluster.status === 'resolved';
  const typeLabel = selectedCluster.hazard_type.replace(/_/g, ' ');
  const title = typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1);

  return (
    <FadeIn key={selectedCluster.cluster_id} style={cardStyles.cardWrap}>
      <View style={cardStyles.cardBody}>
        <View style={cardStyles.header}>
          <View
            style={[
              cardStyles.dot,
              {
                backgroundColor: resolved ? colors.ink3 : hazardColor(selectedCluster.hazard_type),
              },
            ]}
          />
          <Text
            style={[
              cardStyles.title,
              resolved && { color: colors.ink2 },
            ]}
            numberOfLines={1}
          >
            {title}
            {resolved && ' (resolved)'}
          </Text>
        </View>

        <View style={cardStyles.row}>
          <Text style={cardStyles.label}>Reports</Text>
          <Text style={cardStyles.value}>{selectedCluster.report_count}</Text>
        </View>
        <View style={cardStyles.row}>
          <Text style={cardStyles.label}>Hazard score</Text>
          <Text style={cardStyles.value}>
            {(selectedCluster.hazard_score * 100).toFixed(0)}%
          </Text>
        </View>

        <View style={cardStyles.actions}>
          <Button
            label="Dismiss"
            variant="secondary"
            size="sm"
            accessibilityLabel="Dismiss hazard details"
            onPress={onDismiss}
            style={cardStyles.actionFlex}
          />
          {selectedCluster.status === 'active' && (
            <Button
              label="Resolve hazard"
              size="sm"
              accessibilityLabel="Resolve hazard"
              onPress={handleResolve}
              style={cardStyles.actionFlex}
            />
          )}
        </View>
      </View>
    </FadeIn>
  );
}
