/**
 * Display — Road screen & controls (docs/DEMO_PARITY_SPEC.md §3). Garage theme (Light/Dark/Auto) and theme
 * (Demo/Ember) live here too: they are the owner's theme picker. Road theme, glove mode and units are prefs.
 * Not built: "Spoken alerts" (no TTS engine) and "Preview Road screen".
 */
import React from 'react';
import { Text, View } from 'react-native';
import { CenterLine, List, ListItem, Rail, Segmented, Toggle } from '../../ui';
import { THEMES, THEME_IDS, THEME_LABELS, ThemeId, ThemePreference } from '../../theme/palettes';
import { useTheme } from '../../theme/ThemeProvider';
import { useThemeStore } from '../../theme/themeStore';
import { usePrefsStore } from '../../store/prefsStore';
import { useToastStore } from '../../store/toastStore';
import type { RoadTheme, Units } from '../../models/domain';
import SubScreen, { FieldLabel, NavLike } from './parts/SubScreen';

const GARAGE: readonly { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Auto' },
];
const THEME_OPTIONS = THEME_IDS.map((id) => ({ value: id, label: THEME_LABELS[id].name }));
const ROAD: readonly { value: RoadTheme; label: string }[] = [
  { value: 'night', label: 'Night' },
  { value: 'day', label: 'Day' },
  { value: 'auto', label: 'Sunset auto' },
];
const UNITS: readonly { value: Units; label: string }[] = [
  { value: 'km', label: 'Kilometres' },
  { value: 'mi', label: 'Miles' },
];

/** Three little chips (page, card, accent) of a theme in the scheme being shown. */
function Swatch({ id }: { id: ThemeId }) {
  const { scheme } = useTheme();
  const p = THEMES[id][scheme];
  return (
    <View testID={`swatch-${id}`} style={{ flexDirection: 'row', gap: 4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[p.bg, p.card, p.pri].map((c, i) => (
        <View key={i} style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: c, borderWidth: 1.5, borderColor: p.line2 }} />
      ))}
    </View>
  );
}

export default function DisplayScreen({ navigation }: { navigation?: NavLike }) {
  const { type } = useTheme();
  const mode = useThemeStore((s) => s.mode);
  const themeId = useThemeStore((s) => s.themeId);
  const setMode = useThemeStore((s) => s.setMode);
  const setThemeId = useThemeStore((s) => s.setThemeId);
  const prefs = usePrefsStore((s) => s.prefs);
  const setPref = usePrefsStore((s) => s.setPref);
  const push = useToastStore((s) => s.push);

  return (
    <SubScreen title={'Road screen\n& controls'} navigation={navigation} testID="screen-Display">
      <FieldLabel>Garage theme</FieldLabel>
      <Segmented options={GARAGE} value={mode} onChange={setMode} testID="seg-garage" />

      <FieldLabel>Theme</FieldLabel>
      <Segmented options={THEME_OPTIONS} value={themeId} onChange={setThemeId} testID="seg-theme" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <Swatch id={themeId} />
        <Text style={[type.sm, { flex: 1 }]}>{THEME_LABELS[themeId].blurb}</Text>
      </View>

      <FieldLabel>Road theme</FieldLabel>
      <Segmented options={ROAD} value={prefs.road} onChange={(v) => setPref('road', v)} testID="seg-road" />
      <Text style={[type.sm, { marginTop: 8 }]}>
        Night is pure black with yellow, the easiest read in low light. Day flips it so glare doesn't wash it out.
        Sunset auto switches at sunrise and sunset where you are.
      </Text>

      <List style={{ marginTop: 24 }}>
        <ListItem
          first
          title="Glove mode"
          subtitle="Bigger buttons on every Road screen control"
          right={
            <Toggle
              value={prefs.glove}
              onChange={(v) => {
                setPref('glove', v);
                push(v ? 'Glove mode on' : 'Glove mode off', 'success');
              }}
              accessibilityLabel="Glove mode"
              testID="toggle-glove"
            />
          }
        />
      </List>

      <FieldLabel>Units</FieldLabel>
      <Segmented options={UNITS} value={prefs.units} onChange={(v) => setPref('units', v)} testID="seg-units" />

      <CenterLine dim style={{ marginTop: 32 }} />
      <Text style={[type.h3, { marginTop: 24 }]} accessibilityRole="header">Design rules for the Road screen</Text>
      <View style={{ marginTop: 16 }}>
        <Rail
          items={[
            { title: 'Nothing under 24 pt', sub: 'Plus the speed, which is 120 pt.' },
            { title: 'No text entry, no scrolling', sub: 'Every control is a tap or a hold.' },
            { title: 'One question, one answer', sub: '“Is the group OK?” gets a single colour plate.' },
          ]}
        />
      </View>
    </SubScreen>
  );
}
