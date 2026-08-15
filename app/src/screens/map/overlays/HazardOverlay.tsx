/**
 * Hazard markers overlay — owned by Person B.
 * Renders hazard_cluster markers from Firestore real-time listener.
 * Color by hazard_type (via hazardColor() from theme). Tap → info card.
 * Resolved hazards → faded.
 *
 * TODO: wire to Firestore hazards/ listener filtered by group_id
 */
import React from 'react';
import { TouchableOpacity } from 'react-native';
import { WeRideColors, hazardColor } from '../../../theme/theme';

export default function HazardOverlay({ groupId }: { groupId: string }) {
  // Placeholder — floating "Report Hazard" button
  return (
    <TouchableOpacity
      style={{ backgroundColor: WeRideColors.hazardPothole, width: 56, height: 56, borderRadius: 28, position: 'absolute', bottom: 240, right: 16, justifyContent: 'center', alignItems: 'center' }}
      // TODO: show HazardReportSheet (bottom sheet with type picker)
      onPress={() => {}}
    />
  );
}