/**
 * CrewStart — the last first-launch step (demo `crew-start`): "Join with a code" opens Join, "Start a crew" opens
 * the NewCrewSheet (creates a real crew + code). Creating a crew marks the rider onboarded and opens the Garage.
 * (The demo's GHOST7 shortcut is not shipped.)
 */
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { Card, Icon, IconWell, PressableScale, Screen, TopBar } from '../../ui';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import NewCrewSheet from '../../sheets/NewCrewSheet';
import { currentPhoneNumber } from '../../services/authService';
import { useCrewsStore } from '../../store/crewsStore';
import { usePrefsStore } from '../../store/prefsStore';

export default function CrewStartScreen({ navigation }: any) {
  const { colors, type } = useTheme();
  const s = useStyles(() => ({ cards: { gap: 12, marginTop: 32 }, row: { flexDirection: 'row', alignItems: 'center', gap: 14 } }));
  const [sheet, setSheet] = useState(false);
  const setOnboarded = usePrefsStore((st) => st.setOnboarded);
  const onboarded = usePrefsStore((st) => st.onboarded);
  const crewCount = useCrewsStore((st) => st.crews.length);

  const toGarage = () => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'GarageTabs' }] }));

  const onCreated = async (_crewId: string) => {
    setSheet(false);
    try {
      await setOnboarded(true, currentPhoneNumber() ?? undefined);
    } catch {
      // The flag is already set on this device; Firestore catches up when the connection returns.
    }
    toGarage();
  };

  // Joining a crew from the Join screen leaves this screen underneath: that also completes onboarding.
  useEffect(() => {
    if (crewCount > 0 && !onboarded) setOnboarded(true, currentPhoneNumber() ?? undefined).catch(() => undefined);
  }, [crewCount, onboarded, setOnboarded]);

  return (
    <View style={{ flex: 1 }} testID="screen-CrewStart">
      <Screen>
        <TopBar back={false} />
        <Text style={type.label}>YOU'RE IN</Text>
        <Text style={[type.h1, { marginTop: 12 }]} accessibilityRole="header">Now find{'\n'}your crew.</Text>
        <View style={s.cards}>
          <PressableScale onPress={() => navigation.navigate('Join')} scaleTo={0.985} accessibilityRole="button" accessibilityLabel="Join with a code. A friend sent you six characters or a QR." testID="join-with-code">
            <Card>
              <View style={s.row}>
                <IconWell icon="qr" accent size={44} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={type.h3}>Join with a code</Text>
                  <Text style={[type.sm, { marginTop: 8 }]}>A friend sent you six characters or a QR.</Text>
                </View>
                <Icon name="chev" size={22} color={colors.ink3} />
              </View>
            </Card>
          </PressableScale>
          <PressableScale onPress={() => setSheet(true)} scaleTo={0.985} accessibilityRole="button" accessibilityLabel="Start a crew. Name it, get a code, invite your people." testID="start-crew">
            <Card>
              <View style={s.row}>
                <IconWell icon="plus" size={44} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={type.h3}>Start a crew</Text>
                  <Text style={[type.sm, { marginTop: 8 }]}>Name it, get a code, invite your people.</Text>
                </View>
                <Icon name="chev" size={22} color={colors.ink3} />
              </View>
            </Card>
          </PressableScale>
        </View>
      </Screen>
      <NewCrewSheet visible={sheet} onClose={() => setSheet(false)} onCreated={onCreated} />
    </View>
  );
}
