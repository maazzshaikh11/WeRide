/**
 * SosIncomingOverlay — another rider's SOS, full screen (demo incomingSOS / insRender; docs/DEMO_PARITY_SPEC.md §3 SOS).
 * Real name + bike (profiles), real distance and "behind / ahead of you" from the two fixes, a dark map sketch of both
 * positions, the responders (sos_events/{id}/responders), "I'm going" -> "I'm with <name>", Call 112. Numbers are private,
 * so there is no "Call <name>". When the sender cancels, this closes with the green "False alarm" toast.
 */
/* eslint-disable no-console -- failures here are logged for diagnostics; the rider is told through the UI */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouteStore } from '@routing/client/routeStore';
import { Plates, THEMES, avatarColor } from '../theme/palettes';
import { ThemeContext, buildTheme, useTheme } from '../theme/ThemeProvider';
import { Avatar, MapSketch, PressableScale, haptic } from '../ui';
import type { SketchMarker } from '../ui';
import { useAppStore } from '../store/appStore';
import { OverlayState, useOverlayStore } from '../store/overlayStore';
import { riderInitials, riderName, useProfileStore } from '../store/profileStore';
import { useRidersStore } from '../store/ridersStore';
import { useSessionStore } from '../store/sessionStore';
import { useToastStore } from '../store/toastStore';
import { useUnits } from '../store/prefsStore';
import { respondToSos, subscribeResponders } from '../services/sosFlowService';
import type { SosResponder } from '../services/sosFlowService';
import { ageLabel, distanceM, isRealPosition, relativeDirection } from '../services/sosFormat';
import { formatShortDistance } from '../utils/units';
import OverlayToast, { useOverlayToast } from './OverlayToast';
import { useSosEventsStore } from './sosEventsStore';

type InState = Extract<OverlayState, { kind: 'sos-incoming' }>;

const RED = Plates.red.bg;
const FG = Plates.red.fg;
const CARD = 'rgba(0,0,0,0.2)';

export default function SosIncomingOverlay({ state }: { state: OverlayState }) {
  if (state.kind !== 'sos-incoming') return null;
  return <Body state={state} />;
}

function Body({ state }: { state: InState }) {
  const { type, themeId } = useTheme();
  const darkTheme = useMemo(() => buildTheme(themeId, THEMES[themeId].dark), [themeId]);
  const insets = useSafeAreaInsets();
  const { toast, show: showToast } = useOverlayToast();
  const units = useUnits();
  const sessionUid = useSessionStore((s) => s.uid);
  const appUid = useAppStore((s) => s.userId);
  const me = sessionUid ?? appUid;
  const byId = useProfileStore((s) => s.byId);
  const riders = useRidersStore((s) => s.riders);
  const myFix = useRouteStore((s) => s.lastValidLocation ?? s.currentLocation);
  const events = useSosEventsStore((s) => s.events);

  const { sosId, riderId } = state;
  const name = riderName(byId, riderId, me);
  const bike = byId[riderId]?.bike;

  useEffect(() => {
    useProfileStore.getState().ensure([riderId]);
    haptic('heavy');
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [riderId]);

  // tick for the age label
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // The sender resolves their SOS -> close with the green toast (only after we have seen it active, so a slow first sync is not "cancelled").
  const seenActive = useRef(false);
  useEffect(() => {
    const present = events.some((e) => e.sos_id === sosId);
    if (present) {
      seenActive.current = true;
      return;
    }
    if (seenActive.current && useOverlayStore.getState().current?.kind === 'sos-incoming') {
      useOverlayStore.getState().hide();
      useToastStore.getState().push(`${name} cancelled the SOS — False alarm`, 'success');
    }
  }, [events, sosId, name]);

  // Responders (real).
  const [responders, setResponders] = useState<SosResponder[]>([]);
  useEffect(() => {
    const unsub = subscribeResponders(sosId, setResponders);
    return unsub;
  }, [sosId]);
  useEffect(() => {
    const uids = responders.map((r) => r.uid);
    if (uids.length) useProfileStore.getState().ensure(uids);
  }, [responders]);

  const [mine, setMine] = useState<null | 'going' | 'arrived'>(null);
  const myState = responders.find((r) => r.uid === me)?.state ?? mine;
  const going = myState === 'going' || myState === 'arrived';

  // Positions: the sender's live fix when we have one, else where the SOS was raised.
  const senderPos = useMemo(() => {
    const live = riders.get(riderId)?.location;
    if (live && isRealPosition(live.lat, live.lng)) return { lat: live.lat, lng: live.lng };
    return isRealPosition(state.lat, state.lng) ? { lat: state.lat, lng: state.lng } : null;
  }, [riders, riderId, state.lat, state.lng]);
  const myPos = myFix && isRealPosition(myFix.lat, myFix.lng) ? myFix : null;
  const gapM = senderPos && myPos ? distanceM(myPos, senderPos) : null;
  const dir = senderPos && myPos ? relativeDirection(myPos, senderPos) : null;

  const others = responders.filter((r) => r.uid !== me);
  const distOf = (uid: string): number | null => {
    const loc = riders.get(uid)?.location;
    return loc && senderPos && isRealPosition(loc.lat, loc.lng) ? distanceM(loc, senderPos) : null;
  };

  const markers: SketchMarker[] = [];
  if (senderPos) markers.push({ lat: senderPos.lat, lng: senderPos.lng, kind: 'rider', color: darkTheme.colors.bad });
  if (myPos) markers.push({ lat: myPos.lat, lng: myPos.lng, kind: 'rider', color: darkTheme.colors.pri });

  const iAmGoing = () => {
    if (!me || going) return;
    setMine('going');
    showToast('Crew sees you responding', 'black');
    respondToSos(sosId, me, 'going').catch((e) => {
      console.warn('[SosIncoming] could not tell the crew:', e);
      setMine(null);
      showToast('Couldn’t tell the crew. Try again.', 'yellow');
    });
  };
  const iAmWith = () => {
    if (!me) return;
    respondToSos(sosId, me, 'arrived').catch((e) => console.warn('[SosIncoming] arrived write failed:', e));
    useOverlayStore.getState().hide();
    useToastStore.getState().push(`Crew sees you with ${name}`, 'info');
  };
  const call112 = () => useOverlayStore.getState().show({ kind: 'call112', back: state });
  const dismiss = () => useOverlayStore.getState().hide();

  const top = Math.max(insets.top, 24);
  const ago = state.startedMs ? `SOS · ${ageLabel(now - state.startedMs)}` : 'SOS';
  const where = gapM != null ? `${formatShortDistance(gapM, units)} ${dir === 'behind' ? 'behind you' : dir === 'ahead' ? 'ahead of you' : 'away'}` : 'Location not shared yet';

  return (
    <View style={st.root} testID="overlay-SosIncoming" accessibilityViewIsModal>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: top + 22, paddingBottom: 230 }} showsVerticalScrollIndicator={false}>
        <Text style={[type.label, { color: FG, opacity: 0.85, letterSpacing: 2.75 }]} testID="sosin-ago">{ago}</Text>
        <Text
          style={[type.display, { color: FG, fontSize: 52, lineHeight: 52, letterSpacing: -1.8, marginTop: 8 }]}
          numberOfLines={3}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          accessibilityRole="header"
          testID="sosin-title"
        >
          {`${name.toUpperCase()}\nNEEDS HELP`}
        </Text>
        <Text style={[type.h3, { color: FG, marginTop: 12 }]} testID="sosin-where">
          <Text style={type.num}>{where}</Text>
          {bike ? ` · ${bike}` : ''}
        </Text>

        {senderPos ? (
          <View style={st.mapWrap} testID="sosin-map">
            <ThemeContext.Provider value={darkTheme}>
              <MapSketch points={[]} markers={markers} height={190} pad={44} />
            </ThemeContext.Provider>
          </View>
        ) : null}

        <View style={{ marginTop: 16, gap: 8 }}>
          {others.length === 0 && !going ? (
            <View style={st.rowCard} accessible accessibilityLabel="No one has responded yet" testID="sosin-none">
              <Text style={[type.sm, { color: FG, opacity: 0.85 }]}>No one has responded yet</Text>
            </View>
          ) : null}
          {others.map((r, i) => {
            const d = distOf(r.uid);
            const n = riderName(byId, r.uid, me);
            const tail = r.state === 'arrived' ? `with ${name}` : 'responding';
            return (
              <View key={r.uid} style={st.rowCard} accessible accessibilityLabel={`${n}, ${d != null ? formatShortDistance(d, units) + ', ' : ''}${tail}`} testID={`sosin-resp-${r.uid}`}>
                <Avatar initials={riderInitials(byId, r.uid)} color={avatarColor(i)} size={36} ring={false} />
                <Text style={[type.h3, { color: FG, fontSize: 16, flex: 1 }]} numberOfLines={1}>{n}</Text>
                <Text style={[type.smStrong, { color: FG }]}>{d != null ? `${formatShortDistance(d, units)} · ${tail}` : tail}</Text>
              </View>
            );
          })}
          {going ? (
            <View style={[st.rowCard, { backgroundColor: FG }]} accessible accessibilityLabel={`You, ${myState === 'arrived' ? 'with ' + name : 'going'}`} testID="sosin-you">
              <Avatar initials={riderInitials(byId, me ?? '')} me size={36} ring={false} />
              <Text style={[type.h3, { color: RED, fontSize: 16, flex: 1 }]}>You</Text>
              <Text style={[type.smStrong, { color: RED, fontFamily: type.h3.fontFamily }]}>
                {gapM != null ? `${formatShortDistance(gapM, units)} · ` : ''}{myState === 'arrived' ? `with ${name}` : 'going'}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <PressableScale onPress={dismiss} accessibilityRole="button" accessibilityLabel="Not now, close this alert" style={[st.notNow, { top: top - 2 }]} testID="sosin-dismiss">
        <Text style={[type.buttonXs, { color: FG }]}>Not now</Text>
      </PressableScale>

      <View style={[st.bottom, { bottom: Math.max(insets.bottom, 12) + 18 }]}>
        {going ? (
          <PressableScale onPress={iAmWith} accessibilityRole="button" accessibilityLabel={`I’m with ${name}`} style={[st.big, { height: 80 }]} testID="sosin-arrived">
            <Text style={[type.button, { color: RED, fontSize: 22, lineHeight: 26 }]} numberOfLines={1}>{`I’m with ${name}`}</Text>
          </PressableScale>
        ) : (
          <PressableScale onPress={iAmGoing} accessibilityRole="button" accessibilityLabel="I’m going" style={[st.big, { height: 84 }]} testID="sosin-going">
            <Text style={[type.button, { color: RED, fontSize: 26, lineHeight: 30 }]}>I’m going</Text>
          </PressableScale>
        )}
        <PressableScale onPress={call112} accessibilityRole="button" accessibilityLabel="Call 112, emergency services" style={[st.big, { height: 60 }]} testID="sosin-call112">
          <Text style={[type.button, { color: RED }]}>Call 112</Text>
        </PressableScale>
      </View>
      <OverlayToast toast={toast} />
    </View>
  );
}

const st = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: RED, overflow: 'hidden' },
  mapWrap: { marginTop: 16, borderRadius: 22, overflow: 'hidden', borderWidth: 3, borderColor: FG },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: CARD, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, minHeight: 56 },
  notNow: { position: 'absolute', right: 16, minHeight: 44, paddingHorizontal: 14, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.28)', alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 14, right: 14, gap: 10 },
  big: { borderRadius: 22, backgroundColor: FG, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
});
