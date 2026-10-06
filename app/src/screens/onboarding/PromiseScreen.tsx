/**
 * Promise — the three proofs (demo `promise`): dark, logo + wordmark, the headline, and the dashed rail with
 * rotated-square numbers. "Get started" / "I have a crew code" both lead to sign-in (the crew code is typed after
 * sign-in); a rider who is already signed in (also: Me → Replay onboarding) goes straight to Profile.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { Button, Screen } from '../../ui';
import { Plates } from '../../theme/palettes';
import { useScaleBy } from '../../theme/responsive';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import { useSessionStore } from '../../store/sessionStore';
import DarkScope from './parts/DarkScope';
import { VerticalDashes } from './parts/DashedLine';
import LogoTile from './parts/LogoTile';

export const PROOFS = [
  { n: '1', title: 'See the whole crew at a glance', body: 'One status plate says if the group is together. No squinting at dots.' },
  { n: '2', title: 'Hazards reach you first', body: 'Potholes and spills your crew reports show up 500 m before you do.' },
  { n: '3', title: 'An SOS that works with no signal', body: 'Hard to trigger by accident. Impossible to miss when it matters.' },
] as const;

function PromiseBody({ navigation }: { navigation: { navigate: (name: 'AuthPhone' | 'Profile') => void } }) {
  const { colors, type } = useTheme();
  const sz = useScaleBy();
  const uid = useSessionStore((s) => s.uid);
  const s = useStyles(({ type: t }) => ({
    brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    rail: { position: 'relative', marginTop: 34, paddingLeft: 58 },
    item: { position: 'relative', marginBottom: 26 },
    num: {
      position: 'absolute', left: -58, top: 0, width: 44, height: 44, borderRadius: 12, backgroundColor: Plates.yellow.bg,
      borderWidth: 2, borderColor: Plates.yellow.fg, alignItems: 'center', justifyContent: 'center',
      transform: [{ rotate: '45deg' }, { scale: 0.82 }],
    },
    numText: { ...t.num, fontFamily: t.display.fontFamily, fontSize: 20, lineHeight: 24, color: Plates.yellow.fg, transform: [{ rotate: '-45deg' }] },
  }));
  const go = () => navigation.navigate(uid ? 'Profile' : 'AuthPhone');

  return (
    <Screen
      testID="screen-Promise"
      contentStyle={{ paddingTop: 64 }}
      cta={
        <View>
          <Button label="Get started" onPress={go} testID="promise-start" />
          <Button label="I have a crew code" variant="ghost" onPress={go} style={{ marginTop: 10 }} testID="promise-code" />
        </View>
      }
    >
      <View style={s.brand}>
        <LogoTile size={34} />
        <Text style={[type.h3, { letterSpacing: -0.34 }]}>WeRide</Text>
      </View>
      <Text style={[type.display, { marginTop: 34, fontSize: sz(44), lineHeight: sz(44), letterSpacing: -sz(44) * 0.035 }]} accessibilityRole="header">
        Ride together.{'\n'}
        <Text style={{ color: colors.pri }}>Everyone home.</Text>
      </Text>
      <View style={s.rail}>
        <VerticalDashes color={Plates.yellow.bg} style={{ position: 'absolute', left: 21, top: 14, bottom: 20 }} />
        {PROOFS.map((p) => (
          <View key={p.n} style={s.item} accessible accessibilityLabel={`${p.n}. ${p.title}. ${p.body}`}>
            <View style={s.num}>
              <Text style={s.numText}>{p.n}</Text>
            </View>
            <Text style={type.h3}>{p.title}</Text>
            <Text style={[type.sm, { marginTop: 5 }]}>{p.body}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

export default function PromiseScreen(props: any) {
  return (
    <DarkScope>
      <PromiseBody navigation={props.navigation} />
    </DarkScope>
  );
}
