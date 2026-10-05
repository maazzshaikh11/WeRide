/**
 * HazardChip — one-tap hazard report button (spec §3.7).
 * Emoji here is a content glyph (the hazard type), not UI chrome.
 * `busy` swaps the glyph for a spinner; `disabled` blocks presses.
 * `feedback` plays a brief result moment after the report settles: success
 * flashes a green wash and swaps the glyph for a check; error flashes red.
 * All of it is opacity-only (native driver).
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { WeRideColors, WeRideRadius, WeRideSpacing } from '../theme/theme';
import { type } from '../theme/typography';
import { PressableScale } from '../ui';

export interface HazardChipFeedback {
  kind: 'success' | 'error';
  /** Changes on every new result so the same kind can replay. */
  id: number;
}

interface Props {
  emoji: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  feedback?: HazardChipFeedback | null;
}

export default function HazardChip({ emoji, label, onPress, disabled, busy, feedback }: Props) {
  const ok = useRef(new Animated.Value(0)).current;
  const err = useRef(new Animated.Value(0)).current;

  const feedbackId = feedback?.id;
  const feedbackKind = feedback?.kind;
  useEffect(() => {
    if (feedbackId == null || !feedbackKind) return;
    const v = feedbackKind === 'success' ? ok : err;
    const anim = Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.delay(feedbackKind === 'success' ? 650 : 250),
      Animated.timing(v, { toValue: 0, duration: 320, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [feedbackId, feedbackKind, ok, err]);

  return (
    <PressableScale
      onPress={onPress}
      // The tapped (busy) chip stays at full strength so its spinner reads clearly.
      disabled={disabled && !busy}
      haptic="select"
      accessibilityLabel={`Report hazard: ${label}`}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      style={styles.chip}
    >
      <View style={styles.glyph}>
        {busy ? (
          <ActivityIndicator size="small" color={WeRideColors.primary} />
        ) : (
          <>
            <Animated.Text style={[styles.emoji, { opacity: ok.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
              {emoji}
            </Animated.Text>
            <Animated.Text
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.check, { opacity: ok }]}
            >
              ✓
            </Animated.Text>
          </>
        )}
      </View>
      <Text style={[type.captionStrong, styles.label]} numberOfLines={1}>
        {label}
      </Text>
      <Animated.View pointerEvents="none" style={[styles.wash, styles.washOk, { opacity: ok }]} />
      <Animated.View pointerEvents="none" style={[styles.wash, styles.washErr, { opacity: err }]} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: WeRideSpacing.xs,
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: WeRideRadius.xl,
    paddingVertical: WeRideSpacing.sm,
    paddingHorizontal: WeRideSpacing.sm,
    overflow: 'hidden',
  },
  glyph: { height: 24, width: 32, justifyContent: 'center', alignItems: 'center' },
  emoji: { fontSize: 20, lineHeight: 24 },
  check: { ...type.heading, position: 'absolute', color: WeRideColors.green, textAlign: 'center' },
  label: { color: WeRideColors.text },
  wash: { ...StyleSheet.absoluteFillObject },
  washOk: { backgroundColor: WeRideColors.greenDim },
  washErr: { backgroundColor: WeRideColors.redDim },
});
