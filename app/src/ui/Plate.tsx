/**
 * Plate — the road-sign status plate from demo.html: solid colour, an inset
 * rim 4 px in, big uppercase title, small subtitle. Tone carries meaning
 * (green fine ∙ yellow caution ∙ red SOS ∙ blue stop ahead) and is the same in
 * every theme.
 */
import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { PlateTone, Plates } from '../theme/palettes';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import Icon from './Icon';
import { IconName } from './iconData';
import { useResponsive } from '../theme/responsive';
import { CAP } from '../theme/textPolicy';
import PressableScale from './PressableScale';

export interface PlateProps {
  tone: PlateTone;
  title: string;
  subtitle?: string;
  icon?: IconName;
  /** Content aligned to the right edge (a timer, a glyph). */
  right?: React.ReactNode;
  /** Title size override (demo shrinks long titles from 28 to 23). */
  titleSize?: number;
  /** Lines the subtitle may wrap to (default 2; raise it where the sentence must be read in full). */
  subtitleLines?: number;
  /** Lines the title may wrap to (default 1; the demo's plates are single-line). */
  titleLines?: number;
  /** Toast size (demo `.toast .plate`): 11/16 padding, radius 16, 15.5 sentence-case ExtraBold title, up to 2 lines. */
  compact?: boolean;
  accessibilityLabel?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export default function Plate({ tone, title, subtitle, subtitleLines, icon, right, titleSize, titleLines, compact, accessibilityLabel, onPress, style, testID }: PlateProps) {
  const { type } = useTheme();
  const { isCompactWidth } = useResponsive();
  const s = useStyles(() => ({
    plate: { borderRadius: 18, paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
    rim: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderRadius: 14, borderWidth: 2, opacity: 0.92 },
    text: { flex: 1, minWidth: 0 },
    plateCompact: { borderRadius: 16, paddingVertical: 11, paddingHorizontal: 16, minHeight: 44 },
    rimCompact: { borderRadius: 12 },
  }));
  const p = Plates[tone];
  const body = (
    <>
      {icon ? <Icon name={icon} size={compact ? 28 : isCompactWidth ? 32 : 40} color={p.fg} /> : null}
      <View style={s.text}>
        <Text
          style={[
            type.plateTitle,
            { color: p.fg },
            compact ? { fontFamily: type.h2.fontFamily, fontSize: 15.5, lineHeight: 19, letterSpacing: -0.08 } : null,
            titleSize ? { fontSize: isCompactWidth && !compact ? Math.min(titleSize, 24) : titleSize, lineHeight: isCompactWidth && !compact ? Math.min(titleSize, 24) : titleSize } : isCompactWidth && !compact ? { fontSize: 22, lineHeight: 22 } : null,
          ]}
          numberOfLines={titleLines ?? (compact ? 2 : 1)}
          adjustsFontSizeToFit={!compact}
          minimumFontScale={0.7}
          maxFontSizeMultiplier={CAP.fixed}
        >
          {compact ? title : title.toUpperCase()}
        </Text>
        {subtitle ? (
          <Text style={[type.plateSub, { color: p.fg, opacity: 0.85, marginTop: 4 }]} numberOfLines={subtitleLines ?? 2} maxFontSizeMultiplier={CAP.hud}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      <View pointerEvents="none" style={[s.rim, compact && s.rimCompact, { borderColor: p.rim }]} />
    </>
  );
  const label = accessibilityLabel ?? (subtitle ? `${title}. ${subtitle}` : title);
  const base = [s.plate, compact && s.plateCompact, { backgroundColor: p.bg }, style];
  if (onPress) {
    return (
      <PressableScale
        onPress={onPress}
        haptic="tap"
        accessibilityRole="button"
        accessibilityLabel={label}
        style={base}
        testID={testID}
      >
        {body}
      </PressableScale>
    );
  }
  return (
    <View style={base} testID={testID} accessible accessibilityLabel={label}>
      {body}
    </View>
  );
}
