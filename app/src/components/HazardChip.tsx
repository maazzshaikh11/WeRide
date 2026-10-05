/**
 * HazardChip — one-tap hazard report tile (spec §3.7), the demo's `.hz`:
 * 92 px, 20-radius `card2` tile with a 2 px `line2` rim, a 32 px glyph over an
 * uppercase label. The glyph is the demo icon for the hazard type (`icon`), or
 * an emoji (`emoji`) when no icon is given.
 * `busy` swaps the glyph for a spinner; `disabled` blocks presses.
 * `feedback` plays a brief result moment after the report settles: success
 * flashes an `ok` wash and swaps the glyph for a check; error flashes `bad`.
 * All of it is opacity-only (native driver).
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, Animated } from 'react-native';
import { withAlpha } from '../theme/palettes';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import { Icon, IconName, PressableScale } from '../ui';

export interface HazardChipFeedback {
  kind: 'success' | 'error';
  /** Changes on every new result so the same kind can replay. */
  id: number;
}

interface Props {
  /** Demo icon for the hazard type (preferred). */
  icon?: IconName;
  /** Content glyph used when there is no `icon`. */
  emoji?: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  feedback?: HazardChipFeedback | null;
}

export default function HazardChip({ icon, emoji, label, onPress, disabled, busy, feedback }: Props) {
  const { colors } = useTheme();
  const s = useStyles(({ colors: c, type: t }) => ({
    chip: {
      // Fixed share of the row (no grow): the 2 chips on the second row must match the 3 above.
      flexGrow: 0,
      flexBasis: '31%',
      height: 92,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.card2,
      borderWidth: 2,
      borderColor: c.line2,
      borderRadius: 20,
      overflow: 'hidden',
    },
    glyph: { height: 32, width: 32, justifyContent: 'center', alignItems: 'center' },
    emoji: { fontSize: 28, lineHeight: 32 },
    check: { position: 'absolute' },
    label: { ...t.pill, fontSize: 12, lineHeight: 14, letterSpacing: 0.96, color: c.ink },
    wash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    washOk: { backgroundColor: withAlpha(c.ok, 0.18) },
    washErr: { backgroundColor: withAlpha(c.bad, 0.18) },
  }));
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

  const fade = { opacity: ok.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) };
  return (
    <PressableScale
      onPress={onPress}
      // The tapped (busy) chip stays at full strength so its spinner reads clearly.
      disabled={disabled && !busy}
      haptic="select"
      scaleTo={0.95}
      accessibilityLabel={`Report hazard: ${label}`}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      style={s.chip}
    >
      <View style={s.glyph}>
        {busy ? (
          <ActivityIndicator size="small" color={colors.ink} />
        ) : (
          <>
            <Animated.View style={fade}>
              {icon ? <Icon name={icon} size={32} color={colors.ink} /> : <Text style={s.emoji}>{emoji}</Text>}
            </Animated.View>
            <Animated.View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[s.check, { opacity: ok }]}
            >
              <Icon name="check" size={32} color={colors.ok} />
            </Animated.View>
          </>
        )}
      </View>
      <Text style={s.label} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
      <Animated.View pointerEvents="none" style={[s.wash, s.washOk, { opacity: ok }]} />
      <Animated.View pointerEvents="none" style={[s.wash, s.washErr, { opacity: err }]} />
    </PressableScale>
  );
}
