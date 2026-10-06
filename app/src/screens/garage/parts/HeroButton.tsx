/** The big accent / dark action with a trailing chevron (demo `.btn` + `chev`): "Go to meetup >", "Plan a ride >". */
import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { useStyles, useTheme } from '../../../theme/ThemeProvider';
import { Icon, PressableScale } from '../../../ui';
import type { IconName } from '../../../ui';

export default function HeroButton({
  label, onPress, variant = 'primary', leadingIcon, style, testID, accessibilityLabel,
}: {
  label: string; onPress: () => void; variant?: 'primary' | 'dark'; leadingIcon?: IconName;
  style?: StyleProp<ViewStyle>; testID?: string; accessibilityLabel?: string;
}) {
  const { colors, type } = useTheme();
  const styles = useStyles(() => ({
    btn: { height: 58, borderRadius: 18, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    left: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  }));
  const bg = variant === 'primary' ? colors.pri : colors.ink;
  const fg = variant === 'primary' ? colors.priInk : colors.bg;
  const border = variant === 'primary' ? { borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.14)' } : null;
  const text = <Text style={[type.button, { color: fg }]} numberOfLines={1}>{label}</Text>;
  return (
    <PressableScale
      onPress={onPress}
      haptic="select"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      style={[styles.btn, { backgroundColor: bg }, border, leadingIcon && { justifyContent: 'space-between' }, style]}
    >
      {leadingIcon ? (
        <View style={styles.left}>
          <Icon name={leadingIcon} size={22} color={fg} />
          {text}
        </View>
      ) : (
        text
      )}
      <Icon name="chev" size={20} color={fg} />
    </PressableScale>
  );
}
