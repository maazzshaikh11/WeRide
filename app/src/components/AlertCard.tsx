/**
 * AlertCard — hazard alert card for AlertsScreen (spec §3.7).
 * Tapping the card expands it (LayoutAnimation) to reveal real cluster fields
 * (report count, hazard score, distance when known) and, for active hazards, a
 * "Mark resolved" action with inline loading / success / error text.
 * New variant: accent border, "New" pill and a one-time highlight pulse
 * (opacity overlay, native driver). Rows enter with a staggered FadeIn.
 * Look: demo card (22-radius, `line` rim) with a 42 px `card2` icon well. The
 * well shows the demo icon for the hazard type (`icon`), or the emoji glyph
 * (content) when no icon is given.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, LayoutAnimation, Platform, UIManager } from 'react-native';
import { withAlpha } from '../theme/palettes';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import { Button, FadeIn, Icon, IconName, Pill, PressableCard, haptic, useReducedMotion } from '../ui';

export interface AlertDetail {
  label: string;
  value: string;
}

interface Props {
  /** Demo icon for the hazard type (preferred over `emoji`). */
  icon?: IconName;
  emoji?: string;
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

export default function AlertCard({ icon, emoji, title, meta, isNew, index = 0, details = [], onResolve }: Props) {
  const { colors, type } = useTheme();
  const styles = useStyles(({ colors: c, type: t }) => ({
    card: { padding: 16 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 44 },
    iconTile: {
      width: 42, height: 42, borderRadius: 13, backgroundColor: c.card2, borderWidth: 1.5, borderColor: c.line,
      alignItems: 'center', justifyContent: 'center',
    },
    icon: { fontSize: 20, lineHeight: 24 },
    textWrap: { flex: 1 },
    chevron: { width: 18, alignItems: 'center' },
    body: { gap: 10, paddingTop: 14 },
    divider: { height: 1.5, backgroundColor: c.line, marginBottom: 4 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 24 },
    resolveBtn: { marginTop: 6 },
    statusOk: { ...t.smStrong, color: c.ok, marginTop: 4 },
    statusErr: { ...t.smStrong, color: c.bad, marginTop: 4 },
    pulse: { backgroundColor: withAlpha(c.pri, 0.14) },
  }));
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
        radius={22}
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
            {icon ? <Icon name={icon} size={20} color={colors.ink} /> : <Text style={styles.icon}>{emoji}</Text>}
          </View>
          <View style={styles.textWrap}>
            <Text style={type.listTitle}>{title}</Text>
            <Text style={[type.listSub, { marginTop: 3 }]}>{meta}</Text>
          </View>
          {isNew ? <Pill tone="accent" label="New" /> : null}
          <Animated.View
            style={[
              styles.chevron,
              { transform: [{ rotate: chevron.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) }] },
            ]}
          >
            <Icon name="chev" size={18} color={colors.ink3} />
          </Animated.View>
        </View>

        {expanded ? (
          <View style={styles.body} testID="alert-details">
            <View style={styles.divider} />
            {details.map((d) => (
              <View key={d.label} style={styles.detailRow}>
                <Text style={type.sm}>{d.label}</Text>
                <Text style={type.bodyStrong}>{d.value}</Text>
              </View>
            ))}
            {showResolve ? (
              <Button
                label="Mark resolved"
                variant="soft"
                size="sm"
                loading={resolveState === 'loading'}
                onPress={resolve}
                accessibilityLabel={`Mark ${title} resolved`}
                style={styles.resolveBtn}
              />
            ) : null}
            {resolveState === 'done' ? (
              <Text style={styles.statusOk} accessibilityLiveRegion="polite">
                Marked resolved
              </Text>
            ) : null}
            {resolveState === 'error' ? (
              <Text style={styles.statusErr} accessibilityRole="alert">
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
