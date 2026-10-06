/**
 * Code entry from demo.html: CodeBoxes (6 boxes, the active one ringed in `ink`), Keypad (digits, used for
 * the SMS code) and LetterKeypad (QWERTY, used for join codes). They are controlled: the screen owns the string.
 */
import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { useResponsive } from '../theme/responsive';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import { CAP } from '../theme/textPolicy';
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
            <Text style={[type.num, { fontSize, lineHeight: fontSize + 4, color: colors.ink }]} maxFontSizeMultiplier={CAP.fixed}>{value[i] ?? ''}</Text>
          </View>
        );
      })}
    </View>
  );
}

type KeyProps = { label: React.ReactNode; onPress: () => void; a11y: string; flex?: number; h: number; radius: number; soft?: boolean; fontSize: number; testID?: string };
function KeyBtn({ label, onPress, a11y, flex, h, radius, soft, fontSize, testID }: KeyProps) {
  const { colors, type } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      haptic="tap"
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      testID={testID}
      style={{ ...(flex === undefined ? { alignSelf: 'stretch' as const } : { flex }), height: h, borderRadius: radius, alignItems: 'center', justifyContent: 'center', backgroundColor: soft ? colors.card2 : colors.card, borderWidth: 1.5, borderColor: colors.line }}
    >
      {typeof label === 'string' ? <Text style={[type.num, { fontSize, lineHeight: fontSize + 4, color: colors.ink }]} maxFontSizeMultiplier={CAP.fixed}>{label}</Text> : label}
    </PressableScale>
  );
}

/** 3×4 digit pad (demo `otpkeys`). */
export function Keypad({ onKey, onBackspace }: { onKey: (d: string) => void; onBackspace: () => void }) {
  const { colors } = useTheme();
  const { usableHeight } = useResponsive();
  // The pad is pinned at the bottom of its screen: on short screens it must leave room for the code above it.
  // 62 pt keys on a regular phone; 54 / 44 pt (never under 44) as the usable height shrinks.
  const keyH = usableHeight < 560 ? 44 : usableHeight < 700 ? 54 : 62;
  const gap = usableHeight < 700 ? 6 : 8;
  const s = useStyles(() => ({ cell: { width: '31.6%' } }));
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }} testID="keypad">
      {keys.map((k, i) =>
        k === '' ? (
          <View key={i} style={s.cell} />
        ) : (
          <View key={i} style={s.cell}>
            <KeyBtn
              label={k === 'del' ? <Icon name="back" size={24} color={colors.ink} /> : k}
              a11y={k === 'del' ? 'Delete' : k}
              onPress={() => (k === 'del' ? onBackspace() : onKey(k))}
              h={keyH} radius={16} fontSize={keyH < 54 ? 22 : 26}
            />
          </View>
        ),
      )}
    </View>
  );
}

/** Smallest width a letter key may have (touch + legibility). */
export const LETTER_KEY_MIN_W = 28;

/**
 * How the letter pad lays out in a container `width` pt wide: QWERTY (10-key rows) while those keys stay at least
 * LETTER_KEY_MIN_W wide, else 8-key rows (digits, then the 23 usable letters alphabetically, inert keys dropped).
 * 360 pt phones keep QWERTY by tightening the gap to 4; 320 pt phones get the 8-key rows (31 pt keys).
 */
export function letterKeypadPlan(width: number): { compact: boolean; gap: number; keyW: number } {
  const gap = width >= 345 ? 5 : 4;
  const qwertyKeyW = (width - 9 * gap) / 10;
  if (qwertyKeyW >= LETTER_KEY_MIN_W) return { compact: false, gap, keyW: qwertyKeyW };
  return { compact: true, gap: 4, keyW: (width - 7 * 4) / 8 };
}

/**
 * Pad for crew/ride codes (demo `jKey`, plus a 2–9 row because codes contain digits). I, L and O never appear in codes,
 * so those keys are inert in the QWERTY layout.
 */
export function LetterKeypad({ onKey, onBackspace, disabled = 'OIL' }: { onKey: (k: string) => void; onBackspace: () => void; disabled?: string }) {
  const { colors } = useTheme();
  const { width: windowW, gutter } = useResponsive();
  // The pad's own width once laid out; until then the window minus the screen gutters (the column on tablets is <= 560).
  const [measured, setMeasured] = React.useState(0);
  const width = measured || Math.min(windowW, 560) - 2 * gutter;
  const plan = letterKeypadPlan(width);
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter((k) => !disabled.includes(k)).join('');
  const rows = plan.compact ? ['23456789', letters.slice(0, 8), letters.slice(8, 16), letters.slice(16)] : ['23456789', 'QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
  return (
    <View style={{ gap: 7 }} testID="letter-keypad" onLayout={(e) => setMeasured(Math.round(e.nativeEvent.layout.width))}>
      {rows.map((row, ri) => (
        <View key={row} style={{ flexDirection: 'row', gap: plan.gap, justifyContent: 'center' }}>
          {row.split('').map((k) => (
            <View key={k} style={{ flex: 1, maxWidth: plan.compact ? 44 : 38, opacity: disabled.includes(k) ? 0.3 : 1 }}>
              <KeyBtn label={k} a11y={k} testID={`letter-key-${k}`} onPress={() => !disabled.includes(k) && onKey(k)} h={48} radius={9} fontSize={17} />
            </View>
          ))}
          {ri === rows.length - 1 ? (
            <View style={{ flex: 1.6, maxWidth: plan.compact ? 64 : 58 }}>
              <KeyBtn label={<Icon name="back" size={20} color={colors.ink} />} a11y="Delete" testID="letter-key-delete" onPress={onBackspace} h={48} radius={9} fontSize={17} soft />
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}
