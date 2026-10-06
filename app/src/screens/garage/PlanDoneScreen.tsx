/**
 * PlanDone — "Ride created" (demo `plan-done`): the green plate, the ride ticket, and the invite code
 * (the crew's join code when the ride belongs to a crew, otherwise the ride's own) with Copy / Share.
 * "Back to rides" resets to the garage tabs.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { BackHandler, Share, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import type { StackScreenProps } from '@react-navigation/stack';
import TicketMap from './parts/TicketMap';
import type { RootStackParamList } from '../../navigation/types';
import type { Ride } from '../../models/domain';
import { routeStatsOf, subscribeRide } from '../../services/rideService';
import { useCrewsStore } from '../../store/crewsStore';
import { usePlanDraftStore } from '../../store/planDraftStore';
import { usePrefsStore } from '../../store/prefsStore';
import { useToastStore } from '../../store/toastStore';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import { Button, Card, Icon, Plate, Screen, Skeleton, Ticket } from '../../ui';
import { whenLabel } from '../../utils/planWhen';
import { planPointsOf } from '../../utils/ridePoints';
import { formatDistance } from '../../utils/units';

type Props = StackScreenProps<RootStackParamList, 'PlanDone'>;

export default function PlanDoneScreen({ navigation, route }: Props) {
  const { colors, type } = useTheme();
  const styles = useStyles(({ colors: c, type: t }) => ({
    ticketGap: { marginTop: 24 },
    codeCard: { marginTop: 16, alignItems: 'center' },
    code: { ...t.num, fontSize: 38, lineHeight: 42, letterSpacing: 5.3, marginTop: 8 },
    btns: { flexDirection: 'row', gap: 8, marginTop: 16, alignSelf: 'stretch' },
    err: { ...t.sm, color: c.bad, marginTop: 8 },
  }));
  const { rideId } = route.params;
  const units = usePrefsStore((s) => s.prefs.units);
  const crews = useCrewsStore((s) => s.crews);
  const push = useToastStore((s) => s.push);
  const [ride, setRide] = useState<Ride | null>(null);
  const [missing, setMissing] = useState(false);
  const [now] = useState(() => new Date());

  useEffect(() => {
    return subscribeRide(
      rideId,
      (r) => {
        setRide(r);
        setMissing(r == null);
      },
      () => setMissing(true),
    );
  }, [rideId]);

  const finish = React.useCallback(() => {
    usePlanDraftStore.getState().reset();
    navigation.reset({ index: 0, routes: [{ name: 'GarageTabs' }] });
  }, [navigation]);

  // The ride is created: Android back goes to the rides list, not back into the planner.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      finish();
      return true;
    });
    return () => sub.remove();
  }, [finish]);

  const crew = ride?.crew_id ? crews.find((c) => c.id === ride.crew_id) ?? null : null;
  const code = crew?.join_code ?? ride?.join_code ?? null;
  const points = useMemo(() => (ride ? planPointsOf(ride) : []), [ride]);
  const stats = ride ? routeStatsOf(ride) : null;

  const copy = () => {
    if (!code) return;
    Clipboard.setString(code);
    push('Code copied', 'success');
  };
  const share = async () => {
    if (!code || !ride) return;
    try {
      await Share.share({ message: `Join “${ride.name}” on WeRide. Use code ${code}.` });
    } catch {
      push('Could not open sharing', 'error');
    }
  };

  const sub = [
    ride?.start_time_ms ? whenLabel(ride.start_time_ms, now) : null,
    stats ? formatDistance(stats.distance_km, units) : null,
    crew?.name ?? null,
  ].filter(Boolean).join(' · ');

  return (
    <Screen testID="screen-PlanDone" cta={<Button label="Back to rides" onPress={finish} testID="back-to-rides" />}>
      <View style={{ height: 30 }} />
      <Plate
        tone="green"
        title="Ride created"
        subtitle={crew ? 'Your crew will see it in Rides' : 'Share the code to invite riders'}
        style={{ marginTop: 24 }}
        testID="done-plate"
      />

      {ride ? (
        <Ticket style={styles.ticketGap} header={points.length > 0 ? <TicketMap points={points} height={158} /> : undefined} testID="done-ticket">
          <Text style={type.h2}>{ride.name}</Text>
          {sub ? <Text style={[type.sm, { marginTop: 8 }]}>{sub}</Text> : null}
        </Ticket>
      ) : missing ? (
        <Text style={[type.sm, { marginTop: 24 }]} accessibilityLiveRegion="polite">
          Your ride was created, but we can’t show it right now. It will appear in Rides.
        </Text>
      ) : (
        <Skeleton height={120} radius={26} style={styles.ticketGap} />
      )}

      {code ? (
        <Card style={styles.codeCard} testID="invite-card">
          <Text style={type.label}>INVITE CODE</Text>
          <Text style={styles.code} accessibilityLabel={`Invite code ${code.split('').join(' ')}`} testID="invite-code">{code}</Text>
          <View style={styles.btns}>
            <Button label="Copy" variant="soft" size="sm" onPress={copy} leading={<Icon name="copy" size={18} color={colors.ink} />} style={{ flex: 1 }} testID="copy-code" />
            <Button label="Share" variant="soft" size="sm" onPress={share} leading={<Icon name="share" size={18} color={colors.ink} />} style={{ flex: 1 }} testID="share-code" />
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}
