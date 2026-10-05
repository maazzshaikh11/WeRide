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
import { View, Text, StyleSheet, Animated } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { WeRideColors } from '../../../theme/theme';
import { infoCardStyles as cardStyles, INFO_CARD_RADIUS } from './infoCardStyles';
import { Button, FadeIn, PressableCard, useReducedMotion } from '../../../ui';
import { useAppStore } from '../../../store/appStore';
import { subscribeToSosEvents, resolveSos, SOSElement } from '@hazard/services/sosService';

const { MarkerView } = MapboxGL;

export interface ActiveSos {
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
  userId?: string;
  onSosEventsChange?: (events: ActiveSos[]) => void;
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
        onSosEventsChange?.(merged);
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
 * Red ring over an unresolved SOS card's border: a slow opacity pulse on the
 * native driver (static under reduced motion). Sits inside the card's own
 * border, so it reads as the border breathing between hairline and 2 px red.
 */
function SosBorderPulse() {
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (reduced || typeof Animated.loop !== 'function' || typeof Animated.sequence !== 'function') {
      pulse.setValue(0.6);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.15, duration: 1100, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced]);

  return <Animated.View pointerEvents="none" style={[cardPulseStyles.ring, { opacity: pulse }]} />;
}

/**
 * Info cards component — renders outside MapView as absolutely positioned bottom cards.
 */
export function SosOverlayInfoCards({ sosEvents, userId, onResolve, onNavigate }: InfoCardsProps) {
  return (
    <>
      {sosEvents.map((sos) => (
        <FadeIn key={`info-${sos.sos_id}`} style={cardStyles.cardWrap}>
          {/* FadeIn owns the wrapper's opacity, so the resolved dimming lives one level in. */}
          <View style={{ opacity: sos.resolved ? 0.8 : 1 }}>
            <PressableCard
              radius={INFO_CARD_RADIUS}
              style={[cardStyles.cardBody, !sos.resolved && { borderColor: WeRideColors.red }]}
              onPress={() => onNavigate(sos.lat, sos.lng)}
              accessibilityRole="button"
              accessibilityLabel={`${sos.resolved ? 'Resolved SOS' : 'SOS'} from ${
                sos.rider_id === userId ? 'you' : `rider ${sos.rider_id.slice(-4)}`
              }. Tap for directions.`}
            >
              {!sos.resolved ? <SosBorderPulse /> : null}
              <View style={cardStyles.header}>
                <View
                  style={[
                    cardStyles.dot,
                    { backgroundColor: sos.resolved ? WeRideColors.hazardResolved : WeRideColors.error },
                  ]}
                />
                <Text
                  style={[
                    cardStyles.title,
                    { color: sos.resolved ? WeRideColors.textSecondary : WeRideColors.error },
                  ]}
                  numberOfLines={1}
                >
                  {sos.resolved ? 'Resolved: ' : 'Emergency: '}
                  {sos.rider_id === userId ? 'You' : `Rider ${sos.rider_id.slice(-4)}`}
                </Text>
              </View>

              <View style={cardStyles.row}>
                <Text style={cardStyles.label}>Location</Text>
                <Text style={cardStyles.value}>
                  {sos.lat.toFixed(5)}, {sos.lng.toFixed(5)}
                </Text>
              </View>

              {sos.isSender && !sos.resolved && (
                <Button
                  label="Cancel SOS"
                  variant="danger"
                  accessibilityLabel="Cancel SOS"
                  onPress={() => onResolve(sos.sos_id)}
                />
              )}

              {sos.resolved ? (
                <Text style={cardStyles.hint}>Resolved — will disappear in 5 min</Text>
              ) : (
                <Text style={cardStyles.hint}>Tap the card for directions in Google Maps</Text>
              )}
            </PressableCard>
          </View>
        </FadeIn>
      ))}
    </>
  );
}

const cardPulseStyles = StyleSheet.create({
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: INFO_CARD_RADIUS,
    borderWidth: 2,
    borderColor: WeRideColors.red,
  },
});

const styles = StyleSheet.create({
  sosMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#FF3B3B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 9,
    elevation: 8,
  },
  sosMarkerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: -2,
  },
});
