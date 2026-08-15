/**
 * Route/ETA bottom sheet on the map.
 * Collapsed: ETA + distance + safety bar. Expanded: turn list + Google Maps deep link.
 * Auto-updates when route_response changes (no manual refresh).
 * Ported from route_panel.dart.
 *
 * TODO: collapsed/expanded bottom sheet states, turn list, Google Maps intent URL (Linking.openURL)
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
  return (
    <View style={styles.panel}>
      <View style={styles.row}>
        <Text style={styles.eta}>{Math.round(etaMinutes)} min</Text>
        <Text style={styles.dim}> · {distanceKm.toFixed(1)} km</Text>
        <View style={[styles.safetyBar, { backgroundColor: safetyScoreColor(safetyScore) }]} />
      </View>
      <View style={styles.row}>
        <TouchableOpacity onPress={onToggleAvoidHazards}>
          <Text>{avoidHazards ? 'Avoiding hazards' : 'Hazards ignored'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onOpenInGoogleMaps}>
          <Text>Open in Google Maps</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: WeRideColors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', marginVertical: 4, gap: 16 },
  eta: { fontSize: 20, fontWeight: 'bold', color: WeRideColors.textPrimary },
  dim: { color: WeRideColors.textSecondary },
  safetyBar: { width: 60, height: 8, borderRadius: 4, marginLeft: 'auto' },
});