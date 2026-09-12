/**
 * Hazard Report Sheet — bottom sheet with hazard type picker + submit.
 * Owned by Person B. Registered as overlay on MapScreen.
 * Integrates with Phase 5 submitHazardReport service.
 */
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { WeRideColors, hazardColor } from '@app/theme/theme';
import { useAppStore } from '@app/store/appStore';
import type { HazardType } from '../dbscan/dbscan';
import { submitHazardReport } from '../services/hazardService';
import { isOnline } from '../crdt/syncWorker';

const TYPES: { type: HazardType; label: string; icon: string }[] = [
  { type: 'pothole', label: 'Pothole', icon: '🕳️' },
  { type: 'oil_spill', label: 'Oil Spill', icon: '🛢️' },
  { type: 'accident', label: 'Accident', icon: '🚨' },
  { type: 'debris', label: 'Debris', icon: '🪨' },
  { type: 'other', label: 'Other', icon: '❓' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  groupId?: string;
  riderId?: string;
  currentLocation?: { lat: number; lng: number; timestampHlc: string; spoofFlag?: boolean } | null;
}

export default function HazardReportSheet({
  visible,
  onClose,
  groupId: propsGroupId,
  riderId: propsRiderId,
  currentLocation,
}: Props) {
  const [selectedType, setSelectedType] = useState<HazardType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const appGroupId = useAppStore((s: any) => s.groupId);
  const appUserId = useAppStore((s: any) => s.userId);
  const groupId = propsGroupId ?? appGroupId ?? 'demo-group';
  const riderId = propsRiderId ?? appUserId ?? 'demo-rider';

  // Reset state when sheet opens/closes
  useEffect(() => {
    if (visible) {
      setSelectedType(null);
      setError(null);
      setStatusMessage(null);
    }
  }, [visible]);

  const handleSelectType = useCallback((type: HazardType) => {
    setSelectedType(type);
    setError(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedType) {
      setError('Please select a hazard type');
      return;
    }

    // Use provided location or try to get from tracking service
    const location = currentLocation;
    if (!location) {
      // Try to get from tracking service if available
      // This would need the tracking service instance - for now check app store
      // or we can pass it in via props
    }

    if (!location) {
      setError('Location unavailable — cannot submit hazard report');
      return;
    }

    setSubmitting(true);
    setError(null);
    setStatusMessage(null);

    if (location.spoofFlag) {
      Alert.alert(
        'Warning',
        'Your location appears to be spoofed. Proceed anyway?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              if (submitting) setSubmitting(false);
            },
          },
          {
            text: 'Proceed',
            style: 'destructive',
            onPress: async () => {
              await proceedSubmit(location);
            },
          },
        ]
      );
      return;
    }

    await proceedSubmit(location);
  }, [selectedType, currentLocation, riderId, groupId, onClose, submitting]);

  const proceedSubmit = async (location: any) => {
    try {
      // Check connectivity BEFORE submitting to distinguish online vs offline
      const wasOnline = await isOnline();

      await submitHazardReport(
        selectedType as any, // TS inference
        location.lat,
        location.lng,
        riderId,
        groupId,
        location.timestampHlc
      );

      if (!submitting) return; // prevent double-set if already unmounted

      // Distinguish online vs offline based on connectivity at submit time
      if (wasOnline) {
        // Successfully sent to Firestore
        setStatusMessage('Hazard reported');
        // Brief delay so user sees confirmation before sheet closes
        setTimeout(() => onClose(), 800);
      } else {
        // Queued offline
        setStatusMessage('Report saved — will sync when you\'re back online');
        setTimeout(() => onClose(), 1500);
      }
    } catch (err) {
      console.error('[HazardReportSheet] Submit failed:', err);
      setError('Failed to submit hazard report. Please try again.');
    } finally {
      if (submitting) setSubmitting(false);
    }
  };


  const handleCancel = useCallback(() => {
    if (!submitting) {
      onClose();
    }
  }, [submitting, onClose]);

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.handle} />
      <Text style={styles.title}>Report Hazard</Text>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {statusMessage && !error && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      )}

      <View style={styles.row}>
        {TYPES.map((t) => (
          <TouchableOpacity
            key={t.type}
            style={[
              styles.chip,
              {
                backgroundColor: selectedType === t.type
                  ? hazardColor(t.type)
                  : hazardColor(t.type) + '40', // 25% opacity when not selected
                borderWidth: selectedType === t.type ? 0 : 2,
                borderColor: hazardColor(t.type),
              },
            ]}
            onPress={() => handleSelectType(t.type)}
            disabled={submitting}
          >
            <Text style={[
              styles.chipText,
              { color: selectedType === t.type ? '#fff' : hazardColor(t.type) }
            ]}>
              {t.icon} {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[
            styles.button,
            styles.cancelButton,
            submitting && styles.buttonDisabled,
          ]}
          onPress={handleCancel}
          disabled={submitting}
        >
          <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.submitButton,
            !selectedType && styles.buttonDisabled,
            submitting && styles.buttonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!selectedType || submitting}
        >
          <Text style={styles.buttonText}>
            {submitting ? 'Submitting...' : 'Submit Report'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 30,
    backgroundColor: WeRideColors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: WeRideColors.textSecondary + '40',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: WeRideColors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: WeRideColors.error + '15',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: WeRideColors.error + '40',
  },
  errorText: {
    color: WeRideColors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  statusContainer: {
    backgroundColor: WeRideColors.primary + '15',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: WeRideColors.primary + '40',
  },
  statusText: {
    color: WeRideColors.primary,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    minWidth: 100,
    alignItems: 'center',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  cancelButton: {
    backgroundColor: WeRideColors.surface,
    borderWidth: 1,
    borderColor: WeRideColors.textSecondary + '40',
  },
  cancelButtonText: {
    color: WeRideColors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: WeRideColors.primary,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
