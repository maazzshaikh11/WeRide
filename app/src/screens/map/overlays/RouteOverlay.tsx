/**
 * Route/ETA panel overlay — owned by Person C.
 * Bottom sheet on the map: collapsed shows ETA + distance + safety bar;
 * expanded shows turn list + "Open in Google Maps" deep link.
 * Auto-updates when route_response changes (no manual refresh).
 * "Avoid hazards" toggle.
 *
 * TODO: wire to RoutingClient (calls POST /route)
 * TODO: collapsed/expanded bottom sheet states
 * TODO: Google Maps deep link (intent URL — Linking.openURL)
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { WeRideColors, safetyScoreColor } from '../../../theme/theme';

export default function RouteOverlay({ groupId }: { groupId: string }) {
  const etaMinutes = 0; // TODO: from route_response
  const distanceKm = 0;
  const safetyScore = 1;

  return (
    <View style={styles.panel}>
      <View style={styles.row}>
        <Text style={styles.eta}>{etaMinutes} min</Text>
        <Text> · {distanceKm} km</Text>
        <View style={[styles.safetyBar, { backgroundColor: safetyScoreColor(safetyScore) }]} />
      </View>
      <View style={styles.row}>
        <TouchableOpacity onPress={() => {}}>
          <Text>Avoiding hazards</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => {}}>
          <Text>Open in Google Maps</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  eta: { fontSize: 20, fontWeight: 'bold', color: WeRideColors.textPrimary },
  safetyBar: { width: 60, height: 8, borderRadius: 4, marginLeft: 16 },
});