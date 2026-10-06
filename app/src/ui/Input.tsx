/**
 * Code entry from demo.html: CodeBoxes (6 boxes, the active one ringed in `ink`), Keypad (digits, used for
 * the SMS code) and LetterKeypad (QWERTY, used for join codes). They are controlled: the screen owns the string.
 */
import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import Icon from './Icon';
import PressableScale from './PressableScale';

export function CodeBoxes({ value, length = 6, height = 64, fontSize = 28, error, style, testID }: {
  value: string; length?: number; height?: number; fontSize?: number; error?: boolean; style?: StyleProp<ViewStyle>; testID?: string;
}) {
  const { colors, type } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', gap: 8, justifyContent: 'space-between' }, style]} testID={testID} accessibilityLabel={`Code, ${value.length} of ${length} entered`}>
      {Array.from({ length }, (_, i) => {
        const active = i === value.length;
        return (
          <View
            key={i}
            style={{
              flex: 1, height, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center',
              borderWidth: active ? 3 : 1.5, borderColor: error ? colors.bad : active ? colors.ink : colors.line2,
            }}
          >
            <Text style={[type.num, { fontSize, lineHeight: fontSize + 4, color: colors.ink }]}>{value[i] ?? ''}</Text>
          </View>
        );
      })}
    </View>
  );
}

type KeyProps = { label: React.ReactNode; onPress: () => void; a11y: string; flex?: number; h: number; radius: number; soft?: boolean; fontSize: number };
function KeyBtn({ label, onPress, a11y, flex, h, radius, soft, fontSize }: KeyProps) {
  const { colors, type } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      haptic="tap"
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={{ ...(flex === undefined ? { alignSelf: 'stretch' as const } : { flex }), height: h, borderRadius: radius, alignItems: 'center', justifyContent: 'center', backgroundColor: soft ? colors.card2 : colors.card, borderWidth: 1.5, borderColor: colors.line }}
    >
      {typeof label === 'string' ? <Text style={[type.num, { fontSize, lineHeight: fontSize + 4, color: colors.ink }]}>{label}</Text> : label}
    </PressableScale>
  );
}

/** 3×4 digit pad (demo `otpkeys`). */
export function Keypad({ onKey, onBackspace }: { onKey: (d: string) => void; onBackspace: () => void }) {
  const { colors } = useTheme();
  const s = useStyles(() => ({ grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, cell: { width: '31.6%' } }));
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
  return (
    <View style={s.grid} testID="keypad">
      {keys.map((k, i) =>
        k === '' ? (
          <View key={i} style={s.cell} />
        ) : (
          <View key={i} style={s.cell}>
            <KeyBtn
              label={k === 'del' ? <Icon name="back" size={24} color={colors.ink} /> : k}
              a11y={k === 'del' ? 'Delete' : k}
              onPress={() => (k === 'del' ? onBackspace() : onKey(k))}
              h={62} radius={16} fontSize={26}
            />
          </View>
        ),
      )}
    </View>
  );
}

/** Pad for crew/ride codes (demo `jKey`, plus a 2–9 row because codes contain digits). I, L and O never appear in codes, so those keys are inert. */
export function LetterKeypad({ onKey, onBackspace, disabled = 'OIL' }: { onKey: (k: string) => void; onBackspace: () => void; disabled?: string }) {
  const { colors } = useTheme();
  const rows = ['23456789', 'QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
  return (
    <View style={{ gap: 7 }} testID="letter-keypad">
      {rows.map((row, ri) => (
        <View key={row} style={{ flexDirection: 'row', gap: 5, justifyContent: 'center' }}>
          {row.split('').map((k) => (
            <View key={k} style={{ flex: 1, maxWidth: 36, opacity: disabled.includes(k) ? 0.3 : 1 }}>
              <KeyBtn label={k} a11y={k} onPress={() => !disabled.includes(k) && onKey(k)} h={48} radius={9} fontSize={17} />
            </View>
          ))}
          {ri === 3 ? (
            <View style={{ flex: 1.6, maxWidth: 56 }}>
              <KeyBtn label={<Icon name="back" size={20} color={colors.ink} />} a11y="Delete" onPress={onBackspace} h={48} radius={9} fontSize={17} soft />
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}
