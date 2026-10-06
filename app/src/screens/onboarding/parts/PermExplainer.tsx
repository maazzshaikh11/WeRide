/**
 * PermExplainer — the demo's in-app permission prompt (`A.perm`): what the OS is about to ask and why, shown
 * BEFORE the real system dialog. Location offers Always / While using / Not now, the others Allow / Not now.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from '../../../ui';
import { useStyles } from '../../../theme/ThemeProvider';
import type { PermKind } from '../../../services/permissionsService';

export type ExplainerChoice = 'always' | 'while' | 'allow' | 'no';

export const EXPLAINER_COPY: Record<PermKind, { title: string; body: string }> = {
  location: { title: 'Allow WeRide to use your location?', body: 'Crew tracking works best with “Always”. You can change this in Settings.' },
  notifications: { title: 'WeRide would like to send you notifications', body: 'Alerts may include sounds and critical SOS alerts.' },
  microphone: { title: 'WeRide would like to access the microphone', body: 'Used only while you hold the talk button.' },
};

export default function PermExplainer({ kind, onChoose }: { kind: PermKind; onChoose: (c: ExplainerChoice) => void }) {
  const s = useStyles(({ colors: c, type: t }) => ({
    scrim: { ...StyleSheet.absoluteFillObject, zIndex: 100, backgroundColor: c.scrim, alignItems: 'center', justifyContent: 'center', padding: 34 },
    box: { width: '100%', backgroundColor: c.card, borderRadius: 22, overflow: 'hidden', borderWidth: 1.5, borderColor: c.line },
    head: { paddingTop: 22, paddingHorizontal: 20, paddingBottom: 18, alignItems: 'center' },
    title: { ...t.h3, fontSize: 17, textAlign: 'center' },
    body: { ...t.sm, marginTop: 6, textAlign: 'center' },
    btn: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1.5, borderTopColor: c.line, paddingHorizontal: 12 },
    btnText: { ...t.button, fontSize: 17 },
  }));
  const { title, body } = EXPLAINER_COPY[kind];
  const choices: { v: ExplainerChoice; label: string }[] =
    kind === 'location'
      ? [{ v: 'always', label: 'Allow Always' }, { v: 'while', label: 'Allow While Using' }, { v: 'no', label: 'Not now' }]
      : [{ v: 'allow', label: 'Allow' }, { v: 'no', label: 'Not now' }];
  return (
    <View style={s.scrim} testID="perm-explainer" accessibilityViewIsModal>
      <View style={s.box} accessible={false}>
        <View style={s.head}>
          <Text style={s.title} accessibilityRole="header">{title}</Text>
          <Text style={s.body}>{body}</Text>
        </View>
        {choices.map((c) => (
          <PressableScale
            key={c.v}
            style={s.btn}
            onPress={() => onChoose(c.v)}
            haptic="select"
            scaleTo={0.99}
            accessibilityRole="button"
            accessibilityLabel={c.label}
            testID={`explainer-${c.v}`}
          >
            <ExplainerLabel text={c.label} tone={c.v === 'no' ? 'no' : c.v === 'always' || c.v === 'allow' ? 'main' : 'alt'} style={s.btnText} />
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

function ExplainerLabel({ text, tone, style }: { text: string; tone: 'main' | 'alt' | 'no'; style: object }) {
  const s = useStyles(({ colors: c }) => ({ main: { color: c.blue }, alt: { color: c.blue, opacity: 0.9 }, no: { color: c.bad } }));
  return <Text style={[style, s[tone]]}>{text}</Text>;
}
