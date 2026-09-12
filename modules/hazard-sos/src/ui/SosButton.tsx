/**
 * SOS Button — anti-accidental trigger guard (MANDATORY per spec §4.2).
 * Requires 2-second hold to trigger. Single tap must NOT fire.
 * States: idle → big red button; triggered → greyed, resolve button appears (sender only).
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, Animated, View } from 'react-native';
import { WeRideColors } from '@app/theme/theme';

interface Props {
  onTrigger: () => void;
  onResolve?: (sosId: string) => void;
  showResolve?: boolean; // sender only
  style?: ViewStyle;
  sosId?: string | null; // active SOS ID for sender
  testID?: string;
}

const HOLD_MS = 2000;

export default function SosButton({
  onTrigger,
  onResolve,
  showResolve = false,
  style,
  sosId,
  testID,
}: Props) {
  const [triggered, setTriggered] = useState(false);
  const [holding, setHolding] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressAnimRef = useRef<Animated.Value>(new Animated.Value(0));

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };
  }, []);

  const fire = useCallback(() => {
    if (triggered) return;
    setTriggered(true);
    setHolding(false);
    onTrigger();
  }, [triggered, onTrigger]);

  const onHoldStart = useCallback(() => {
    if (triggered) return;
    setHolding(true);
    progressAnimRef.current.setValue(0);
    Animated.timing(progressAnimRef.current, {
      toValue: 1,
      duration: HOLD_MS,
      useNativeDriver: false,
    }).start();

    holdTimerRef.current = setTimeout(() => {
      fire();
    }, HOLD_MS);
  }, [triggered, fire]);

  const onHoldEnd = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (!triggered) {
      setHolding(false);
      progressAnimRef.current.setValue(0);
    }
  }, [triggered]);

  // Reset triggered state when sosId clears (SOS resolved)
  useEffect(() => {
    if (!sosId && triggered) {
      setTriggered(false);
    }
  }, [sosId, triggered]);

  const progressRing = (
    <Animated.View
      style={[
        styles.progressRing,
        {
          transform: [
            { rotate: progressAnimRef.current.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '360deg'],
            }) },
          ],
        },
      ]}
    />
  );

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        testID={testID}
        style={[
          styles.button,
          {
            backgroundColor: triggered ? '#9AA0A6' : WeRideColors.error,
          },
          style,
        ]}
        onPressIn={onHoldStart}
        onPressOut={onHoldEnd}
        onPress={() => {}}
        activeOpacity={0.9}
        accessibilityLabel={triggered ? 'SOS Active' : 'SOS - Hold for 2 seconds to trigger'}
        accessibilityRole="button"
        disabled={triggered}
      >
        {holding && <View style={styles.progressContainer}>{progressRing}</View>}
        <Text style={styles.icon}>{triggered ? '✓' : 'SOS'}</Text>
      </TouchableOpacity>

      {triggered && showResolve && onResolve && sosId && (
        <TouchableOpacity
          style={styles.resolveButton}
          onPress={() => onResolve(sosId)}
          accessibilityLabel="Cancel SOS"
          accessibilityRole="button"
        >
          <Text style={styles.resolveButtonText}>Cancel SOS</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    gap: 8,
  },
  button: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    overflow: 'hidden',
  },
  progressContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  icon: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    zIndex: 1,
  },
  resolveButton: {
    backgroundColor: WeRideColors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: WeRideColors.error + '40',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  resolveButtonText: {
    color: WeRideColors.error,
    fontSize: 13,
    fontWeight: '600',
  },
});