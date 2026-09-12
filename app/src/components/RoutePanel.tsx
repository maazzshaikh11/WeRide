/**
 * Route/ETA bottom sheet on the map.
 * Collapsed: ETA + distance + safety bar + controls.
 * Expanded: turn list placeholder + Google Maps deep link button.
 * Auto-updates when route_response changes (no manual refresh).
 * Ported from route_panel.dart.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { WeRideColors, safetyScoreColor } from '@app/theme/theme';

interface Props {
  etaMinutes: number;
  distanceKm: number;
  safetyScore: number;
  avoidHazards?: boolean;
  onToggleAvoidHazards?: () => void;
  onOpenInGoogleMaps?: () => void;
}

export default function RoutePanel({
  etaMinutes,
  distanceKm,
  safetyScore,
  avoidHazards = true,
  onToggleAvoidHazards,
  onOpenInGoogleMaps,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.panel}>
      {/* Collapsed header — always visible, tap to expand */}
      <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.header}>
        <View style={styles.row}>
          <Text style={styles.eta}>{Math.round(etaMinutes)} min</Text>
          <Text style={styles.dim}> · {distanceKm.toFixed(1)} km</Text>
          <View style={[styles.safetyBar, { backgroundColor: safetyScoreColor(safetyScore) }]} />
        </View>
      </TouchableOpacity>

      {/* Expanded content */}
      {expanded && (
        <ScrollView style={styles.expanded}>
          {/* Turn list placeholder (Phase 6 will populate) */}
          <View style={styles.turnListPlaceholder}>
            <Text style={styles.placeholderText}>Turn-by-turn navigation (Phase 5 UI only)</Text>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <TouchableOpacity style={styles.controlButton} onPress={onToggleAvoidHazards}>
              <Text style={styles.controlButtonText}>
                {avoidHazards ? '✓ Avoiding hazards' : '✗ Hazards ignored'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlButton} onPress={onOpenInGoogleMaps}>
              <Text style={styles.controlButtonText}>→ Open in Google Maps</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Collapsed controls (always visible) */}
      {!expanded && (
        <View style={styles.collapsedControls}>
          <TouchableOpacity onPress={onToggleAvoidHazards}>
            <Text style={styles.controlText}>{avoidHazards ? 'Avoiding hazards' : 'Hazards ignored'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: WeRideColors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eta: {
    fontSize: 20,
    fontWeight: 'bold',
    color: WeRideColors.textPrimary,
  },
  dim: {
    color: WeRideColors.textSecondary,
  },
  safetyBar: {
    width: 60,
    height: 8,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  expanded: {
    maxHeight: 300,
    marginTop: 16,
  },
  turnListPlaceholder: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: WeRideColors.background,
    borderRadius: 8,
    marginBottom: 16,
  },
  placeholderText: {
    fontSize: 12,
    color: WeRideColors.textSecondary,
    fontStyle: 'italic',
  },
  controls: {
    gap: 8,
  },
  controlButton: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: WeRideColors.primaryLight,
    borderRadius: 8,
  },
  controlButtonText: {
    color: WeRideColors.onPrimary,
    fontWeight: '500',
  },
  collapsedControls: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: WeRideColors.background,
  },
  controlText: {
    fontSize: 14,
    color: WeRideColors.accent,
    fontWeight: '500',
  },
});