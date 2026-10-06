/**
 * Arrive — the dark Road screen at the destination (demo `road-arrive`), real data (docs/DEMO_PARITY_SPEC.md §3):
 * green "Arrived" plate ("<destination> · <time>"), "Everyone home.", a tile per rider ("✓ home" from `presence`
 * `arrived`, else "riding in…"; your own `arrived` is written on mount), a stats card (km, time, together % from the ride
 * recorder's running totals, "—" when unknown) and "Hold to end ride": finish the recording -> save the ride log (never blocks
 * on the network: it is queued on the phone until it syncs) -> ride `finished` -> Garage with the Recap on top.
 * It sits on top of Live (tracking keeps running until the ride ends).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import { KV, Plate, Icon } from '../../ui';
import HoldButton from '../../overlays/HoldButton';
import ToastContainer from '../../components/ToastContainer';
import { useAppStore } from '../../store/appStore';
import { useRidePlanStore } from '../../store/ridePlanStore';
import { usePrefsStore } from '../../store/prefsStore';
import { useToastStore } from '../../store/toastStore';
import { setPresence, setRideStatus } from '../../services/rideService';
import { rideRecorder } from '../../services/rideRecorder';
import { finishOwnRide } from '../../services/rideFlow';
import { leaveRoadToRecap } from '../../navigation/rideLifecycle';
import { formatDistance, formatDuration } from '../../utils/units';
import { warn } from '../../utils/log';
import RoadScope from './parts/RoadScope';
import TileGrid from './parts/TileGrid';
import { useRideRoom } from './parts/useRideRoom';
import { presenceMap } from './parts/rollCall';

interface Props {
  navigation?: unknown;
  route?: { params?: { groupId?: string } };
}

export const END_HOLD_MS = 1000;

export default function ArriveScreen(props: Props) {
  return (
    <RoadScope>
      <ArriveBody {...props} />
    </RoadScope>
  );
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const clock = (d: Date) => `${d.getHours()}:${pad2(d.getMinutes())}`;

function ArriveBody({ route }: Props) {
  const groupId = route?.params?.groupId ?? useAppStore.getState().groupId ?? '';
  const { colors, type } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useStyles(({ colors: c }) => ({
    root: { flex: 1, backgroundColor: c.bg },
    body: { paddingTop: Math.max(insets.top, 24) + 20, paddingHorizontal: 14 },
    card: { marginTop: 16, borderRadius: 22, backgroundColor: c.card, borderWidth: 1.5, borderColor: c.line, padding: 18 },
    bottom: { position: 'absolute', left: 14, right: 14, bottom: Math.max(insets.bottom, 12) + 18 },
  }));
  const uid = useAppStore((st) => st.userId);
  const push = useToastStore((st) => st.push);
  const units = usePrefsStore((st) => st.prefs.units);
  const planDestination = useRidePlanStore((st) => st.destination);
  const room = useRideRoom(groupId, uid);
  const { ride, members } = room;
  const [now, setNow] = useState(() => Date.now());
  const arrivedAt = useRef(new Date());
  const ending = useRef(false);

  // you are home: say so
  useEffect(() => {
    if (!groupId || !uid) return;
    setPresence(groupId, uid, 'arrived').catch((e) => warn('[Arrive] presence write failed:', e));
  }, [groupId, uid]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const states = useMemo(() => presenceMap(room.presence), [room.presence]);
  const tiles = members.map((m) => {
    const home = m.me || states.get(m.uid) === 'arrived';
    return { uid: m.uid, name: m.name, initials: m.initials, color: m.color, status: home ? '✓ home' : 'riding in…', ready: home, me: m.me };
  });
  const destName = (ride?.ride_plan?.destination ?? planDestination)?.label?.split(',')[0] ?? 'Destination';

  const snap = rideRecorder.snapshot?.(now) ?? null;
  const stats = [
    { value: snap ? formatDistance(snap.km, units, false) : '—', unit: snap ? (units === 'mi' ? 'mi' : 'km') : undefined, label: units === 'mi' ? 'miles' : 'km' },
    { value: snap ? formatDuration(snap.durationS).replace(/ (\d+)$/, ' $1m') : '—', label: 'time' },
    { value: snap?.togetherPct != null ? `${snap.togetherPct}%` : '—', label: 'together' },
  ];

  const endRide = useCallback(async () => {
    if (ending.current || !uid) return;
    ending.current = true;
    let saved = false;
    let hadLog = false;
    try {
      // 1. finish the recording and save the log (queued on the phone, never blocks on the network)
      const res = await finishOwnRide(uid, groupId, Math.max(1, ride?.member_ids.length ?? 1));
      saved = res.saved;
      hadLog = res.log != null;
    } catch (e) {
      warn('[Arrive] finishing the recording failed:', e);
    }
    // 2. the ride is over for everyone (a write that completes when there is signal; do not hold the rider here)
    setRideStatus(groupId, 'finished').catch((e) => warn('[Arrive] could not mark the ride finished:', e));
    // 3. Garage, with the Recap on top
    leaveRoadToRecap(groupId);
    push(saved ? 'Ride saved to your log' : hadLog ? 'Ride saved on this phone. It syncs when you are online' : 'Ride ended', saved || !hadLog ? 'success' : 'warn');
  }, [uid, groupId, ride, push]);

  return (
    <View style={s.root} testID="screen-Arrive">
      <View style={s.body}>
        <Plate
          tone="green"
          title="Arrived"
          titleSize={40}
          subtitle={`${destName} · ${clock(arrivedAt.current)}`}
          right={<Icon name="flag" size={52} color="#FFFFFF" />}
          style={{ paddingVertical: 22, paddingHorizontal: 20, justifyContent: 'space-between' }}
          testID="arrive-plate"
        />
        <View style={{ marginTop: 32 }} accessible accessibilityLabel="Everyone home.">
          <Text style={[type.display, { fontSize: 40, lineHeight: 39 }]}>Everyone</Text>
          <Text style={[type.display, { fontSize: 40, lineHeight: 39, color: colors.pri }]}>home.</Text>
        </View>
        <TileGrid tiles={tiles} style={{ marginTop: 24 }} testID="arrive-tiles" />
        <View style={s.card} testID="arrive-stats">
          <KV items={stats} />
        </View>
      </View>
      <View style={s.bottom}>
        <HoldButton
          testID="end-ride"
          label="Hold to end ride"
          ms={END_HOLD_MS}
          onDone={endRide}
          onEarlyRelease={() => push('Hold to end the ride', 'info')}
          fillColor="rgba(0,0,0,0.2)"
          style={{ height: 80, borderRadius: 24, backgroundColor: colors.pri }}
          textStyle={[type.button, { fontSize: 22, lineHeight: 26, color: colors.priInk }]}
          accessibilityLabel="Hold for 1 second to end the ride"
          accessibilityHint="Press and hold. Ends the ride for everyone and saves it to your log"
        />
      </View>
      <ToastContainer top={64} />
    </View>
  );
}
