/**
 * Stop — the dark Road screen for a break (demo `road-stop` / `road-stop-late`), real data (docs/DEMO_PARITY_SPEC.md §3):
 * green plate with the stop name and a break timer (since you pulled in), the crew's tiles from the `presence` docs
 * (ready / fuelling / pulling in / on a break), a "Next leg" card from the route store (remaining distance / time, hazards on the
 * leg), the SOS key and "I'm ready to roll". When everybody is ready (or the lead, who was ready, rolls on) the break-over
 * countdown opens Live again. It sits on top of Live (which keeps tracking underneath).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View } from 'react-native';
import { useRouteStore } from '@routing/client/routeStore';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Chip, Icon, Plate } from '../../ui';
import SosFab from '../../components/SosFab';
import ToastContainer from '../../components/ToastContainer';
import { useAppStore } from '../../store/appStore';
import { useOverlayStore } from '../../store/overlayStore';
import { useRidePlanStore } from '../../store/ridePlanStore';
import { useToastStore } from '../../store/toastStore';
import { usePrefsStore } from '../../store/prefsStore';
import { setPresence } from '../../services/rideService';
import { rideRecorder } from '../../services/rideRecorder';
import { triggerSosFlow } from '../../services/sosFlowService';
import { markStopVisited, visitedStopIds } from '../../services/rideFlow';
import { formatDistance } from '../../utils/units';
import { haversineMeters } from '../../utils/geoUtils';
import { warn } from '../../utils/log';
import RoadFrame from './parts/RoadFrame';
import RoadScope from './parts/RoadScope';
import { useLiveLayout } from '../map/live/LiveChrome';
import { CAP } from '../../theme/textPolicy';
import TileGrid from './parts/TileGrid';
import { useRideRoom } from './parts/useRideRoom';
import { breakClock, nextLeg, shouldRoll } from './parts/leg';
import { presenceLabel, presenceMap } from './parts/rollCall';

interface Props {
  navigation?: unknown;
  route?: { params?: { groupId?: string; stopId?: string } };
}

const ROLL_DELAY_MS = 700;

export default function StopScreen(props: Props) {
  return (
    <RoadScope>
      <StopBody {...props} />
    </RoadScope>
  );
}

function StopBody({ route }: Props) {
  const groupId = route?.params?.groupId ?? useAppStore.getState().groupId ?? '';
  const stopId = route?.params?.stopId;
  const { colors, type } = useTheme();
  const insets = useSafeAreaInsets();
  const glove = usePrefsStore((st) => st.prefs.glove);
  const uid = useAppStore((st) => st.userId);
  const push = useToastStore((st) => st.push);
  const units = usePrefsStore((st) => st.prefs.units);
  const planStops = useRidePlanStore((st) => st.stops);
  const destination = useRidePlanStore((st) => st.destination);
  const routeData = useRouteStore((st) => st.route);
  const own = useRouteStore((st) => st.lastValidLocation);
  const clusters = useRouteStore((st) => st.activeClusters);
  const room = useRideRoom(groupId, uid);
  const { ride, members, lead } = room;
  const [now, setNow] = useState(() => Date.now());
  const since = useRef(Date.now());
  const rolled = useRef(false);
  const leadPrev = useRef<string | undefined>(undefined);
  const [fuelling, setFuelling] = useState(false);

  const stopName = useMemo(() => {
    const byId = stopId ? planStops.find((p) => p.id === stopId) : undefined;
    if (byId) return byId.label.split(',')[0];
    if (own) {
      const near = planStops
        .map((p) => ({ p, d: haversineMeters(own.lat, own.lng, p.lat, p.lng) }))
        .filter((x) => x.d <= 300)
        .sort((a, b) => a.d - b.d)[0];
      if (near) return near.p.label.split(',')[0];
    }
    return 'Break';
  }, [stopId, planStops, own]);

  // you pulled in: say so (presence), record it, and remember this stop so Live does not open Stop again for it
  useEffect(() => {
    if (!groupId || !uid) return;
    setPresence(groupId, uid, 'stopped').catch((e) => warn('[Stop] presence write failed:', e));
    if (stopId) markStopVisited(groupId, stopId);
    rideRecorder.addEvent('stop', stopName === 'Break' ? 'Stopped for a break' : `Stopped at ${stopName}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, [groupId, uid]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const states = useMemo(() => presenceMap(room.presence), [room.presence]);
  const memberIds = ride?.member_ids ?? [];
  const meState = uid ? states.get(uid) : undefined;
  const meReady = meState === 'ready';
  const readyCount = memberIds.filter((id) => states.get(id) === 'ready').length;
  const allReady = memberIds.length > 0 && readyCount === memberIds.length;
  const isLead = uid != null && uid === lead;
  const leadNow = lead ? states.get(lead) : undefined;

  const breakOver = useCallback(() => {
    if (rolled.current || !groupId) return;
    rolled.current = true;
    useOverlayStore.getState().show({ kind: 'rollout', groupId, next: 'Live' });
  }, [groupId]);

  // everybody ready -> break over; the lead rolling on (after being ready) takes the ready riders with him
  useEffect(() => {
    const prev = leadPrev.current;
    leadPrev.current = leadNow;
    if (!shouldRoll({ allReady, meReady, leadPrev: prev, leadNow })) return;
    const t = setTimeout(breakOver, ROLL_DELAY_MS);
    return () => clearTimeout(t);
  }, [allReady, meReady, leadNow, breakOver]);

  const setMine = useCallback(
    (state: 'ready' | 'stopped' | 'fuel') => {
      if (!uid) return;
      setPresence(groupId, uid, state).catch((e) => {
        warn('[Stop] presence write failed:', e);
        push('Could not update. Check your signal', 'error');
      });
    },
    [groupId, uid, push],
  );
  const onReady = useCallback(() => {
    if (meReady) {
      setFuelling(false);
      setMine('stopped');
    } else {
      setFuelling(false);
      setMine('ready');
    }
  }, [meReady, setMine]);
  const onFuel = useCallback(() => {
    const next = !fuelling;
    setFuelling(next);
    setMine(next ? 'fuel' : 'stopped');
  }, [fuelling, setMine]);

  const tiles = members.map((m) => {
    const p = presenceLabel(states.get(m.uid), m.me);
    return { uid: m.uid, name: m.name, initials: m.initials, color: m.color, status: p.label, ready: p.ready, me: m.me };
  });

  // cheap enough to recompute with the 1 s timer (and it must see the stop just marked as visited)
  const leg = nextLeg({
    routePath: routeData?.path_points ?? null,
    distanceKm: routeData?.distance_km ?? null,
    etaMinutes: routeData?.eta_minutes ?? null,
    own: own ? { lat: own.lat, lng: own.lng } : null,
    stops: planStops.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, name: p.label.split(',')[0] })),
    visited: visitedStopIds(groupId),
    destinationName: destination?.label?.split(',')[0] ?? null,
    clusters,
  });
  const fuellers = members.filter((m) => !m.me && states.get(m.uid) === 'fuel');
  const legSub = leg
    ? [leg.km != null ? formatDistance(leg.km, units) : null, leg.minutes != null ? `${Math.max(1, Math.round(leg.minutes))} min` : null].filter(Boolean).join(' ∙ ')
    : '';
  const rollLabel = meReady ? (isLead ? 'Roll out' : allReady ? 'Roll out' : 'Ready ✓') : 'I’m ready to roll';
  const layout = useLiveLayout(glove);
  const btnH = layout.controlH;

  return (
    <>
      <RoadFrame
        testID="screen-Stop"
        glove={glove}
        dock={
          <>
            <View style={{ height: btnH, justifyContent: 'center' }}>
              <SosFab width={layout.sosKeyW} height={btnH} onHoldComplete={() => { rideRecorder.addEvent('sos', 'SOS sent'); triggerSosFlow(groupId).catch((e: unknown) => warn('[Stop] SOS flow failed:', e)); }} />
            </View>
            <Button
              testID="btn-ready"
              label={rollLabel}
              variant={meReady && !(isLead || allReady) ? 'ok' : 'primary'}
              accessibilityLabel={meReady ? (isLead || allReady ? 'Roll out' : 'Ready. Tap to cancel') : 'I am ready to roll'}
              onPress={meReady && (isLead || allReady) ? breakOver : onReady}
              style={{ flex: 1, height: btnH, borderRadius: 24 }}
            />
          </>
        }
      >
        <Plate
          tone="green"
          title={stopName}
          subtitle={ride ? `Break ∙ ${ride.name}` : 'Break'}
          titleSize={30}
          titleLines={2}
          style={{ justifyContent: 'space-between' }}
          right={<Text style={[type.num, { fontSize: 38, lineHeight: 40, color: '#FFFFFF', letterSpacing: -0.8 }]} testID="break-timer" numberOfLines={1} maxFontSizeMultiplier={CAP.fixed}>{breakClock(now - since.current)}</Text>}
          testID="stop-plate"
        />
        <Text style={[type.label, { marginTop: 24 }]} testID="crew-ready-label">{`CREW ∙ ${readyCount} OF ${memberIds.length} READY TO ROLL`}</Text>
        <TileGrid tiles={tiles} style={{ marginTop: 12 }} testID="stop-tiles" />

        {leg ? (
          <View style={{ marginTop: 16, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.line, padding: 18 }} testID="next-leg">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card2, borderWidth: 1.5, borderColor: colors.line }}>
                <Icon name="flag" size={20} color={colors.ink} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={type.h3} numberOfLines={2}>{`Next leg ∙ ${leg.name}`}</Text>
                {legSub ? <Text style={type.sm}>{legSub}</Text> : null}
              </View>
            </View>
            {leg.hazards > 0 || fuellers.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                {fuellers.map((m) => <LegChip key={m.uid} icon="fuel" text={`${m.name} is fuelling`} />)}
                {leg.hazards > 0 ? <LegChip icon="haz" text={`${leg.hazards} hazard${leg.hazards > 1 ? 's' : ''} on the way`} /> : null}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', marginTop: 16 }}>
          <Chip label="I’m fuelling" on={fuelling} onPress={onFuel} icon={<Icon name="fuel" size={18} color={fuelling ? colors.bg : colors.ink} />} testID="chip-fuel" />
        </View>
      </RoadFrame>
      <ToastContainer top={Math.max(insets.top, 24) + 16} />
    </>
  );
}

function LegChip({ icon, text }: { icon: 'fuel' | 'haz'; text: string }) {
  const { colors, type } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 34, maxWidth: '100%', paddingVertical: 4, paddingLeft: 8, paddingRight: 12, borderRadius: 17, backgroundColor: colors.card2, borderWidth: 1.5, borderColor: colors.line }}>
      <View style={{ width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card }}>
        <Icon name={icon} size={12} color={colors.ink} />
      </View>
      <Text style={[type.smStrong, { fontSize: 13, flexShrink: 1 }]}>{text}</Text>
    </View>
  );
}
