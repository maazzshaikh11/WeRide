/**
 * Settings — appearance: which theme (Demo / Ember) and whether to follow the
 * phone's light/dark setting or force one. Layout, type and spacing never change
 * with these choices; only colours do. Choices persist on the device.
 *
 * Layout follows demo.html's "Road screen & controls" screen: back chip, eyebrow,
 * H1, label + segmented control, rows.
 */
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';

import { Icon, PressableScale, Segmented } from '../ui';
import { THEME_IDS, THEME_LABELS, THEMES, ThemeId, ThemePreference, withAlpha } from '../theme/palettes';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import { useThemeStore } from '../theme/themeStore';
import { RootStackParamList } from '../navigation/RootStack';

type Nav = Pick<StackNavigationProp<RootStackParamList>, 'goBack'>;

const MODES: readonly { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

/** Little preview of a theme in the scheme currently shown: page, card, accent. */
function Swatch({ id }: { id: ThemeId }) {
  const { scheme } = useTheme();
  const p = THEMES[id][scheme];
  const s = useStyles(() => ({
    box: { width: 64, height: 44, borderRadius: 12, padding: 6, justifyContent: 'space-between' },
    card: { height: 14, borderRadius: 5 },
    accent: { height: 10, width: 28, borderRadius: 5 },
  }));
  return (
    <View testID={`swatch-${id}`} style={[s.box, { backgroundColor: p.bg, borderWidth: 1.5, borderColor: p.line2 }]}>
      <View style={[s.card, { backgroundColor: p.card, borderWidth: 1, borderColor: p.line }]} />
      <View style={[s.accent, { backgroundColor: p.pri }]} />
    </View>
  );
}

export default function SettingsScreen({ navigation }: { navigation?: Nav }) {
  const insets = useSafeAreaInsets();
  const { colors, type } = useTheme();
  const themeId = useThemeStore((s) => s.themeId);
  const mode = useThemeStore((s) => s.mode);
  const setThemeId = useThemeStore((s) => s.setThemeId);
  const setMode = useThemeStore((s) => s.setMode);

  const s = useStyles(({ colors: c }) => ({
    root: { flex: 1, backgroundColor: c.bg },
    content: { paddingHorizontal: 20, paddingBottom: 60 },
    back: {
      width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.card, borderWidth: 1.5, borderColor: c.line, marginBottom: 14,
    },
    gap8: { marginTop: 8 },
    cards: { gap: 10, marginTop: 8 },
    card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 22, backgroundColor: c.card, borderWidth: 1.5, borderColor: c.line },
    cardOn: { borderColor: c.ink, borderWidth: 3, padding: 12.5 },
    cardText: { flex: 1, minWidth: 0 },
    check: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  }));

  return (
    <View style={s.root} testID="settings-screen">
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 12 }]}>
        <PressableScale
          onPress={() => navigation?.goBack()}
          haptic="tap"
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={s.back}
        >
          <Icon name="back" size={22} />
        </PressableScale>
        <Text style={type.label}>SETTINGS</Text>
        <Text style={[type.h1, s.gap8]} accessibilityRole="header">{'Appearance'}</Text>

        <Text style={[type.label, { marginTop: 24 }]}>THEME</Text>
        <View style={s.cards} accessibilityRole="radiogroup">
          {THEME_IDS.map((id) => {
            const on = id === themeId;
            return (
              <PressableScale
                key={id}
                testID={`theme-${id}`}
                haptic="select"
                scaleTo={0.985}
                onPress={() => !on && setThemeId(id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${THEME_LABELS[id].name} theme. ${THEME_LABELS[id].blurb}`}
                style={[s.card, on && s.cardOn]}
              >
                <Swatch id={id} />
                <View style={s.cardText}>
                  <Text style={type.h3}>{THEME_LABELS[id].name}</Text>
                  <Text style={[type.sm, { marginTop: 2 }]}>{THEME_LABELS[id].blurb}</Text>
                </View>
                <View style={[s.check, { backgroundColor: on ? colors.ink : withAlpha(colors.ink, 0.08) }]}>
                  {on ? <Icon name="check" size={16} color={colors.bg} strokeWidth={3} /> : null}
                </View>
              </PressableScale>
            );
          })}
        </View>

        <Text style={[type.label, { marginTop: 24, marginBottom: 8 }]}>MODE</Text>
        <Segmented options={MODES} value={mode} onChange={setMode} testID="mode-segmented" />
        <Text style={[type.sm, s.gap8]}>
          {mode === 'system'
            ? 'Follows your phone: dark after sunset, light in the day, if you set it that way.'
            : mode === 'dark'
              ? 'Always dark, whatever the phone is set to.'
              : 'Always light, whatever the phone is set to.'}
        </Text>
      </ScrollView>
    </View>
  );
}
