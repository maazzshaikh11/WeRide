/**
 * The Ride tab's hero, by the ride's status (demo `REG.home`): Ride pass (planned), Meetup open, Live (dark),
 * Finished, or the honest "nothing planned" card. Presentational: RideHomeScreen owns the data and actions.
 */
import React from 'react';
import { Text, View } from 'react-native';
import TicketMap from './TicketMap';
import type { Crew, Ride, RideLog, RsvpStatus } from '../../../models/domain';
import { routeStatsOf } from '../../../services/rideService';
import { riderName, useProfileStore } from '../../../store/profileStore';
import { useStyles, useTheme } from '../../../theme/ThemeProvider';
import { Button, Card, Icon, KV, Pill, Segmented, Ticket } from '../../../ui';
import { planPointsOf } from '../../../utils/ridePoints';
import { countdownLabel } from '../../../utils/rideHero';
import { shortPlace } from '../../../utils/rides';
import { ticketWhen } from '../../../utils/planWhen';
import { durationLabel } from '../../../utils/routeOptions';
import { formatDistance } from '../../../utils/units';
import { haversineMeters } from '../../../utils/geoUtils';
import type { Units } from '../../../models/domain';
import AvatarRow from './AvatarRow';
import HeroButton from './HeroButton';
import RoadThemed, { NightRoad } from './RoadThemed';
import type { RideDocs } from './useRideDocs';

const RSVP_OPTIONS = [
  { value: 'going', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'Can’t' },
] as const satisfies readonly { value: RsvpStatus; label: string }[];

export interface RideHeroProps {
  ride: Ride;
  now: number;
  uid: string | null;
  units: Units;
  crew: Crew | null;
  docs: RideDocs;
  log: RideLog | null;
  firstName: string;
  onRsvp: (s: RsvpStatus) => void;
  onGoMeetup: () => void;
  onRollCall: () => void;
  onRejoin: () => void;
  onRecap: () => void;
}

export function KvForRide(ride: Ride, units: Units) {
  const stats = routeStatsOf(ride);
  const items: { value: string; unit?: string; label: string }[] = [];
  if (stats) {
    const km = formatDistance(stats.distance_km, units, false);
    items.push({ value: km, unit: units === 'mi' ? 'mi' : 'km', label: 'Distance' });
    items.push({ value: durationLabel(stats.eta_minutes), label: 'Est. time' });
    items.push({ value: String(Math.round(stats.safety_score * 100)), label: 'Safety score' });
    return items;
  }
  // No saved route calculation: only what the waypoints themselves give (a straight-line lower bound).
  const plan = ride.ride_plan;
  const pts = [plan?.start, ...(plan?.stops ?? []), plan?.destination].filter((p): p is NonNullable<typeof p> => !!p);
  if (pts.length >= 2) {
    let m = 0;
    for (let i = 1; i < pts.length; i++) m += haversineMeters(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
    items.push({ value: `≈${formatDistance(m / 1000, units, false)}`, unit: units === 'mi' ? 'mi' : 'km', label: 'Distance' });
  }
  return items;
}

function LiveBody({ pill, roles, onRejoin }: { pill: string; roles: string; onRejoin: () => void }) {
  const { colors, type } = useTheme();
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pill label="● Live" tone="bad" />
        <Text style={[type.sm, { flexShrink: 1, color: colors.ink2 }]} numberOfLines={1}>{pill}</Text>
      </View>
      <Text style={[type.h2, { marginTop: 12 }]}>You’re on the road.</Text>
      {roles ? <Text style={[type.sm, { marginTop: 8, color: colors.ink2 }]}>{roles}</Text> : null}
      <View style={{ marginTop: 16 }}>
        <Button label="Rejoin ride" onPress={onRejoin} />
      </View>
    </>
  );
}

export default function RideHero(p: RideHeroProps) {
  const { ride, now, uid, units, crew, docs, log, firstName } = p;
  const byId = useProfileStore((s) => s.byId);
  const styles = useStyles(({ type: t }) => ({
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    sm: { ...t.sm, flexShrink: 1 },
    title: { ...t.h2, marginTop: 12 },
    route: { ...t.sm, marginTop: 8 },
    kv: { marginTop: 16 },
    foot: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
    confirmed: { ...t.smStrong, flexShrink: 1 },
    spacer: { flex: 1 },
    cta: { marginTop: 16 },
  }));

  const points = planPointsOf(ride);
  const header = points.length > 0 ? <TicketMap points={points} height={158} /> : undefined;
  const members = ride.member_ids.length;
  const confirmed = docs.rsvp.filter((r) => r.status === 'going').length;
  const mine = uid ? docs.rsvp.find((r) => r.uid === uid)?.status : undefined;
  const ready = docs.rollCall.filter((r) => r.state === 'ready').length;
  const from = shortPlace(ride.meetup?.label ?? ride.ride_plan?.start?.label);
  const to = shortPlace(ride.ride_plan?.destination?.label);
  const routeLine = [from && to ? `${from} → ${to}` : to ? `To ${to}` : null, crew ? `with ${crew.name}` : null].filter(Boolean).join(' · ');
  const kv = KvForRide(ride, units);

  if (ride.status === 'live') {
    const riding = docs.presence.filter((d) => d.state === 'riding').length;
    const nameOf = (u: string) => riderName(byId, u, uid).split(' ')[0];
    const lead = crew && Object.entries(crew.roles).find(([, r]) => r === 'lead')?.[0];
    const sweep = crew && Object.entries(crew.roles).find(([, r]) => r === 'sweep')?.[0];
    const roles = [lead ? `${nameOf(lead)} ${lead === uid ? 'lead' : 'leads'}` : null, sweep ? `${nameOf(sweep)} ${sweep === uid ? 'sweep' : 'sweeps'}` : null].filter(Boolean).join(' · ');
    const count = riding > 0 ? riding : members;
    return (
      <NightRoad>
        <Ticket dark testID="hero-live" header={header ? <RoadThemed>{header}</RoadThemed> : undefined}>
          <RoadThemed>
            <LiveBody
              pill={`${ride.name} · ${count} ${riding > 0 ? 'riding' : count === 1 ? 'rider' : 'riders'}`}
              roles={roles}
              onRejoin={p.onRejoin}
            />
          </RoadThemed>
        </Ticket>
      </NightRoad>
    );
  }

  if (ride.status === 'finished') {
    const arrived = docs.presence.filter((d) => d.state === 'arrived').length;
    const riders = log?.riders ?? members;
    const sub = arrived > 0 && arrived >= members ? `Everyone home · ${arrived} of ${members}` : arrived > 0 ? `${arrived} of ${members} home` : `${riders} ${riders === 1 ? 'rider' : 'riders'}`;
    return (
      <Ticket testID="hero-finished" header={header}>
        <View style={styles.row}>
          <Pill label="✓ Finished" tone="ok" />
          <Text style={styles.sm} numberOfLines={1}>{sub}</Text>
        </View>
        <Text style={styles.title}>{`Nice ride, ${firstName}.`}</Text>
        <Text style={styles.route}>Your recap is ready: cohesion, gaps and the hazards you shared.</Text>
        <View style={styles.cta}>
          <Button label="See the recap" onPress={p.onRecap} />
        </View>
      </Ticket>
    );
  }

  const meetup = ride.status === 'meetup';
  const countdown = ride.start_time_ms != null ? countdownLabel(ride.start_time_ms, now) : null;
  const pill = meetup && ready > 0 ? `${ready} READY` : countdown;
  return (
    <Ticket testID={meetup ? 'hero-meetup' : 'hero-planned'} header={header}>
      <View style={styles.row}>
        {meetup ? <Pill label="● Meetup open" tone="ok" /> : <Pill label="Ride pass" tone="accent" />}
        {ride.start_time_ms != null ? <Text style={styles.sm} numberOfLines={1}>{ticketWhen(ride.start_time_ms)}</Text> : null}
      </View>
      <Text style={styles.title} numberOfLines={2}>{ride.name}</Text>
      {routeLine ? <Text style={styles.route} numberOfLines={2}>{routeLine}</Text> : null}
      {kv.length > 0 ? <KV items={kv} style={styles.kv} /> : null}
      <View style={styles.foot}>
        <AvatarRow uids={ride.member_ids} myUid={uid} />
        <Text style={styles.confirmed} numberOfLines={2}>{`${confirmed} of ${members} confirmed`}</Text>
        <View style={styles.spacer} />
        {pill ? <Pill label={pill} tone="ink" /> : null}
      </View>
      {!meetup ? (
        <View style={{ marginTop: 16 }}>
          <Segmented<RsvpStatus | 'none'>
            testID="rsvp-segmented"
            options={RSVP_OPTIONS}
            value={mine ?? 'none'}
            onChange={(v) => v !== 'none' && p.onRsvp(v)}
          />
        </View>
      ) : null}
      <HeroButton
        label={meetup ? 'Open roll call' : 'Go to meetup'}
        onPress={meetup ? p.onRollCall : p.onGoMeetup}
        style={styles.cta}
        testID={meetup ? 'cta-rollcall' : 'cta-meetup'}
      />
    </Ticket>
  );
}

/** "Nothing planned" — shown when the rider has no upcoming, live or just-finished ride. */
export function EmptyHero({ onPlan, onJoin, error }: { onPlan: () => void; onJoin: () => void; error?: boolean }) {
  const { type, colors } = useTheme();
  return (
    <Card testID="hero-empty">
      <Icon name="route" size={26} color={colors.ink} />
      <Text style={[type.h2, { marginTop: 12 }]}>{error ? 'Can’t load your rides' : 'Nothing planned'}</Text>
      <Text style={[type.sm, { marginTop: 8 }]} accessibilityLiveRegion={error ? 'polite' : 'none'}>
        {error ? 'Check your connection. Your rides will appear as soon as you are back online.' : 'Plan a ride for your crew, or join one with a code.'}
      </Text>
      <View style={{ marginTop: 16, gap: 8 }}>
        <HeroButton label="Plan a ride" onPress={onPlan} testID="empty-plan" />
        <Button label="Join with a code" variant="ghost" onPress={onJoin} testID="empty-join" />
      </View>
    </Card>
  );
}
