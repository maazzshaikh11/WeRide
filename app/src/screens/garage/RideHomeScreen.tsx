/**
 * RideHome — the Ride tab (demo `REG.home`, docs/DEMO_PARITY_SPEC.md §3): date + greeting + avatar, weather,
 * a hero for the rider's next ride (by status), route intel, other upcoming rides, "Where next?" and the
 * crew pulse. Everything comes from the rider's real rides / profiles / hazard clusters; sections with no
 * data are left out.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { GarageTabParamList, RootStackParamList } from '../../navigation/types';
import type { Ride, RideLog, RsvpStatus } from '../../models/domain';
import { subscribeRideLogs } from '../../services/rideLogService';
import { setRideStatus, setRsvp, routeStatsOf } from '../../services/rideService';
import { useAppStore } from '../../store/appStore';
import { useCrewsStore } from '../../store/crewsStore';
import { usePlanDraftStore } from '../../store/planDraftStore';
import { usePrefsStore } from '../../store/prefsStore';
import { riderName, riderInitials, useProfileStore } from '../../store/profileStore';
import { useRidesStore } from '../../store/ridesStore';
import { resetRideSession } from '../../store/rideSession';
import { useSessionStore } from '../../store/sessionStore';
import { useToastStore } from '../../store/toastStore';
import { colorForUid } from './crew/CrewAvatars';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import { Avatar, Card, Chip, Icon, IconWell, List, ListItem, PressableScale, Screen, SectionLabel, Skeleton } from '../../ui';
import { intelSummary } from '../../utils/intel';
import { getMyPosition } from '../../utils/myPosition';
import { buildPulse } from '../../utils/pulse';
import { pastDestinations, pickNextRide, rideStartPlace, upcomingRides } from '../../utils/rideHero';
import { planPointsOf } from '../../utils/ridePoints';
import { greetingFor } from '../../utils/rides';
import { agoLabel, headerLabel, ticketWhen } from '../../utils/planWhen';
import { formatDistance } from '../../utils/units';
import { fetchWeather, Weather } from '../../utils/weather';
import IntelSheet from '../../sheets/IntelSheet';
import RideInfoSheet from '../../sheets/RideInfoSheet';
import RideHero, { EmptyHero } from './parts/RideHero';
import HeroButton from './parts/HeroButton';
import WeatherCard from './parts/WeatherCard';
import { useActiveClusters } from './parts/useActiveClusters';
import { useRideDocs } from './parts/useRideDocs';

type Props = CompositeScreenProps<BottomTabScreenProps<GarageTabParamList, 'Ride'>, StackScreenProps<RootStackParamList>>;

const TICK_MS = 30_000;

/** Re-renders on a timer so "IN 49 MIN" and the header clock stay true. */
function useNow(intervalMs = TICK_MS): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function RideHomeScreen({ navigation }: Props) {
  const { colors, type } = useTheme();
  const styles = useStyles(({ colors: c, type: t }) => ({
    head: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    headText: { flex: 1, minWidth: 0 },
    greeting: { ...t.h1, marginTop: 8 },
    avatarBtn: { width: 56, height: 56, borderRadius: 28 },
    intelRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
    intelText: { flex: 1, minWidth: 0 },
    intelBody: { ...t.sm, marginTop: 8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    pulse: { gap: 12 },
    pulseRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    pulseText: { ...t.smStrong, flex: 1 },
    pulseWhen: { ...t.sm },
    link: { ...t.smStrong, textDecorationLine: 'underline', textDecorationColor: c.pri, textDecorationStyle: 'solid' },
  }));

  const uid = useSessionStore((s) => s.uid);
  const units = usePrefsStore((s) => s.prefs.units);
  const { rides, loaded, error } = useRidesStore();
  const crews = useCrewsStore((s) => s.crews);
  const me = useProfileStore((s) => s.me);
  const byId = useProfileStore((s) => s.byId);
  const ensure = useProfileStore((s) => s.ensure);
  const push = useToastStore((s) => s.push);
  const now = useNow();

  // The rider's own ride logs: a finished ride only leads once there is a recap to open.
  const [logs, setLogs] = useState<RideLog[]>([]);
  useEffect(() => {
    if (!uid) return undefined;
    return subscribeRideLogs(uid, setLogs, () => undefined);
  }, [uid]);
  const logIds = useMemo(() => new Set(logs.map((l) => l.ride_id)), [logs]);

  const ride = useMemo(() => pickNextRide(rides, now, logIds), [rides, now, logIds]);
  const others = useMemo(() => upcomingRides(rides, now, ride?.id), [rides, now, ride?.id]);
  const chips = useMemo(() => pastDestinations(rides, logs), [rides, logs]);
  const crew = ride?.crew_id ? crews.find((c) => c.id === ride.crew_id) ?? null : null;
  const docs = useRideDocs(ride?.id ?? null);
  const clusters = useActiveClusters(ride ? [ride.id] : []);
  const rideStats = ride ? routeStatsOf(ride) : null;
  const intel = useMemo(() => intelSummary(clusters, rideStats?.safety_score ?? null), [clusters, rideStats]);

  // Profiles for everyone in the next ride and the people in the pulse.
  useEffect(() => {
    void ensure(ride?.member_ids ?? []);
  }, [ride, ensure]);

  // Weather at the next ride's start, else where the rider is. Hidden if anything fails.
  const [weather, setWeather] = useState<Weather | null>(null);
  const startPlace = ride ? rideStartPlace(ride) : null;
  const wLat = startPlace?.lat;
  const wLng = startPlace?.lng;
  useEffect(() => {
    let alive = true;
    (async () => {
      const at = wLat != null && wLng != null ? { lat: wLat, lng: wLng } : await getMyPosition();
      const w = at ? await fetchWeather(at.lat, at.lng) : null;
      if (alive) setWeather(w);
    })().catch(() => alive && setWeather(null));
    return () => {
      alive = false;
    };
  }, [wLat, wLng]);

  const [intelOpen, setIntelOpen] = useState(false);
  const [infoRide, setInfoRide] = useState<Ride | null>(null);

  // ── actions ──
  const enterRide = useCallback(
    (r: Ride, fresh: boolean) => {
      if (fresh || useAppStore.getState().groupId !== r.id) {
        resetRideSession();
        useAppStore.getState().setGroupId(r.id);
      }
    },
    [],
  );
  const fail = useCallback((what: string) => () => push(`${what}. Check your connection and try again.`, 'error'), [push]);

  const onRsvp = (s: RsvpStatus) => {
    if (!ride || !uid) return;
    setRsvp(ride.id, uid, s).catch(fail('Could not save your answer'));
    push(s === 'going' ? 'You’re going' : s === 'maybe' ? 'Marked maybe' : 'Marked can’t make it', s === 'going' ? 'success' : 'info');
  };
  const onGoMeetup = () => {
    if (!ride) return;
    if (ride.status === 'planned') setRideStatus(ride.id, 'meetup').catch(fail('Could not open the meetup'));
    enterRide(ride, true);
    navigation.navigate('Meetup', { groupId: ride.id });
  };
  const onRollCall = () => {
    if (!ride) return;
    enterRide(ride, true);
    navigation.navigate('Meetup', { groupId: ride.id });
  };
  const onRejoin = () => {
    if (!ride) return;
    enterRide(ride, false);
    navigation.navigate('Live', { groupId: ride.id });
  };
  const onRecap = () => ride && navigation.navigate('Recap', { rideId: ride.id });
  const planFresh = () => {
    usePlanDraftStore.getState().reset();
    navigation.navigate('PlanWhere');
  };
  const replan = (d: { label: string; lat: number; lng: number }) => {
    usePlanDraftStore.getState().prefill({ label: d.label, lat: d.lat, lng: d.lng });
    navigation.navigate('PlanRoute');
  };

  // ── crew pulse (the hero ride) ──
  const pulse = useMemo(
    () => buildPulse(docs, (u) => riderName(byId, u, uid).split(' ')[0], uid),
    [docs, byId, uid],
  );
  useEffect(() => {
    void ensure(pulse.map((p) => p.uid));
  }, [pulse, ensure]);

  const heroState = ride?.status;
  const greeting = heroState === 'live' ? 'Ride on.' : heroState === 'finished' ? 'Back safe.' : `${greetingFor(new Date(now))}.`;
  const firstName = (me?.name ?? '').trim().split(/\s+/)[0] || 'rider';
  const myInitials = uid ? riderInitials(byId, uid) : '';

  return (
    <View style={{ flex: 1 }}>
    <Screen tabs testID="screen-RideHome">
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={type.label}>{headerLabel(new Date(now))}</Text>
          <Text style={styles.greeting} accessibilityRole="header">{greeting}</Text>
        </View>
        <PressableScale
          onPress={() => navigation.navigate('Me')}
          haptic="tap"
          accessibilityRole="button"
          accessibilityLabel="Me"
          style={styles.avatarBtn}
          testID="home-avatar"
        >
          <Avatar initials={myInitials} me size={56} ring={false} />
        </PressableScale>
      </View>

      {weather ? <WeatherCard weather={weather} units={units} /> : null}

      <View style={{ marginTop: 16 }}>
        {!loaded ? (
          <Skeleton height={300} radius={26} />
        ) : ride ? (
          <RideHero
            ride={ride}
            now={now}
            uid={uid}
            units={units}
            crew={crew}
            docs={docs}
            log={logs.find((l) => l.ride_id === ride.id) ?? null}
            firstName={firstName}
            onRsvp={onRsvp}
            onGoMeetup={onGoMeetup}
            onRollCall={onRollCall}
            onRejoin={onRejoin}
            onRecap={onRecap}
          />
        ) : (
          <EmptyHero onPlan={planFresh} onJoin={() => navigation.navigate('Join')} error={error} />
        )}
      </View>

      {ride && ride.status !== 'finished' ? (
        <>
          <SectionLabel right={<PressableScale onPress={() => setIntelOpen(true)} hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel="View route intel"><Text style={styles.link}>View</Text></PressableScale>}>
            Route intel
          </SectionLabel>
          <PressableScale
            onPress={() => setIntelOpen(true)}
            haptic="select"
            accessibilityRole="button"
            accessibilityLabel={`${intel.title}. ${intel.body}`}
            testID="intel-card"
          >
            <Card>
              <View style={styles.intelRow}>
                <IconWell icon="haz" />
                <View style={styles.intelText}>
                  <Text style={type.h3}>{intel.title}</Text>
                  <Text style={styles.intelBody}>{intel.body}</Text>
                </View>
              </View>
            </Card>
          </PressableScale>
        </>
      ) : null}

      {others.length > 0 ? (
        <>
          <SectionLabel>Also coming up</SectionLabel>
          <List>
            {others.map((r, i) => {
              const st = routeStatsOf(r);
              const sub = [r.start_time_ms ? ticketWhen(r.start_time_ms) : null, st ? formatDistance(st.distance_km, units) : null, `${r.member_ids.length} ${r.member_ids.length === 1 ? 'rider' : 'riders'}`]
                .filter(Boolean)
                .join(' ∙ ');
              return <ListItem key={r.id} first={i === 0} icon="route" title={r.name} subtitle={sub} onPress={() => setInfoRide(r)} testID={`upcoming-${r.id}`} />;
            })}
          </List>
        </>
      ) : null}

      <SectionLabel>Where next?</SectionLabel>
      <HeroButton label="Plan a ride" variant="dark" leadingIcon="plus" onPress={planFresh} testID="plan-a-ride" />
      {chips.length > 0 ? (
        <View style={styles.chips}>
          {chips.map((c) => (
            <Chip key={c.short} label={c.short} icon={<Icon name="flag" size={16} color={colors.ink} />} onPress={() => replan(c)} testID={`chip-${c.short}`} />
          ))}
        </View>
      ) : null}

      {pulse.length > 0 ? (
        <>
          <SectionLabel>Crew pulse</SectionLabel>
          <View style={styles.pulse} testID="crew-pulse">
            {pulse.map((p) => (
              <View key={p.key} style={styles.pulseRow}>
                <Avatar size={28} initials={riderInitials(byId, p.uid)} color={colorForUid(p.uid)} />
                <Text style={styles.pulseText} numberOfLines={2}>{p.text}</Text>
                <Text style={styles.pulseWhen}>{agoLabel(p.at, now)}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

    </Screen>
      <IntelSheet
        visible={intelOpen}
        onClose={() => setIntelOpen(false)}
        clusters={clusters}
        path={ride ? (rideStats?.path ?? planPointsOf(ride)) : []}
        safety={rideStats?.safety_score ?? null}
        now={now}
      />
      <RideInfoSheet visible={infoRide != null} onClose={() => setInfoRide(null)} ride={infoRide} />
    </View>
  );
}
