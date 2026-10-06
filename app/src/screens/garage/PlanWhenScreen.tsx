/**
 * PlanWhen — step 3 of 3 (demo `plan-when`): day, roll-out time, who (members of the chosen crew), pace and
 * fuel / chai stops found with the Mapbox geocoder near the route's midpoint. "Create ride" writes the ride.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/types';
import { RIDING_STYLES, RidingStyle } from '../../models/domain';
import { createRide } from '../../services/rideService';
import { useCrewsStore } from '../../store/crewsStore';
import { PLAN_STOP_ID, usePlanDraftStore } from '../../store/planDraftStore';
import { riderInitials, riderName, useProfileStore } from '../../store/profileStore';
import { useSessionStore } from '../../store/sessionStore';
import { useToastStore } from '../../store/toastStore';
import { avatarColor } from '../../theme/palettes';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import { Avatar, Button, Card, Chip, Icon, List, ListItem, PressableScale, Screen, Segmented, Toggle } from '../../ui';
import { geocodeSearchStrict, geocodingAvailable } from '../../utils/geocode';
import { MAX_TIME_MIN, MIN_TIME_MIN, TIME_STEP_MIN, clockParts, dayChips, startMsFor } from '../../utils/planWhen';
import { distanceAlongPathKm, distanceToPathM, pairsToPoints, pathMidpoint } from '../../utils/routeGeo';
import { shortPlace } from '../../utils/rides';
import StepHeader from './parts/StepHeader';

type Props = StackScreenProps<RootStackParamList, 'PlanWhen'>;
type StopKind = 'fuel' | 'chai';

/** A found stop must be this close to the route to be offered (km); the geocoder only biases, it does not bound. */
const MAX_STOP_OFF_ROUTE_M = 15_000;
const STOP_QUERY: Record<StopKind, string> = { fuel: 'fuel station', chai: 'cafe' };
const STOP_ICON: Record<StopKind, string> = { fuel: '⛽', chai: '☕' };

export default function PlanWhenScreen({ navigation }: Props) {
  const { colors, type } = useTheme();
  const styles = useStyles(({ colors: c, type: t }) => ({
    label: { ...t.label, marginTop: 24, marginBottom: 8 },
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    timeCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    stepBtn: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card2, borderWidth: 1.5, borderColor: c.line },
    time: { ...t.num, fontSize: 46, lineHeight: 50, letterSpacing: -1.84 },
    ampm: { fontSize: 20, letterSpacing: 0 },
    err: { ...t.sm, color: c.bad, marginTop: 8 },
    solo: { ...t.sm },
    hint: { ...t.sm, marginTop: 8 },
  }));
  const uid = useSessionStore((s) => s.uid);
  const crews = useCrewsStore((s) => s.crews);
  const byId = useProfileStore((s) => s.byId);
  const ensure = useProfileStore((s) => s.ensure);
  const push = useToastStore((s) => s.push);
  const draft = usePlanDraftStore();
  const { setCrew, setDay, stepTime, toggleInvitee, setPace, setStopFlag } = draft;

  const [now] = useState(() => new Date());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<StopKind | null>(null);
  const [stopMsg, setStopMsg] = useState<Partial<Record<StopKind, string>>>({});

  const crew = crews.find((c) => c.id === draft.crewId) ?? null;
  const others = useMemo(() => (crew ? crew.member_ids.filter((m) => m !== uid) : []), [crew, uid]);

  // Default: the rider's first crew, everyone invited (until they choose themselves).
  useEffect(() => {
    if (draft.crewTouched || draft.crewId || crews.length === 0) return;
    const first = crews[0];
    setCrew(first.id, first.member_ids.filter((m) => m !== uid), false);
  }, [crews, uid, draft.crewTouched, draft.crewId, setCrew]);

  useEffect(() => {
    void ensure(others);
  }, [others, ensure]);

  const path = useMemo(() => (draft.route ? pairsToPoints(draft.route.path_points) : []), [draft.route]);
  const startMs = startMsFor(draft.dayOffset, draft.timeMin, now);
  const inPast = startMs <= Date.now();
  const clock = clockParts(draft.timeMin);

  const toggleStop = async (kind: StopKind, on: boolean) => {
    setStopMsg((m) => ({ ...m, [kind]: undefined }));
    if (!on) {
      setStopFlag(kind, false);
      return;
    }
    const mid = pathMidpoint(path);
    if (!mid) return;
    setBusy(kind);
    try {
      const found = await geocodeSearchStrict(STOP_QUERY[kind], 5, { proximity: mid });
      const hit = found.find((r) => distanceToPathM({ lat: r.lat, lng: r.lng }, path) <= MAX_STOP_OFF_ROUTE_M);
      if (!hit) {
        setStopMsg((m) => ({ ...m, [kind]: `No ${kind === 'fuel' ? 'fuel station' : 'cafe'} found near your route.` }));
        return;
      }
      setStopFlag(kind, true, { id: PLAN_STOP_ID[kind], label: hit.label, lat: hit.lat, lng: hit.lng, icon: STOP_ICON[kind] });
    } catch {
      setStopMsg((m) => ({ ...m, [kind]: 'Search is unavailable. Check your connection.' }));
    } finally {
      setBusy(null);
    }
  };

  const stopSub = (kind: StopKind, idle: string): string => {
    if (busy === kind) return 'Searching near your route…';
    const stop = draft.stops.find((x) => x.id === PLAN_STOP_ID[kind]);
    if (stop) {
      const km = distanceAlongPathKm(path, stop);
      return `${shortPlace(stop.label) ?? stop.label}${km != null ? ` · after ${Math.round(km)} km` : ''}`;
    }
    return stopMsg[kind] ?? idle;
  };

  const create = async () => {
    if (!draft.destination || !draft.route || creating || inPast) return;
    setCreating(true);
    setError(null);
    try {
      const stops = [...draft.stops].sort(
        (a, b) => (distanceAlongPathKm(path, a) ?? 0) - (distanceAlongPathKm(path, b) ?? 0),
      );
      const rideId = await createRide({
        name: `${shortPlace(draft.destination.label) ?? 'New'} Run`,
        crewId: crew?.id ?? null,
        start: draft.start,
        destination: draft.destination,
        stops,
        startTimeMs: startMs,
        pace: draft.pace,
        invitedIds: draft.invitees.filter((u) => others.includes(u)),
        meetup: draft.start,
        route: { distanceKm: draft.route.distance_km, etaMinutes: draft.route.eta_minutes, safetyScore: draft.route.safety_score, path },
      });
      navigation.replace('PlanDone', { rideId });
    } catch {
      setError('Could not create the ride. Check your connection and try again.');
      push('Could not create the ride', 'error');
    } finally {
      setCreating(false);
    }
  };

  if (!draft.destination || !draft.route) {
    return (
      <Screen testID="screen-PlanWhen">
        <StepHeader step={3} title="When, and with whom?" onBack={() => navigation.goBack()} />
        <Text style={[type.body, { marginTop: 24 }]}>Choose where you are riding and a route first.</Text>
        <Button label="Start over" variant="soft" onPress={() => navigation.navigate('PlanWhere')} style={{ marginTop: 16 }} />
      </Screen>
    );
  }

  const chips = dayChips(now);
  const canPOI = geocodingAvailable();

  return (
    <Screen
      testID="screen-PlanWhen"
      cta={<Button label="Create ride" loading={creating} disabled={inPast} onPress={create} testID="create-ride" />}
    >
      <StepHeader step={3} title="When, and with whom?" onBack={() => navigation.goBack()} />

      <Text style={styles.label}>DAY</Text>
      <View style={styles.wrap}>
        {chips.map((d) => (
          <Chip key={d.offset} label={d.label} on={draft.dayOffset === d.offset} onPress={() => setDay(d.offset)} testID={`day-${d.offset}`} />
        ))}
      </View>

      <Text style={styles.label}>ROLL-OUT TIME</Text>
      <Card>
        <View style={styles.timeCard}>
          <PressableScale
            onPress={() => stepTime(-TIME_STEP_MIN)}
            haptic="select"
            disabled={draft.timeMin <= MIN_TIME_MIN}
            accessibilityRole="button"
            accessibilityLabel="Earlier by 15 minutes"
            style={styles.stepBtn}
            testID="time-minus"
          >
            <Icon name="minus" size={22} color={colors.ink} />
          </PressableScale>
          <Text style={styles.time} accessibilityLabel={`Roll out at ${clock.hh}:${clock.mm} ${clock.ampm}`} testID="time-value">
            {`${clock.hh}:${clock.mm}`}
            <Text style={styles.ampm}>{` ${clock.ampm}`}</Text>
          </Text>
          <PressableScale
            onPress={() => stepTime(TIME_STEP_MIN)}
            haptic="select"
            disabled={draft.timeMin >= MAX_TIME_MIN}
            accessibilityRole="button"
            accessibilityLabel="Later by 15 minutes"
            style={styles.stepBtn}
            testID="time-plus"
          >
            <Icon name="plus" size={22} color={colors.ink} />
          </PressableScale>
        </View>
      </Card>
      {inPast ? (
        <Text style={styles.err} accessibilityLiveRegion="polite" testID="time-past">
          That time has already passed. Pick a later time or another day.
        </Text>
      ) : null}

      {crews.length > 0 ? <Text style={styles.label}>WHICH CREW</Text> : null}
      {crews.length > 0 ? (
        <View style={styles.wrap}>
          <Chip label="Solo" on={!crew} onPress={() => setCrew(null, [])} testID="crew-solo" />
          {crews.map((c) => (
            <Chip key={c.id} label={c.name} on={crew?.id === c.id} onPress={() => setCrew(c.id, c.member_ids.filter((m) => m !== uid))} testID={`crew-${c.id}`} />
          ))}
        </View>
      ) : null}
      <Text style={styles.label}>{crew ? `CREW · ${draft.invitees.length} INVITED` : 'RIDERS'}</Text>
      {crew ? (
        others.length > 0 ? (
          <View style={styles.wrap}>
            {others.map((m, i) => {
              const on = draft.invitees.includes(m);
              return (
                <Chip
                  key={m}
                  label={riderName(byId, m, uid)}
                  on={on}
                  onPress={() => toggleInvitee(m)}
                  icon={<Avatar size={28} ring={false} initials={riderInitials(byId, m)} color={avatarColor(i + 1)} />}
                  testID={`invitee-${m}`}
                />
              );
            })}
          </View>
        ) : (
          <Text style={styles.solo}>You’re the only rider in this crew so far.</Text>
        )
      ) : (
        <Text style={styles.solo} testID="solo-note">
          {crews.length === 0 ? 'You’re not in a crew yet. You’ll get a code to share with the riders you want along.' : 'A solo ride. You’ll get a code to share if someone joins you.'}
        </Text>
      )}

      <Text style={styles.label}>PACE</Text>
      <Segmented<RidingStyle> options={RIDING_STYLES.map((p) => ({ value: p, label: p }))} value={draft.pace} onChange={setPace} testID="pace" />

      {canPOI ? (
        <List style={{ marginTop: 16 }}>
          <ListItem
            first
            icon="fuel"
            title="Fuel stop"
            subtitle={stopSub('fuel', 'Find a fuel station near the route')}
            right={<Toggle value={draft.fuel} onChange={(v) => void toggleStop('fuel', v)} accessibilityLabel="Add a fuel stop" testID="toggle-fuel" />}
          />
          <ListItem
            icon="cup"
            title="Chai break"
            subtitle={stopSub('chai', 'Find a cafe near the route')}
            right={<Toggle value={draft.chai} onChange={(v) => void toggleStop('chai', v)} accessibilityLabel="Add a chai break" testID="toggle-chai" />}
          />
        </List>
      ) : null}

      {error ? (
        <Text style={styles.err} accessibilityLiveRegion="polite" testID="create-error">{error}</Text>
      ) : null}
    </Screen>
  );
}
