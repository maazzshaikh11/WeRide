/**
 * SOS Overlay — owned by Person B.
 * Renders active SOS markers from Firestore real-time listener.
 * Active SOS: large red marker, pulsing animation, highest visual priority.
 * Resolved SOS: grey marker, no pulse, "Resolved" label, auto-hide after 5 min.
 * Sender sees "Cancel SOS" button on their own SOS marker.
 *
 * Split into two components:
 * - SosOverlayMapLayer: renders MarkerView markers as children of MapScreen's MapView
 * - SosOverlayInfoCards: renders info cards for SOS events (outside MapView)
 */
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Alert, Linking } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { WeRideColors } from '../../../theme/theme';
import { useAppStore } from '../../../store/appStore';
import { subscribeToSosEvents, resolveSos, SOSElement } from '@hazard/services/sosService';

const { MarkerView } = MapboxGL;

interface ActiveSos {
  sos_id: string;
  rider_id: string;
  group_id: string;
  lat: number;
  lng: number;
  created_at_hlc: string;
  resolved: boolean;
  resolved_at_hlc: string | null;
  isSender: boolean;
  // UI state
  pulseAnim?: Animated.Value;
  resolvedTimer?: ReturnType<typeof setTimeout>;
}

interface MapLayerProps {
  groupId: string;
  userId: string;
  onSosEventsChange: (events: ActiveSos[]) => void;
}

interface InfoCardsProps {
  sosEvents: ActiveSos[];
  userId: string;
  onResolve: (sosId: string) => void;
  onNavigate: (lat: number, lng: number) => void;
}

/**
 * Map layer component — renders MarkerView SOS markers as direct children of MapScreen's MapView.
 * Manages the Firestore subscription and pulse animations.
 * Reports sosEvents upward via onSosEventsChange callback.
 */
export function SosOverlayMapLayer({ groupId, userId, onSosEventsChange }: MapLayerProps) {
  const [sosEvents, setSosEvents] = useState<ActiveSos[]>([]);
  const unsubRef = useRef<(() => void) | null>(null);

  // Create pulsing animation for active SOS
  const createPulseAnim = useCallback(() => {
    const anim = new Animated.Value(1);
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1.3,
          duration: 800,
          useNativeDriver: false,
          easing: (t) => t,
        }),
        Animated.timing(anim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: false,
          easing: (t) => t,
        }),
      ])
    ).start();
    return anim;
  }, []);

  // Cleanup animations on unmount
  useEffect(() => {
    return () => {
      sosEvents.forEach((sos) => {
        if (sos.pulseAnim) {
          sos.pulseAnim.stopAnimation();
        }
        if (sos.resolvedTimer) {
          clearTimeout(sos.resolvedTimer);
        }
      });
      if (unsubRef.current) {
        unsubRef.current();
      }
    };
  }, []);

  // Subscribe to SOS events
  useEffect(() => {
    if (!groupId) return;

    unsubRef.current = subscribeToSosEvents(groupId, (events: SOSElement[]) => {
      setSosEvents((prev) => {
        // The service deliberately emits active OR-Set members only; resolved
        // records are tombstones and must never be rendered as active SOS.
        const activeEvents = events;
        const resolvedEvents: SOSElement[] = [];

        const newActive: ActiveSos[] = activeEvents.map((e) => {
          const existing = prev.find((p) => p.sos_id === e.sos_id);
          const isSender = e.rider_id === userId;
          if (existing && existing.pulseAnim) {
            return { ...e, resolved: false, resolved_at_hlc: null, isSender, pulseAnim: existing.pulseAnim };
          }
          return { ...e, resolved: false, resolved_at_hlc: null, isSender, pulseAnim: createPulseAnim() };
        });

        const newResolved: ActiveSos[] = resolvedEvents.map((e) => {
          const existing = prev.find((p) => p.sos_id === e.sos_id);
          const isSender = e.rider_id === userId;
          // Stop pulse animation for resolved
          if (existing?.pulseAnim) {
            existing.pulseAnim.stopAnimation();
          }
          // Auto-hide resolved after 5 minutes
          const timer = setTimeout(() => {
            setSosEvents((p) => p.filter((s) => s.sos_id !== e.sos_id));
          }, 5 * 60 * 1000);
          return {
            ...e,
            isSender,
            resolved: true,
            resolved_at_hlc: null,
            pulseAnim: undefined,
            resolvedTimer: timer,
          };
        });

        const merged = [...newActive, ...newResolved];
        // Report to parent so InfoCards can render
        onSosEventsChange(merged);
        return merged;
      });
    });

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [groupId, userId, createPulseAnim, onSosEventsChange]);



  return (
    <>
      {sosEvents.map((sos) => (
        <MarkerView
          key={sos.sos_id}
          coordinate={[sos.lng, sos.lat]}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <Animated.View
            style={[
              styles.sosMarker,
              {
                backgroundColor: sos.resolved ? WeRideColors.hazardResolved : WeRideColors.error,
                opacity: sos.resolved ? 0.7 : 1,
                transform: sos.pulseAnim ? [{ scale: sos.pulseAnim }] : [],
              },
            ]}
          >
            <Text style={styles.sosMarkerText}>!</Text>
          </Animated.View>
        </MarkerView>
      ))}
    </>
  );
}

/**
 * Info cards component — renders outside MapView as absolutely positioned bottom cards.
 */
export function SosOverlayInfoCards({ sosEvents, userId, onResolve, onNavigate }: InfoCardsProps) {
  const handleNavigate = useCallback((lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    Linking.openURL(url).catch((err) => {
      console.error('[SosOverlayInfoCards] Failed to open Google Maps:', err);
      Alert.alert('Error', 'Could not open Google Maps. Is it installed?');
    });
  }, []);

  return (
    <>
      {sosEvents.map((sos) => (
        <TouchableOpacity
          key={`info-${sos.sos_id}`}
          style={[
            styles.infoCard,
            { opacity: sos.resolved ? 0.8 : 1 },
          ]}
          onPress={() => onNavigate(sos.lat, sos.lng)}
        >
          <View style={styles.infoHeader}>
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: sos.resolved ? WeRideColors.hazardResolved : WeRideColors.error,
              }}
            />
            <Text style={[
              styles.infoTitle,
              { color: sos.resolved ? WeRideColors.textSecondary : WeRideColors.error },
            ]}>
              {sos.resolved ? 'Resolved: ' : '🚨 Emergency: '}
              {sos.rider_id === userId ? 'You' : `Rider ${sos.rider_id.slice(-4)}`}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Location</Text>
            <Text style={styles.infoValue}>
              {sos.lat.toFixed(5)}, {sos.lng.toFixed(5)}
            </Text>
          </View>

          {sos.isSender && !sos.resolved && (
            <TouchableOpacity style={styles.cancelButton} onPress={() => onResolve(sos.sos_id)}>
              <Text style={styles.cancelButtonText}>Cancel SOS</Text>
            </TouchableOpacity>
          )}

          {sos.resolved && (
            <Text style={styles.resolvedText}>Resolved — will disappear in 5 min</Text>
          )}
        </TouchableOpacity>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  sosMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  sosMarkerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: -2,
  },
  infoCard: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    backgroundColor: WeRideColors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 24,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: WeRideColors.textSecondary + '20',
  },
  infoLabel: {
    fontSize: 13,
    color: WeRideColors.textSecondary,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: WeRideColors.textPrimary,
  },
  cancelButton: {
    backgroundColor: WeRideColors.error,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  resolvedText: {
    textAlign: 'center',
    color: WeRideColors.textSecondary,
    fontSize: 12,
    marginTop: 8,
  },
});
