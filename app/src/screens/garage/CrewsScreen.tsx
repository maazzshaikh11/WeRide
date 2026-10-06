/**
 * Crews tab (demo `crews`): the rider's real crews as cards (name, riders, avatar stack, the crew's next ride and
 * time, a "Ride tomorrow" pill within 24 h), with "Join with code" and "Start a crew" underneath.
 */
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import type { Crew, Ride } from '../../models/domain';
import NewCrewSheet from '../../sheets/NewCrewSheet';
import { useCrewsStore } from '../../store/crewsStore';
import { useRidesStore } from '../../store/ridesStore';
import { useSessionStore } from '../../store/sessionStore';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import { Button, Card, Icon, Pill, PressableScale, Screen, Skeleton } from '../../ui';
import { formatWhen, nextCrewRide, startsWithin24h } from '../../utils/crewRides';
import CrewAvatars from './crew/CrewAvatars';

/** Loose on purpose: this is a tab screen (the tab navigator's own prop type is wider than what it needs). */
interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  navigation?: { navigate?: (...args: any[]) => void };
}

export const ridersLabel = (n: number) => `${n} ${n === 1 ? 'rider' : 'riders'}`;

function CrewCard({ crew, index, ride, now, meUid, onPress }: { crew: Crew; index: number; ride: Ride | null; now: number; meUid: string | null; onPress: () => void }) {
  const { colors, type } = useTheme();
  const s = useStyles(({ colors: c }) => ({
    card: { backgroundColor: c.card, borderRadius: 22, borderWidth: 1.5, borderColor: c.line, padding: 18, overflow: 'hidden' },
    ring: { position: 'absolute', right: -44, top: -44, width: 140, height: 140, borderRadius: 70, borderWidth: 15, borderColor: c.pri },
  }));
  const when = ride ? (ride.start_time_ms != null ? `${formatWhen(ride.start_time_ms, now)} ∙ ${ride.name}` : ride.name) : 'No ride planned';
  const soon = startsWithin24h(ride, now);
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.985}
      style={s.card}
      accessibilityRole="button"
      accessibilityLabel={`${crew.name}, ${ridersLabel(crew.member_ids.length)}, ${ride ? `next ride ${when}` : 'no ride planned'}${soon ? ', ride within 24 hours' : ''}`}
      testID={`crew-card-${crew.id}`}
    >
      <View pointerEvents="none" style={[s.ring, { opacity: index === 0 ? 0.55 : 0.16 }]} />
      <Text style={type.h2} numberOfLines={2}>{crew.name}</Text>
      <Text style={[type.sm, { marginTop: 8 }]}>{ridersLabel(crew.member_ids.length)}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, minHeight: 28 }}>
        <CrewAvatars uids={crew.member_ids} meUid={meUid} />
        <View style={{ flex: 1 }} />
        {soon ? <Pill tone="ink" label="Ride tomorrow" /> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
        <Icon name="clock" size={14} color={colors.ink} />
        <Text style={[type.smStrong, { flex: 1 }]} numberOfLines={1}>{when}</Text>
      </View>
    </PressableScale>
  );
}

function CardSkeleton() {
  return (
    <Card>
      <Skeleton width="55%" height={24} />
      <Skeleton width="25%" height={14} style={{ marginTop: 12 }} />
      <Skeleton width="45%" height={28} radius={14} style={{ marginTop: 16 }} />
      <Skeleton width="60%" height={14} style={{ marginTop: 14 }} />
    </Card>
  );
}

export default function CrewsScreen({ navigation }: Props) {
  const { colors, type } = useTheme();
  const crews = useCrewsStore((s) => s.crews);
  const loaded = useCrewsStore((s) => s.loaded);
  const error = useCrewsStore((s) => s.error);
  const rides = useRidesStore((s) => s.rides);
  const uid = useSessionStore((s) => s.uid);
  const [newOpen, setNewOpen] = useState(false);
  const now = Date.now();

  return (
    <View style={{ flex: 1 }}>
      <Screen tabs testID="screen-Crews">
        <Text style={type.label}>YOUR PEOPLE</Text>
        <Text style={[type.h1, { marginTop: 8 }]} accessibilityRole="header">Crews</Text>

        <View style={{ gap: 12, marginTop: 24 }}>
          {!loaded ? (
            <View testID="crews-loading" style={{ gap: 12 }} accessibilityLabel="Loading your crews" accessibilityLiveRegion="polite">
              <CardSkeleton />
              <CardSkeleton />
            </View>
          ) : crews.length > 0 ? (
            crews.map((c, i) => (
              <CrewCard
                key={c.id}
                crew={c}
                index={i}
                ride={nextCrewRide(rides, c.id, now)}
                now={now}
                meUid={uid}
                onPress={() => navigation?.navigate?.('Crew', { crewId: c.id })}
              />
            ))
          ) : error ? (
            <Card testID="crews-error">
              <Text style={type.h3} accessibilityLiveRegion="polite">Can't load your crews</Text>
              <Text style={[type.sm, { marginTop: 6 }]}>Check your connection. Your crews will appear here once you're back online; you can still join or start one below.</Text>
            </Card>
          ) : (
            <Card testID="crews-empty" style={{ alignItems: 'flex-start' }}>
              <Icon name="crews" size={28} color={colors.ink} />
              <Text style={[type.h3, { marginTop: 12 }]}>No crews yet</Text>
              <Text style={[type.sm, { marginTop: 6 }]}>A crew is the group you ride with. Start one and share its code, or join a friend's with the code they sent you.</Text>
            </Card>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <Button
            label="Join with code"
            variant="ghost"
            style={{ flex: 1 }}
            leading={<Icon name="qr" size={20} color={colors.ink} />}
            onPress={() => navigation?.navigate?.('Join')}
            testID="crews-join"
          />
          <Button
            label="Start a crew"
            variant="dark"
            style={{ flex: 1 }}
            leading={<Icon name="plus" size={20} color={colors.bg} />}
            onPress={() => setNewOpen(true)}
            testID="crews-new"
          />
        </View>
      </Screen>
      <NewCrewSheet
        visible={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(crewId) => navigation?.navigate?.('Crew', { crewId })}
      />
    </View>
  );
}
