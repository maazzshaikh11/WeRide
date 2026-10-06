/**
 * Privacy — Privacy & learning (docs/DEMO_PARITY_SPEC.md §3). The "Improve ETAs for everyone" toggle really gates
 * federated-learning participation (services/flService.ts); the status line is shown only when this phone has
 * logged a real round. "Crew + family" is disabled: there is no family backend.
 */
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Card, Icon, IconWell, List, ListItem, PressableScale, SectionLabel, Toggle } from '../../ui';
import type { IconName } from '../../ui';
import { withAlpha } from '../../theme/palettes';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import { usePrefsStore } from '../../store/prefsStore';
import { flStatusLine } from '../../services/flService';
import SubScreen, { NavLike } from './parts/SubScreen';

const FLOW: { icon: IconName; title: string; sub: string }[] = [
  { icon: 'phone', title: 'Your phone', sub: 'Learns from your rides' },
  { icon: 'lock', title: 'Masked update', sub: 'Numbers only. No routes.' },
  { icon: 'crews', title: 'Shared model', sub: 'Better ETAs for all' },
];

function Dot({ color }: { color: string }) {
  return (
    <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(color, 0.28) }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: color }} />
    </View>
  );
}

export default function PrivacyScreen({ navigation }: { navigation?: NavLike }) {
  const { colors, type } = useTheme();
  const learn = usePrefsStore((s) => s.prefs.learn);
  const setPref = usePrefsStore((s) => s.setPref);
  const status = useMemo(() => (learn ? flStatusLine() : null), [learn]);
  const s = useStyles(({ colors: c }) => ({
    track: { flexDirection: 'row', padding: 4, gap: 2, borderRadius: 16, backgroundColor: c.card2, borderWidth: 1.5, borderColor: c.line },
    seg: { flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  }));

  const learnSub = !learn
    ? 'Off. Nothing is shared for learning.'
    : status ?? 'Shares masked numbers only, never routes';

  return (
    <SubScreen title={'Privacy &\nlearning'} navigation={navigation} testID="screen-Privacy">
      <Text style={[type.body, { marginTop: 12 }]}>
        The app learns from everyone without seeing anyone: only masked numbers leave your phone, never your routes.
        Your live position goes to your crew during a ride, and to nobody else.
      </Text>

      <Card style={{ marginTop: 24 }} testID="privacy-diagram">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          {FLOW.map((f, k) => (
            <React.Fragment key={f.title}>
              {k ? <View style={{ marginTop: 12 }}><Icon name="chev" size={18} color={colors.ink3} /></View> : null}
              <View style={{ width: '30%', alignItems: 'center' }}>
                <IconWell icon={f.icon} accent={k === 1} size={42} />
                <Text style={[type.h3, { fontSize: 14, lineHeight: 17, marginTop: 8, textAlign: 'center' }]}>{f.title}</Text>
                <Text style={[type.sm, { fontSize: 12, lineHeight: 15, textAlign: 'center' }]}>{f.sub}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      </Card>

      <List style={{ marginTop: 16 }}>
        <ListItem
          first
          title="Improve ETAs for everyone"
          subtitle={learnSub}
          right={<Toggle value={learn} onChange={(v) => setPref('learn', v)} accessibilityLabel="Improve ETAs for everyone" testID="toggle-learn" />}
        />
      </List>

      <SectionLabel>Who sees my live position</SectionLabel>
      <View style={s.track} accessibilityRole="radiogroup" testID="seg-share">
        <PressableScale
          haptic="select"
          scaleTo={0.97}
          accessibilityRole="radio"
          accessibilityState={{ selected: true }}
          accessibilityLabel="Crew only"
          style={[s.seg, { backgroundColor: colors.ink }]}
          testID="share-crew"
        >
          <Text style={[type.seg, { color: colors.bg }]} numberOfLines={1}>Crew only</Text>
        </PressableScale>
        <View
          accessible
          accessibilityRole="radio"
          accessibilityState={{ selected: false, disabled: true }}
          accessibilityLabel="Crew plus family. Not available yet."
          style={[s.seg, { opacity: 0.45 }]}
          testID="share-family"
        >
          <Text style={[type.seg, { color: colors.ink2 }]} numberOfLines={1}>Crew + family</Text>
        </View>
      </View>
      <Text style={[type.sm, { marginTop: 8 }]}>Crew + family: not available yet.</Text>

      <SectionLabel>How we know a dot is real</SectionLabel>
      <Card testID="privacy-legend">
        <View style={{ gap: 12 }}>
          {[
            { c: colors.ok, t: 'Verified', d: 'Position agrees with motion sensors' },
            { c: colors.pri, t: 'Stale', d: 'No update for 10 s or more' },
            { c: colors.bad, t: 'Unverified', d: 'Jumps that physics can’t explain; we flag it' },
          ].map((r) => (
            <View key={r.t} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Dot color={r.c} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[type.h3, { fontSize: 15, lineHeight: 18 }]}>{r.t}</Text>
                <Text style={type.sm}>{r.d}</Text>
              </View>
            </View>
          ))}
        </View>
      </Card>
    </SubScreen>
  );
}
