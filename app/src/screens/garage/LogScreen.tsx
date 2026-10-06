/**
 * Log tab (demo `log`): the season so far from the rider's own ride logs: big km total, rides and hours, the
 * last-8-weeks bar chart, and a card per ride (sketch of the recorded track, name, date ∙ distance ∙ time, together %).
 */
import React, { useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RideLog } from '../../models/domain';
import type { GarageTabParamList, RootStackParamList } from '../../navigation/types';
import { useRideLogsStore } from '../../store/rideLogsStore';
import { usePrefsStore } from '../../store/prefsStore';
import { useSessionStore } from '../../store/sessionStore';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import { Bars, Card, CenterLine, FadeIn, MapSketch, PressableScale, Screen, SectionLabel, Skeleton, pointsFromFlat } from '../../ui';
import { formatHours, formatRideDate, hasTogetherData, logTotals, seasonLabel, weeklyKm } from '../../utils/logStats';
import { distanceUnit, formatDistance, formatDuration, toUnitDistance } from '../../utils/units';

type Props = CompositeScreenProps<BottomTabScreenProps<GarageTabParamList, 'Log'>, StackScreenProps<RootStackParamList>>;

/** 1286 -> "1,286" (no Intl dependency). */
export function groupThousands(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function RideCard({ log, units, index, onPress }: { log: RideLog; units: 'km' | 'mi'; index: number; onPress: () => void }) {
  const { colors, type } = useTheme();
  const s = useStyles(({ colors: c }) => ({
    card: { backgroundColor: c.card, borderRadius: 22, borderWidth: 1.5, borderColor: c.line, overflow: 'hidden' },
    body: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16 },
  }));
  const points = useMemo(() => pointsFromFlat(log.track), [log.track]);
  const together = hasTogetherData(log);
  const pct = Math.round(log.together_pct);
  const date = formatRideDate(log.started_ms);
  const meta = [date, formatDistance(log.km, units), formatDuration(log.duration_s)].filter(Boolean).join(' ∙ ');
  return (
    <FadeIn index={index}>
      <PressableScale
        onPress={onPress}
        scaleTo={0.985}
        style={s.card}
        accessibilityRole="button"
        accessibilityLabel={`${log.name}. ${meta}. ${together ? `${pct} percent together` : 'No group data'}`}
        accessibilityHint="Opens the ride recap"
        testID={`log-card-${log.ride_id}`}
      >
        <MapSketch points={points} height={96} pad={22} />
        <View style={s.body}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={type.h3} numberOfLines={2}>{log.name}</Text>
            <Text style={[type.sm, { marginTop: 8 }]} numberOfLines={1}>{meta}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
            <Text style={[type.h2, { fontFamily: type.num.fontFamily, color: together && pct >= 90 ? colors.ok : colors.ink }]}>{together ? `${pct}%` : '—'}</Text>
            <Text style={[type.label, { marginTop: 4 }]}>TOGETHER</Text>
          </View>
        </View>
      </PressableScale>
    </FadeIn>
  );
}

function LogSkeleton() {
  return (
    <View testID="log-loading" accessibilityLabel="Loading your rides" accessibilityLiveRegion="polite">
      <Card style={{ marginTop: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Skeleton width={150} height={46} />
            <Skeleton width={110} height={11} style={{ marginTop: 10 }} />
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Skeleton width={80} height={22} />
            <Skeleton width={100} height={13} style={{ marginTop: 8 }} />
          </View>
        </View>
        <Skeleton height={74} radius={8} style={{ marginTop: 24, marginBottom: 22 }} />
      </Card>
      <View style={{ gap: 12, marginTop: 28 }}>
        {[0, 1].map((i) => (
          <Card key={i} pad={false} style={{ overflow: 'hidden' }}>
            <Skeleton height={96} radius={0} />
            <View style={{ padding: 16 }}>
              <Skeleton width="55%" height={18} />
              <Skeleton width="70%" height={13} style={{ marginTop: 10 }} />
            </View>
          </Card>
        ))}
      </View>
    </View>
  );
}

export default function LogScreen({ navigation }: Props) {
  const { type } = useTheme();
  const uid = useSessionStore((s) => s.uid);
  const units = usePrefsStore((s) => s.prefs.units);
  const logs = useRideLogsStore((s) => s.logs);
  const loaded = useRideLogsStore((s) => s.loaded);
  const error = useRideLogsStore((s) => s.error);
  const watch = useRideLogsStore((s) => s.watch);

  useEffect(() => (uid ? watch(uid) : undefined), [uid, watch]);

  const totals = useMemo(() => logTotals(logs), [logs]);
  const weeks = useMemo(() => {
    const w = weeklyKm(logs, Date.now());
    return { values: w.values.map((v) => toUnitDistance(v, units)), labels: w.labels };
  }, [logs, units]);
  const label = useMemo(() => seasonLabel(logs), [logs]);

  return (
    <Screen tabs testID="screen-Log">
      <Text style={type.label} testID="log-season">{label}</Text>
      <Text style={[type.h1, { marginTop: 8 }]} accessibilityRole="header">Your log</Text>

      {!loaded && uid ? (
        <LogSkeleton />
      ) : (
        <>
          <Card style={{ marginTop: 24 }} testID="log-totals">
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[type.statValue, { fontSize: 52, lineHeight: 47, letterSpacing: -2.6 }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                  testID="log-km"
                >
                  {groupThousands(toUnitDistance(totals.km, units))}
                </Text>
                <Text style={[type.label, { marginTop: 8 }]}>{`${distanceUnit(units)} this season`.toUpperCase()}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
                <Text style={[type.h2, { fontFamily: type.num.fontFamily }]} testID="log-rides">{`${totals.rides} ${totals.rides === 1 ? 'ride' : 'rides'}`}</Text>
                <Text style={[type.sm, { marginTop: 8 }]} testID="log-hours">{`${formatHours(totals.hours)} h on the road`}</Text>
              </View>
            </View>
            <View style={{ marginTop: 24 }}>
              <Bars values={weeks.values} labels={weeks.labels} />
            </View>
          </Card>

          <SectionLabel right={<Text style={type.sm}>{`${logs.length} logged`}</Text>}>Rides</SectionLabel>
          {logs.length > 0 ? (
            <View style={{ gap: 12 }}>
              {logs.map((l, i) => (
                <RideCard key={l.ride_id} log={l} units={units} index={i} onPress={() => navigation.navigate('Recap', { rideId: l.ride_id })} />
              ))}
            </View>
          ) : error ? (
            <Card testID="log-error">
              <Text style={type.h3} accessibilityLiveRegion="polite">Can't load your rides</Text>
              <Text style={[type.sm, { marginTop: 6 }]}>Check your connection. Your rides will appear here once you're back online.</Text>
            </Card>
          ) : (
            <Card testID="log-empty">
              <CenterLine dim />
              <Text style={[type.body, { marginTop: 16 }]}>No rides logged yet — your first ride will show up here</Text>
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
