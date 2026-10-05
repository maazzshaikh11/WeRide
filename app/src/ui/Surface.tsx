/**
 * Surfaces from demo.html: Card, List + ListItem rows, SectionLabel, IconWell,
 * CenterLine (the dashed road-paint divider).
 */
import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import Icon from './Icon';
import { IconName } from './iconData';
import PressableScale from './PressableScale';

export function Card({ pad = true, style, children, testID }: {
  pad?: boolean; style?: StyleProp<ViewStyle>; children?: React.ReactNode; testID?: string;
}) {
  const s = useStyles(({ colors }) => ({
    card: { backgroundColor: colors.card, borderRadius: 22, borderWidth: 1.5, borderColor: colors.line },
    pad: { padding: 18 },
  }));
  return <View testID={testID} style={[s.card, pad && s.pad, style]}>{children}</View>;
}

export function List({ style, children }: { style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  const s = useStyles(({ colors }) => ({
    list: { backgroundColor: colors.card, borderRadius: 22, borderWidth: 1.5, borderColor: colors.line, overflow: 'hidden' },
  }));
  return <View style={[s.list, style]}>{children}</View>;
}

/** Rounded square that holds a row icon. `accent` fills it with the brand colour. */
export function IconWell({ icon, accent, size = 42 }: { icon: IconName; accent?: boolean; size?: number }) {
  const { colors } = useTheme();
  const s = useStyles(({ colors: c }) => ({
    well: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card2, borderWidth: 1.5, borderColor: c.line },
    accent: { backgroundColor: c.pri, borderWidth: 0 },
  }));
  return (
    <View style={[s.well, accent && s.accent, size !== 42 && { width: size, height: size }]}>
      <Icon name={icon} size={20} color={accent ? colors.priInk : colors.ink} />
    </View>
  );
}

export interface ListItemProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  accentIcon?: boolean;
  /** First row in a List draws no divider. */
  first?: boolean;
  right?: React.ReactNode;
  /** Chevron on the right (default when pressable and no `right`). */
  chevron?: boolean;
  titleColor?: string;
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
}

export function ListItem({ title, subtitle, icon, accentIcon, first, right, chevron, titleColor, onPress, testID, accessibilityLabel }: ListItemProps) {
  const { type, colors } = useTheme();
  const s = useStyles(({ colors: c }) => ({
    row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 16, minHeight: 62 },
    divider: { position: 'absolute', top: 0, left: 16, right: 16, height: 1.5, backgroundColor: c.line },
    text: { flex: 1, minWidth: 0 },
  }));
  const content = (
    <>
      {first ? null : <View pointerEvents="none" style={s.divider} />}
      {icon ? <IconWell icon={icon} accent={accentIcon} /> : null}
      <View style={s.text}>
        <Text style={[type.listTitle, titleColor ? { color: titleColor } : null]}>{title}</Text>
        {subtitle ? <Text style={[type.listSub, { marginTop: 3 }]}>{subtitle}</Text> : null}
      </View>
      {right}
      {!right && (chevron ?? Boolean(onPress)) ? <Icon name="chev" size={18} color={colors.ink3} /> : null}
    </>
  );
  if (onPress) {
    return (
      <PressableScale
        onPress={onPress}
        haptic="select"
        scaleTo={0.99}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}. ${subtitle}` : title)}
        style={s.row}
        testID={testID}
      >
        {content}
      </PressableScale>
    );
  }
  return <View style={s.row} testID={testID}>{content}</View>;
}

/** Uppercase eyebrow above a group (demo `.sec` + `.t-label`). */
export function SectionLabel({ children, style, right }: { children: string; style?: StyleProp<ViewStyle>; right?: React.ReactNode }) {
  const { type } = useTheme();
  const s = useStyles(() => ({
    row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 28, marginBottom: 12, marginHorizontal: 2 },
  }));
  return (
    <View style={[s.row, style]}>
      <Text style={type.label} accessibilityRole="header">{children.toUpperCase()}</Text>
      {right}
    </View>
  );
}

/** The dashed accent line (demo `.cl`): road paint as a divider. */
export function CenterLine({ dim, style }: { dim?: boolean; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const [w, setW] = React.useState(0);
  return (
    <View style={[{ height: 3 }, style]} onLayout={(e) => setW(e.nativeEvent.layout.width)} pointerEvents="none">
      {w > 0 ? (
        <Svg width={w} height={3}>
          <Line x1={0} y1={1.5} x2={w} y2={1.5} stroke={colors.pri} strokeWidth={3} strokeDasharray="16 14" strokeLinecap="butt" opacity={dim ? 0.35 : 0.95} />
        </Svg>
      ) : null}
    </View>
  );
}
