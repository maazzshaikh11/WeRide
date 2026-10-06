/**
 * Crew (demo `crew`): hero (name, EST. month, avatars, riders), Invite riders, Riders | Rides.
 * Riders come from the members' public profiles; Rides = the crew's upcoming rides plus the rider's own logged
 * rides for this crew (-> Recap). The mic and call/message buttons of the demo are not built (no crew channel,
 * numbers are private).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import Svg, { Line } from 'react-native-svg';
import type { Crew, CrewRole, Ride, RideLog } from '../../models/domain';
import type { RootStackParamList } from '../../navigation/types';
import { getCrew, leaveCrew } from '../../services/crewService';
import { subscribeRideLogs } from '../../services/rideLogService';
import CrewMenuSheet from '../../sheets/CrewMenuSheet';
import InviteSheet from '../../sheets/InviteSheet';
import MemberSheet from '../../sheets/MemberSheet';
import RideInfoSheet from '../../sheets/RideInfoSheet';
import { useCrew, useCrewsStore } from '../../store/crewsStore';
import { riderInitials, riderName, useProfileStore } from '../../store/profileStore';
import { usePrefsStore } from '../../store/prefsStore';
import { useRidesStore } from '../../store/ridesStore';
import { useSessionStore } from '../../store/sessionStore';
import { useToastStore } from '../../store/toastStore';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar, Button, Card, Icon, ListItem, Pill, PressableScale, Screen, Segmented, Skeleton, TopBar } from '../../ui';
import { formatDay, formatWhen, monthName, upcomingCrewRides } from '../../utils/crewRides';
import { formatDistance } from '../../utils/units';
import { ridersLabel } from './CrewsScreen';
import CrewAvatars, { colorForUid } from './crew/CrewAvatars';

type Props = StackScreenProps<RootStackParamList, 'Crew'>;
type Tab = 'riders' | 'rides';
const TABS = [
  { value: 'riders', label: 'Riders' },
  { value: 'rides', label: 'Rides' },
] as const;

const ROLE_LABEL: Record<CrewRole, string> = { lead: 'Lead', sweep: 'Sweep' };

function RiderRow({ uid, first, isMe, role, onPress }: { uid: string; first: boolean; isMe: boolean; role?: CrewRole; onPress: () => void }) {
  const { colors, type } = useTheme();
  const byId = useProfileStore((s) => s.byId);
  const p = byId[uid];
  const name = p?.name ?? riderName(byId, uid);
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.99}
      accessibilityRole="button"
      accessibilityLabel={`${name}${isMe ? ', you' : ''}${p?.bike ? `, ${p.bike}` : ''}${role ? `, ${ROLE_LABEL[role]}` : ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 16, minHeight: 62 }}
      testID={`rider-${uid}`}
    >
      {first ? null : <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 16, right: 16, height: 1.5, backgroundColor: colors.line }} />}
      <Avatar initials={riderInitials(byId, uid)} color={colorForUid(uid)} size={36} me={isMe} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={type.listTitle} numberOfLines={1}>{isMe ? `${name} (you)` : name}</Text>
        {p?.bike ? <Text style={[type.listSub, { marginTop: 3 }]} numberOfLines={1}>{p.bike}</Text> : null}
      </View>
      {role ? <Pill tone="ink" label={ROLE_LABEL[role]} /> : null}
      <Icon name="chev" size={18} color={colors.ink3} />
    </PressableScale>
  );
}

function Unavailable({ onBack, loading }: { onBack: () => void; loading: boolean }) {
  const { type } = useTheme();
  return (
    <Screen testID="screen-Crew">
      <TopBar onBack={onBack} />
      {loading ? (
        <View testID="crew-loading" accessibilityLabel="Loading crew" style={{ gap: 12 }}>
          <Skeleton height={150} radius={26} />
          <Skeleton height={58} radius={18} />
        </View>
      ) : (
        <Card testID="crew-missing">
          <Text style={type.h3} accessibilityLiveRegion="polite">This crew isn't available</Text>
          <Text style={[type.sm, { marginTop: 6 }]}>You may have left it, or you're offline. Go back to your crews and try again.</Text>
          <Button label="Back to crews" variant="soft" style={{ marginTop: 14 }} onPress={onBack} />
        </Card>
      )}
    </Screen>
  );
}

export default function CrewScreen({ navigation, route }: Props) {
  const { crewId } = route.params;
  const { colors, type } = useTheme();
  const uid = useSessionStore((s) => s.uid);
  const units = usePrefsStore((s) => s.prefs.units);
  const storeCrew = useCrew(crewId);
  const loaded = useCrewsStore((s) => s.loaded);
  const muted = useCrewsStore((s) => Boolean(s.muted[crewId]));
  const rides = useRidesStore((s) => s.rides);
  const [fetched, setFetched] = useState<Crew | null>(null);
  const [fetchDone, setFetchDone] = useState(false);
  const [tab, setTab] = useState<Tab>('riders');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [memberUid, setMemberUid] = useState<string | null>(null);
  const [memberOpen, setMemberOpen] = useState(false);
  const [infoRide, setInfoRide] = useState<Ride | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [logs, setLogs] = useState<RideLog[] | null>(null);
  const byId = useProfileStore((s) => s.byId);

  // The store is the live source; if it has not seen this crew (just created/joined, or the listener is slow), read it once.
  const crew = storeCrew ?? fetched;
  useEffect(() => {
    if (storeCrew || fetchDone) return;
    let alive = true;
    getCrew(crewId)
      .then((c) => alive && setFetched(c))
      .catch(() => undefined)
      .finally(() => alive && setFetchDone(true));
    return () => {
      alive = false;
    };
  }, [crewId, storeCrew, fetchDone]);

  const memberIds = crew?.member_ids;
  const memberKey = memberIds?.join(',') ?? '';
  useEffect(() => {
    if (memberKey) void useProfileStore.getState().ensure(memberKey.split(','));
  }, [memberKey]);

  useEffect(() => {
    if (!uid) return;
    return subscribeRideLogs(
      uid,
      (all) => setLogs(all),
      () => setLogs([]),
    );
  }, [uid]);

  const ordered = useMemo(() => {
    const ids = memberIds ?? [];
    return uid && ids.includes(uid) ? [uid, ...ids.filter((m) => m !== uid)] : ids;
  }, [memberIds, uid]);

  const now = Date.now();
  const upcoming = useMemo(() => upcomingCrewRides(rides, crewId, now), [rides, crewId, now]);
  const crewLogs = useMemo(
    () => (logs ?? []).filter((l) => l.crew_id === crewId).sort((a, b) => b.started_ms - a.started_ms),
    [logs, crewId],
  );

  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('GarageTabs'));

  if (!crew) return <Unavailable onBack={back} loading={!fetchDone || !loaded} />;

  const est = monthName(crew.created_ms);
  const member = memberUid ? { uid: memberUid, profile: byId[memberUid] ?? null, role: crew.roles[memberUid], isMe: memberUid === uid } : null;

  const doLeave = async () => {
    await leaveCrew(crew.id);
    useToastStore.getState().push(`You left ${crew.name}`, 'info');
    setMenuOpen(false);
    back();
  };

  const openRide = (r: Ride) => {
    if (r.status === 'live') navigation.navigate('Live', { groupId: r.id });
    else if (r.status === 'meetup') navigation.navigate('Meetup', { groupId: r.id });
    else {
      setInfoRide(r);
      setInfoOpen(true);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen testID="screen-Crew">
        <TopBar
          onBack={back}
          right={
            <PressableScale
              onPress={() => setMenuOpen(true)}
              haptic="tap"
              accessibilityRole="button"
              accessibilityLabel="Crew menu"
              testID="crew-menu"
              style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.line }}
            >
              <Icon name="more" size={22} color={colors.ink} />
            </PressableScale>
          }
          style={{ marginBottom: 14 }}
        />

        <View style={{ borderRadius: 26, backgroundColor: colors.ink, padding: 22, overflow: 'hidden' }} testID="crew-hero">
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 5 }}>
            <Svg width="100%" height={5}>
              <Line x1={0} y1={2.5} x2={2000} y2={2.5} stroke={colors.pri} strokeWidth={5} strokeDasharray="18 14" />
            </Svg>
          </View>
          <Text style={[type.label, { color: colors.bg, opacity: 0.6 }]}>{est ? `CREW ∙ EST. ${est}` : 'CREW'}</Text>
          <Text style={[type.h1, { color: colors.bg, marginTop: 8 }]} accessibilityRole="header">{crew.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24, flexWrap: 'wrap', rowGap: 8 }}>
            <CrewAvatars uids={ordered} meUid={uid} />
            <Text style={[type.smStrong, { color: colors.bg, opacity: 0.75, marginLeft: 12 }]}>{ridersLabel(crew.member_ids.length)}</Text>
          </View>
        </View>

        <Button
          label="Invite riders"
          style={{ marginTop: 16 }}
          leading={<Icon name="share" size={20} color={colors.priInk} />}
          onPress={() => setInviteOpen(true)}
          testID="crew-invite"
        />

        <View style={{ marginTop: 24 }}>
          <Segmented options={TABS} value={tab} onChange={setTab} testID="crew-tabs" />
        </View>

        {tab === 'riders' ? (
          <View style={{ marginTop: 16, backgroundColor: colors.card, borderRadius: 22, borderWidth: 1.5, borderColor: colors.line, overflow: 'hidden' }} testID="crew-riders">
            {ordered.map((m, i) => (
              <RiderRow key={m} uid={m} first={i === 0} isMe={m === uid} role={crew.roles[m]} onPress={() => {
                setMemberUid(m);
                setMemberOpen(true);
              }} />
            ))}
          </View>
        ) : (
          <View style={{ marginTop: 16 }} testID="crew-rides">
            {upcoming.length === 0 && logs !== null && crewLogs.length === 0 ? (
              <Card testID="crew-rides-empty">
                <Text style={type.h3}>No rides yet</Text>
                <Text style={[type.sm, { marginTop: 6 }]}>Plan a ride with this crew from the Ride tab. Upcoming rides and the ones you have ridden show up here.</Text>
              </Card>
            ) : (
              <View style={{ backgroundColor: colors.card, borderRadius: 22, borderWidth: 1.5, borderColor: colors.line, overflow: 'hidden' }}>
                {upcoming.map((r, i) => (
                  <ListItem
                    key={r.id}
                    first={i === 0}
                    icon="route"
                    accentIcon
                    title={r.name}
                    subtitle={[r.status === 'live' ? 'Riding now' : r.start_time_ms != null ? formatWhen(r.start_time_ms, now) : 'Time to be set', ridersLabel(r.member_ids.length)].join(' ∙ ')}
                    onPress={() => openRide(r)}
                    testID={`crew-ride-${r.id}`}
                  />
                ))}
                {crewLogs.map((l, i) => (
                  <ListItem
                    key={l.ride_id}
                    first={upcoming.length === 0 && i === 0}
                    icon="check"
                    title={l.name}
                    subtitle={`${formatDay(l.started_ms)} ∙ ${formatDistance(l.km, units)} ∙ ${Math.round(l.together_pct)}% together`}
                    onPress={() => navigation.navigate('Recap', { rideId: l.ride_id })}
                    testID={`crew-log-${l.ride_id}`}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </Screen>

      <InviteSheet visible={inviteOpen} onClose={() => setInviteOpen(false)} crew={crew} />
      <MemberSheet
        visible={memberOpen}
        onClose={() => setMemberOpen(false)}
        uid={member?.uid}
        profile={member?.profile}
        role={member?.role}
        isMe={member?.isMe}
      />
      <CrewMenuSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        crewName={crew.name}
        muted={muted}
        onToggleMute={(on) => {
          useCrewsStore.getState().setMuted(crew.id, on);
          useToastStore.getState().push(on ? 'Crew muted on this phone' : 'Crew unmuted', 'info');
        }}
        onLeave={doLeave}
      />
      <RideInfoSheet visible={infoOpen} onClose={() => setInfoOpen(false)} ride={infoRide} />
    </View>
  );
}
