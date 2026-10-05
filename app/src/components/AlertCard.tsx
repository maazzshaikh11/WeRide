/**
 * AlertCard — hazard alert card for AlertsScreen (spec §3.7).
 * Tapping the card expands it (LayoutAnimation) to reveal real cluster fields
 * (report count, hazard score, distance when known) and, for active hazards, a
 * "Mark resolved" action with inline loading / success / error text.
 * New variant: accent border, "New" tag and a one-time highlight pulse
 * (opacity overlay, native driver). Rows enter with a staggered FadeIn.
 * The emoji is the hazard-type glyph (content), not chrome.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, LayoutAnimation, Platform, UIManager } from 'react-native';
import { WeRideColors, WeRideRadius, WeRideSpacing } from '../theme/theme';
import { type } from '../theme/typography';
import { Button, FadeIn, PressableCard, haptic, useReducedMotion } from '../ui';

export interface AlertDetail {
  label: string;
  value: string;
}

interface Props {
  emoji: string;
  title: string;
  meta: string;
  isNew?: boolean;
  /** Row index, used to stagger the entrance. */
  index?: number;
  /** Real cluster fields revealed on expand. */
  details?: AlertDetail[];
  /** When set, the expanded card offers "Mark resolved". Must reject on failure. */
  onResolve?: () => Promise<void>;
}

let layoutAnimationReady = false;

/**
 * Animate the next layout change (card expand/collapse). Android needs the
 * experimental flag; everything is guarded so it never throws (jest, new arch).
 */
export function animateNextLayout(): void {
  try {
    if (!layoutAnimationReady) {
      layoutAnimationReady = true;
      if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
    LayoutAnimation.configureNext?.(LayoutAnimation.Presets.easeInEaseOut);
  } catch {
    // Layout animation is cosmetic; the state change still happens.
  }
}

type ResolveState = 'idle' | 'loading' | 'done' | 'error';

export default function AlertCard({ emoji, title, meta, isNew, index = 0, details = [], onResolve }: Props) {
  const reduced = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [resolveState, setResolveState] = useState<ResolveState>('idle');
  const pulse = useRef(new Animated.Value(0)).current;
  const chevron = useRef(new Animated.Value(0)).current;
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // One-time highlight when a hazard newly arrives.
  useEffect(() => {
    if (!isNew || reduced) return;
    const anim = Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1100, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [isNew, reduced, pulse]);

  const toggle = useCallback(() => {
    const next = !expanded;
    animateNextLayout();
    setExpanded(next);
    Animated.timing(chevron, { toValue: next ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [expanded, chevron]);

  const resolve = useCallback(async () => {
    if (!onResolve || resolveState === 'loading') return;
    setResolveState('loading');
    try {
      await onResolve();
      if (!alive.current) return;
      haptic('success');
      animateNextLayout();
      setResolveState('done');
    } catch {
      if (!alive.current) return;
      haptic('error');
      setResolveState('error');
    }
  }, [onResolve, resolveState]);

  const label = `${isNew ? 'New. ' : ''}${title}. ${meta}`;
  const showResolve = onResolve != null && resolveState !== 'done';

  return (
    <FadeIn index={index}>
      <PressableCard
        radius={WeRideRadius.xl}
        active={isNew}
        onPress={toggle}
        haptic="tap"
        accessible={false}
        accessibilityLabel={label}
        style={styles.card}
      >
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={expanded ? 'Hides hazard details' : 'Shows hazard details'}
          accessibilityState={{ expanded }}
          accessibilityActions={[{ name: 'activate' }]}
          onAccessibilityAction={toggle}
          style={styles.header}
        >
          <View style={styles.iconTile}>
            <Text style={styles.icon}>{emoji}</Text>
          </View>
          <View style={styles.textWrap}>
            <Text style={type.heading}>{title}</Text>
            <Text style={type.caption}>{meta}</Text>
          </View>
          {isNew ? <Text style={type.eyebrow}>NEW</Text> : null}
          <Animated.Text
            style={[
              styles.chevron,
              { transform: [{ rotate: chevron.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) }] },
            ]}
          >
            ›
          </Animated.Text>
        </View>

        {expanded ? (
          <View style={styles.body} testID="alert-details">
            <View style={styles.divider} />
            {details.map((d) => (
              <View key={d.label} style={styles.detailRow}>
                <Text style={type.caption}>{d.label}</Text>
                <Text style={type.bodyStrong}>{d.value}</Text>
              </View>
            ))}
            {showResolve ? (
              <Button
                label="Mark resolved"
                variant="secondary"
                size="sm"
                loading={resolveState === 'loading'}
                onPress={resolve}
                accessibilityLabel={`Mark ${title} resolved`}
                style={styles.resolveBtn}
              />
            ) : null}
            {resolveState === 'done' ? (
              <Text style={[type.captionStrong, styles.statusOk]} accessibilityLiveRegion="polite">
                Marked resolved
              </Text>
            ) : null}
            {resolveState === 'error' ? (
              <Text style={[type.captionStrong, styles.statusErr]} accessibilityRole="alert">
                Could not mark resolved. Try again.
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* One-time "just arrived" highlight. */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pulse, { opacity: pulse }]} />
      </PressableCard>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  card: { padding: WeRideSpacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: WeRideSpacing.md },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: WeRideRadius.lg,
    backgroundColor: WeRideColors.dark2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 20, lineHeight: 24 },
  textWrap: { flex: 1 },
  chevron: { ...type.heading, color: WeRideColors.textSub, width: 16, textAlign: 'center' },
  body: { gap: WeRideSpacing.sm, paddingTop: WeRideSpacing.md },
  divider: { height: 1, backgroundColor: WeRideColors.border, marginBottom: WeRideSpacing.xs },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 24 },
  resolveBtn: { marginTop: WeRideSpacing.sm },
  statusOk: { color: WeRideColors.green, marginTop: WeRideSpacing.xs },
  statusErr: { color: WeRideColors.red, marginTop: WeRideSpacing.xs },
  pulse: { backgroundColor: WeRideColors.primaryDim },
});
