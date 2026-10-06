/**
 * SosSentOverlay — the red full-screen "SOS SENT" (demo startSOS / sosRows / endSOS; docs/DEMO_PARITY_SPEC.md §3 SOS).
 * Everything on it is the REAL result of triggerSosFlow: sent vs saved-offline, the position used, how many crew the ride
 * has, the rider's own emergency contacts (each opens the SMS composer, the app never sends SMS), whether tracking is on,
 * and the responders as they tap "I'm going". Variants: auto (crash), drill (nothing is sent), offline (queued).
 */
/* eslint-disable no-console -- failures here are logged for diagnostics; the rider is told through the UI */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { queuePeek, SOS_QUEUE } from '@hazard/crdt/localQueue';
import { useRouteStore } from '@routing/client/routeStore';
import { Plates } from '../theme/palettes';
import { useTheme } from '../theme/ThemeProvider';
import { Icon, IconName, Plate, PressableScale, haptic, useReducedMotion } from '../ui';
import { useAppStore } from '../store/appStore';
import { OverlayState, useOverlayStore } from '../store/overlayStore';
import { usePrefsStore } from '../store/prefsStore';
import { riderName, useProfileStore } from '../store/profileStore';
import { useRidersStore } from '../store/ridersStore';
import { useRidesStore } from '../store/ridesStore';
import { useSessionStore } from '../store/sessionStore';
import { useToastStore } from '../store/toastStore';
import { cancelSos, subscribeResponders, useSosSessionStore } from '../services/sosFlowService';
import type { SosResponder } from '../services/sosFlowService';
import { formatClock, formatFixLine, isRealPosition, nearestResponder, smsLink, Fix } from '../services/sosFormat';
import { useUnits } from '../store/prefsStore';
import { formatShortDistance } from '../utils/units';
import { useResponsive, useScaleBy } from '../theme/responsive';
import { CAP } from '../theme/textPolicy';
import HazardStripes from './HazardStripes';
import OverlayFrame from './OverlayFrame';
import HoldButton from './HoldButton';
import OverlayToast, { useOverlayToast } from './OverlayToast';

type SentState = Extract<OverlayState, { kind: 'sos-sent' }>;

const RED = Plates.red.bg;
const FG = Plates.red.fg;
const CARD = 'rgba(0,0,0,0.2)';
const CANCEL_HOLD_MS = 2000;
const END_PLATE_MS = 1700;

export default function SosSentOverlay({ state }: { state: OverlayState }) {
  if (state.kind !== 'sos-sent') return null;
  return <Body state={state} />;
}

function PulseDot() {
  const reduced = useReducedMotion();
  const o = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 0.3, duration: 450, useNativeDriver: true }),
        Animated.timing(o, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [o, reduced]);
  return <Animated.Text style={{ color: FG, fontSize: 14, opacity: o }}>●</Animated.Text>;
}

type RowKind = 'done' | 'pending' | 'offline' | 'action' | 'none';
const ROW_ICON: Record<RowKind, IconName | null> = { done: 'check', pending: null, offline: 'wifioff', action: 'phone', none: 'phone' };

function Row({ kind, title, sub, extra, onPress, testID, accessibilityLabel }: {
  kind: RowKind; title: string; sub: string; extra?: string; onPress?: () => void; testID?: string; accessibilityLabel?: string;
}) {
  const { type } = useTheme();
  const solid = kind === 'done' || kind === 'action';
  const icon = ROW_ICON[kind];
  const body = (
    <>
      <View style={[st.disk, { backgroundColor: solid ? FG : 'rgba(255,255,255,0.2)' }]}>
        {icon ? <Icon name={icon} size={18} color={solid ? RED : FG} /> : <PulseDot />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[type.h3, { color: FG }]}>{title}</Text>
        {extra ? <Text style={[type.num, { color: FG, fontSize: 14, lineHeight: 18, marginTop: 4 }]}>{extra}</Text> : null}
        <Text style={[type.sm, { color: FG, opacity: 0.85, marginTop: 4 }]}>{sub}</Text>
      </View>
    </>
  );
  if (onPress) {
    return (
      <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? `${title}. ${sub}`} style={st.row} testID={testID}>
        {body}
      </PressableScale>
    );
  }
  return (
    <View style={st.row} accessible accessibilityLabel={accessibilityLabel ?? `${title}. ${sub}`} testID={testID}>
      {body}
    </View>
  );
}

function Body({ state }: { state: SentState }) {
  const { type } = useTheme();
  const insets = useSafeAreaInsets();
  const { isShortHeight } = useResponsive();
  const sz = useScaleBy();
  const { toast, show: showToast } = useOverlayToast();
  const drill = !!state.drill;
  const auto = !!state.auto;
  const sosId = state.sosId;
  const groupId = state.groupId ?? '';

  // The outcome of the send (position used, queued or not). Without one (overlay raised by something else) fall back honestly.
  const stored = useSosSessionStore((s) => s.session);
  const session = stored && stored.sosId === sosId && stored.drill === drill ? stored : null;
  const routeFix = useRouteStore((s) => s.lastValidLocation ?? s.currentLocation);
  const startedMs = useRef(session?.startedMs ?? Date.now()).current;
  const fix = useMemo<Fix | null>(
    () => (session ? session.fix : routeFix && isRealPosition(routeFix.lat, routeFix.lng) ? { lat: routeFix.lat, lng: routeFix.lng, accuracy_m: routeFix.accuracy_m } : null),
    [session, routeFix],
  );
  const queued = !drill && !!session?.queued;

  const sessionUid = useSessionStore((s) => s.uid);
  const appUid = useAppStore((s) => s.userId);
  const me = sessionUid ?? appUid;
  const appGroup = useAppStore((s) => s.groupId);
  const myName = useProfileStore((s) => s.me?.name) ?? null;
  const byId = useProfileStore((s) => s.byId);
  const contacts = usePrefsStore((s) => s.contacts);
  const units = useUnits();
  const connected = useRidersStore((s) => s.connected);
  const riders = useRidersStore((s) => s.riders);
  const rides = useRidesStore((s) => s.rides);
  const hasFix = useRouteStore((s) => !!(s.lastValidLocation || s.currentLocation));
  const tracking = hasFix && !!appGroup;

  const crewCount = useMemo(() => {
    const ride = rides.find((r) => r.id === groupId);
    if (ride) return ride.member_ids.filter((u) => u !== me).length;
    const others = [...riders.keys()].filter((u) => u !== me).length;
    return others > 0 ? others : null;
  }, [rides, riders, groupId, me]);

  // Responders (real), only for a real SOS.
  const [responders, setResponders] = useState<SosResponder[]>([]);
  useEffect(() => {
    if (!sosId || drill) return;
    return subscribeResponders(sosId, (r) => setResponders(r.filter((x) => x.uid !== me)));
  }, [sosId, drill, me]);
  useEffect(() => {
    const uids = responders.map((r) => r.uid);
    if (uids.length) useProfileStore.getState().ensure(uids);
  }, [responders]);
  const nearest = useMemo(
    () => nearestResponder(responders, fix, (uid) => riders.get(uid)?.location),
    [responders, fix, riders],
  );

  // A queued SOS goes out by itself when signal returns: notice it leaving the on-phone queue.
  const delivered = useRef(false);
  useEffect(() => {
    if (!queued || !sosId) return;
    const t = setInterval(() => {
      let waiting = true;
      try {
        waiting = queuePeek(SOS_QUEUE).some((op) => op.type === 'sos_event' && (op.data as { sos_id?: string }).sos_id === sosId);
      } catch {
        return;
      }
      if (!waiting && !delivered.current) {
        delivered.current = true;
        useSosSessionStore.getState().markDelivered(sosId);
        haptic('success');
        showToast('Signal back ∙ SOS delivered', 'green');
      }
    }, 1500);
    return () => clearInterval(t);
  }, [queued, sosId, showToast]);

  useEffect(() => {
    // The SOS screen must not be dismissed by the Android back button.
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  // End plate (cancelled / drill complete), then close.
  const [ended, setEnded] = useState<null | { title: string; sub: string }>(null);
  useEffect(() => {
    if (!ended) return;
    const t = setTimeout(() => {
      if (useOverlayStore.getState().current?.kind === 'sos-sent') useOverlayStore.getState().hide();
    }, END_PLATE_MS);
    return () => clearTimeout(t);
  }, [ended]);

  const holdMs = usePrefsStore((s) => s.prefs.hold_ms);
  const finish = useCallback(async () => {
    if (drill) {
      setEnded({ title: 'Drill complete', sub: `Time to send: ${holdMs / 1000} s. Nobody was alerted.` });
      return;
    }
    try {
      if (sosId) await cancelSos(sosId, groupId);
      setEnded({ title: 'SOS cancelled', sub: queued ? 'Saved on this phone. Your crew is told when you have signal.' : 'Your crew was told: false alarm.' });
    } catch (e) {
      console.warn('[SosSentOverlay] cancel failed:', e);
      useToastStore.getState().push('Couldn’t cancel the SOS. Try again.', 'error');
    }
  }, [drill, holdMs, sosId, groupId, queued]);

  const openSms = (number: string) => {
    Linking.openURL(smsLink(number, myName, fix)).catch(() => showToast('Couldn’t open your messages', 'yellow'));
  };
  const call112 = () => useOverlayStore.getState().show({ kind: 'call112', back: state });

  if (ended) {
    return (
      <View style={[st.root, { backgroundColor: Plates.black.bg, justifyContent: 'center', padding: 30 }]} testID="sos-ended">
        <Plate tone="green" title={ended.title} subtitle={ended.sub} icon="check" titleSize={30} titleLines={2} />
      </View>
    );
  }

  const top = Math.max(insets.top, 24);
  const callH = isShortHeight ? 64 : 76;
  const okH = isShortHeight ? 60 : 68;
  const helpLabel = auto ? 'CRASH DETECTED ∙ SENT AUTOMATICALLY' : drill ? 'PRACTICE' : 'HELP IS COMING';
  const big = queued ? 'SOS SAVED' : 'SOS SENT';
  const stamp = `${formatClock(startedMs)} ∙ ${formatFixLine(fix)}`;

  const sentToCrew = crewCount == null ? 'Sent to your crew' : `Sent to ${crewCount} crew`;
  const crewRow = drill
    ? { kind: 'done' as RowKind, title: 'Crew would be alerted', sub: crewCount == null ? 'Nobody is alerted in a drill' : `${crewCount} crew would get it ∙ nobody is alerted in a drill` }
    : queued
      ? { kind: 'offline' as RowKind, title: 'Crew alerted', sub: 'Queued on this phone' }
      : { kind: 'done' as RowKind, title: 'Crew alerted', sub: sentToCrew };

  const trackingRow = tracking
    ? { kind: (connected || drill ? 'done' : 'offline') as RowKind, sub: connected || drill ? 'Your crew sees you move' : 'Your crew sees you move again when signal returns' }
    : { kind: 'pending' as RowKind, sub: 'Starting…' };

  const respName = nearest ? riderName(byId, nearest.uid, me) : '';
  const respSub = (() => {
    if (!nearest) return '';
    const parts: string[] = [];
    parts.push(nearest.distanceM != null ? formatShortDistance(nearest.distanceM, units) : nearest.state === 'arrived' ? 'With you' : 'On the way');
    if (nearest.etaMin != null) parts.push(`about ${nearest.etaMin} min away`);
    if (nearest.others > 0) parts.push(`${nearest.others} also responding`);
    return parts.join(' ∙ ');
  })();
  const responderRow = drill
    ? { kind: 'done' as RowKind, title: 'The nearest rider would be told', sub: 'Nobody is alerted in a drill' }
    : nearest
      ? { kind: 'done' as RowKind, title: nearest.state === 'arrived' ? `${respName} is with you` : `${respName} is coming to you`, sub: respSub }
      : queued
        ? { kind: 'offline' as RowKind, title: 'Finding the nearest rider', sub: 'Starts when your SOS reaches the crew' }
        : { kind: 'pending' as RowKind, title: 'Finding the nearest rider', sub: 'Waiting for a rider to tap “I’m going”' };

  return (
    <View style={st.root} testID="overlay-SosSent" accessibilityViewIsModal>
      {drill ? (
        <View style={{ height: 34, marginTop: top + 6 }} testID="sos-drill-banner">
          <HazardStripes style={StyleSheet.absoluteFill} />
          <View style={st.drillWrap}>
            <Text style={[st.drillText, { fontFamily: type.plateTitle.fontFamily }]}>DRILL ∙ NOBODY IS ALERTED</Text>
          </View>
        </View>
      ) : null}
      <OverlayFrame
        bg={RED}
        paddingTop={drill ? 18 : top + 16}
        dock={
          <>
            <PressableScale onPress={call112} accessibilityRole="button" accessibilityLabel="Call 112, emergency services" style={[st.call, { height: callH }]} testID="sos-call112">
              <Icon name="phone" size={28} color={RED} />
              <Text style={[type.button, { color: RED, fontSize: 24, lineHeight: 28 }]} numberOfLines={1} maxFontSizeMultiplier={CAP.hud}>Call 112</Text>
            </PressableScale>
            {drill ? (
              <PressableScale onPress={finish} accessibilityRole="button" accessibilityLabel="End drill" style={[st.ok, { height: okH }]} testID="sos-end-drill">
                <Text style={[type.button, { color: FG, fontSize: 18, lineHeight: 22 }]} maxFontSizeMultiplier={CAP.hud}>End drill</Text>
              </PressableScale>
            ) : (
              <HoldButton
                label="I’m OK ∙ hold 2 s to cancel"
                ms={CANCEL_HOLD_MS}
                onDone={finish}
                onEarlyRelease={() => showToast('Hold 2 s to cancel — so it can’t be cancelled by accident', 'black')}
                fillColor="rgba(255,255,255,0.32)"
                style={[st.ok, { height: okH }]}
                textStyle={[type.button, { color: FG, fontSize: 18, lineHeight: 22 }]}
                textProps={{ maxFontSizeMultiplier: CAP.hud, numberOfLines: 2, adjustsFontSizeToFit: true, minimumFontScale: 0.75 }}
                accessibilityLabel="I’m OK. Press and hold for 2 seconds to cancel the SOS"
                accessibilityHint="Cancels the SOS and tells your crew it was a false alarm"
                testID="sos-cancel-hold"
              />
            )}
          </>
        }
      >
        <Text style={[type.label, { color: FG, opacity: 0.85, letterSpacing: 2.75 }]} testID="sos-label">{helpLabel}</Text>
        <Text style={[type.display, { color: FG, fontSize: sz(58), lineHeight: sz(58), letterSpacing: -sz(58) * 0.035, marginTop: 8 }]} accessibilityRole="header" testID="sos-big" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={CAP.fixed}>{big}</Text>
        <Text style={[type.num, { color: FG, fontSize: 14, lineHeight: 18, opacity: 0.9, marginTop: 8 }]} testID="sos-stamp" maxFontSizeMultiplier={CAP.hud}>{stamp}</Text>

        {queued ? (
          <View style={{ marginTop: 16 }} testID="sos-offline-plate">
            <Plate tone="yellow" icon="wifioff" title="No signal ∙ queued" titleSize={22} subtitle="Saved on this phone. It sends itself the moment you have signal." subtitleLines={4} />
          </View>
        ) : null}

        <View style={{ marginTop: 14, gap: 8 }}>
          <Row {...crewRow} testID="sos-row-crew" />
          {contacts.length === 0 ? (
            <Row kind="none" title="Add an emergency contact in Me" sub="Then SOS can open a text to them for you" testID="sos-row-nocontact" />
          ) : (
            contacts.map((c) => (
              <Row
                key={c.id}
                kind="action"
                title={`Text ${c.name}`}
                extra={c.number}
                sub="Opens your messages — we can’t send SMS for you"
                onPress={() => openSms(c.number)}
                accessibilityLabel={`Text ${c.name} at ${c.number}. Opens your messages`}
                testID={`sos-text-${c.id}`}
              />
            ))
          )}
          <Row {...trackingRow} title="Live location on" testID="sos-row-live" />
          <Row {...responderRow} testID="sos-row-responder" />
        </View>
      </OverlayFrame>
      <OverlayToast toast={toast} />
    </View>
  );
}

const st = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: RED, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: CARD, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 16, minHeight: 44 },
  disk: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  drillWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  drillText: { backgroundColor: Plates.yellow.fg, color: Plates.yellow.bg, paddingVertical: 3, paddingHorizontal: 12, borderRadius: 5, fontSize: 12, lineHeight: 14, letterSpacing: 2.4, overflow: 'hidden' },
  call: { borderRadius: 22, backgroundColor: FG, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  ok: { minHeight: 60, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.28)', alignItems: 'center', justifyContent: 'center' },
});
