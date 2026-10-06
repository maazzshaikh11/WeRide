/**
 * RideInfoSheet — an upcoming ride from "Also coming up" (demo `A.rideInfo`): name, when / distance / riders
 * confirmed, the route sketch, "Invite" (copies the join code) and "I'm in" (writes the rider's RSVP).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import type { Ride, RsvpDoc } from '../models/domain';
import { subscribeRsvp, routeStatsOf, setRsvp } from '../services/rideService';
import { useCrewsStore } from '../store/crewsStore';
import { useSessionStore } from '../store/sessionStore';
import { useToastStore } from '../store/toastStore';
import { usePrefsStore } from '../store/prefsStore';
import { useTheme } from '../theme/ThemeProvider';
import { Button, Icon, MapSketch, Sheet } from '../ui';
import { formatDistance } from '../utils/units';
import { planPointsOf } from '../utils/ridePoints';
import { ticketWhen } from '../utils/planWhen';

export interface RideInfoSheetProps {
  visible: boolean;
  onClose: () => void;
  ride: Ride | null;
}

export default function RideInfoSheet({ visible, onClose, ride }: RideInfoSheetProps) {
  const { colors, type } = useTheme();
  const uid = useSessionStore((s) => s.uid);
  const units = usePrefsStore((s) => s.prefs.units);
  const crew = useCrewsStore((s) => s.crews.find((c) => c.id === ride?.crew_id));
  const push = useToastStore((s) => s.push);
  const [rsvp, setRsvpDocs] = useState<RsvpDoc[]>([]);
  const [error, setError] = useState<string | null>(null);

  const rideId = ride?.id ?? null;
  useEffect(() => {
    setRsvpDocs([]);
    setError(null);
    if (!visible || !rideId) return undefined;
    return subscribeRsvp(rideId, setRsvpDocs, () => undefined);
  }, [visible, rideId]);

  const points = useMemo(() => (ride ? planPointsOf(ride) : []), [ride]);
  if (!ride) return null;

  const stats = routeStatsOf(ride);
  const going = rsvp.filter((r) => r.status === 'going').length;
  const mine = uid ? rsvp.find((r) => r.uid === uid)?.status : undefined;
  const bits = [
    ride.start_time_ms ? ticketWhen(ride.start_time_ms) : null,
    stats ? formatDistance(stats.distance_km, units) : null,
    `${going} ${going === 1 ? 'rider' : 'riders'} confirmed`,
  ].filter(Boolean);
  const code = crew?.join_code ?? ride.join_code;

  const copy = () => {
    if (!code) return;
    Clipboard.setString(code);
    push('Invite code copied', 'success');
  };
  const imIn = () => {
    if (!uid) return;
    setError(null);
    setRsvp(ride.id, uid, 'going').catch(() => setError('Could not save that. Check your connection and try again.'));
    push('You’re in', 'success');
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} testID="sheet-RideInfo" accessibilityLabel={`${ride.name} details`}>
      <Text style={type.label}>UPCOMING</Text>
      <Text style={[type.h2, { marginTop: 8 }]} accessibilityRole="header">{ride.name}</Text>
      <Text style={[type.sm, { marginTop: 8 }]}>{bits.join(' ∙ ')}</Text>
      {points.length > 0 ? (
        <View style={{ marginTop: 16, borderRadius: 18, overflow: 'hidden' }}>
          <MapSketch points={points} height={150} testID="rideinfo-map" />
        </View>
      ) : null}
      {error ? <Text style={[type.sm, { color: colors.bad, marginTop: 12 }]} accessibilityLiveRegion="polite">{error}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
        <Button
          label="Invite"
          variant="soft"
          disabled={!code}
          onPress={copy}
          leading={<Icon name="copy" size={20} color={colors.ink} />}
          accessibilityLabel={code ? `Copy invite code ${code}` : 'Invite'}
          style={{ flex: 1 }}
        />
        <Button label={mine === 'going' ? 'You’re in' : 'I’m in'} onPress={imIn} disabled={mine === 'going'} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}
