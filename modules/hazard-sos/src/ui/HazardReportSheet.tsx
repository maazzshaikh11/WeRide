/**
 * Hazard Report bottom sheet — type picker + confirm.
 * Owned by Person B. Registered as overlay on MapScreen.
 * Ported from hazard_report_sheet.dart.
 *
 * Local-first: if offline, queue locally, show "will sync when online" toast.
 * Optimistic UI: pin appears immediately on own map.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { WeRideColors, hazardColor } from '@app/theme/theme';
import type { HazardType } from '../dbscan/dbscan';

const TYPES: { type: HazardType; label: string }[] = [
  { type: 'pothole', label: 'Pothole' },
  { type: 'oil_spill', label: 'Oil Spill' },
  { type: 'accident', label: 'Accident' },
  { type: 'debris', label: 'Debris' },
  { type: 'other', label: 'Other' },
];

interface Props {
  onConfirm: (hazardType: HazardType) => void;
}

export default function HazardReportSheet({ onConfirm }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Report Hazard</Text>
      <View style={styles.row}>
        {TYPES.map((t) => (
          <TouchableOpacity
            key={t.type}
            style={[styles.chip, { backgroundColor: hazardColor(t.type) }]}
            onPress={() => onConfirm(t.type)}
          >
            <Text style={styles.chipText}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: WeRideColors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  chipText: { color: '#fff', fontWeight: '600' },
});