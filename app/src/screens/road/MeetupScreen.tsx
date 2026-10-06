/**
 * Meetup (roll call) — demo `meetup` / `meetup-waiting` / `meetup-ready`, with REAL data (docs/DEMO_PARITY_SPEC.md §3):
 *  - a tile for every member: ready (roll_call) / at meetup (fix within 150 m) / in N min (distance ÷ their speed) / no signal yet,
 *    Lead / Sweep pills from the crew roles;
 *  - a sketch map of the meetup point and the riders' last known positions;
 *  - the ready check from real state (GPS accuracy, location permission, SOS contact, voice channel);
 *  - "I'm ready" / "Ready · waiting for N" (tap again = not ready); the LEAD also gets "Roll out", and when everybody is
 *    ready the lead's phone starts the roll-out itself. Every phone follows the ride turning `live` (RideLifecycleBridge).
 * Opening the screen on a `planned` ride opens the roll call (`meetup`).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import { Button, Icon, MapSketch, Pill, Screen, TopBar } from '../../ui';
import type { SketchMarker } from '../../ui';
import ToastContainer from '../../components/ToastContainer';
import { useAppStore } from '../../store/appStore';
import { usePrefsStore } from '../../store/prefsStore';
import { useRidersStore } from '../../store/ridersStore';
import { useToastStore } from '../../store/toastStore';
import { resetRideSession } from '../../store/rideSession';
import { setRideStatus, setRollCall } from '../../services/rideService';
import { getPermissionStatus } from '../../services/permissionsService';
import { useVoiceStore } from '../../hooks/useVoiceChannel';
import { P } from '../../models/paths';
import { navigationRef } from '../../navigation/navigationRef';
import { warn } from '../../utils/log';
import { useRideRoom } from './parts/useRideRoom';
import { useOwnPosition } from './parts/useOwnPosition';
import { countdownLabel, everyoneReady, memberStatus, readyChecks, readySet } from './parts/rollCall';
import { leadDisplayName } from './parts/members';
import ReadyChip from './parts/ReadyChip';
import TileGrid, { TileSpec } from './parts/TileGrid';
import { useProfileStore } from '../../store/profileStore';

interface Props {
  navigation?: { goBack: () => void; canGoBack?: () => boolean; reset?: (s: { index: number; routes: { name: string }[] }) => void };
  route?: { params?: { groupId?: string } };
}

/** Auto roll-out waits a beat after the last rider turns ready so everyone sees the full green grid first. */
export const AUTO_ROLL_DELAY_MS = 700;

export default function MeetupScreen({ navigation, route }: Props) {
  const groupId = route?.params?.groupId ?? '';
  const { colors, type } = useTheme();
  const s = useStyles(({ colors: c }) => ({
    mapWrap: { marginTop: 14, borderRadius: 22, overflow: 'hidden', borderWidth: 1.5, borderColor: c.line },
    mapPill: { position: 'absolute', left: 10, top: 10 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    ctaRow: { flexDirection: 'row', gap: 10 },
  }));
  const uid = useAppStore((st) => st.userId);
  const push = useToastStore((st) => st.push);
  const contacts = usePrefsStore((st) => st.contacts);
  const voiceStatus = useVoiceStore((st) => st.status);
  const riders = useRidersStore((st) => st.riders);
  const byId = useProfileStore((st) => st.byId);
  const room = useRideRoom(groupId, uid);
  const { ride, members, lead } = room;
  const own = useOwnPosition(Boolean(groupId));
  const [locationGranted, setLocationGranted] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const opened = useRef(false);
  const rolled = useRef(false);

  // The app's active ride is this one (Live, SOS and hazards all key on it).
  useEffect(() => {
    if (!groupId) return;
    if (useAppStore.getState().groupId !== groupId) {
      resetRideSession();
      useAppStore.getState().setGroupId(groupId);
    }
  }, [groupId]);

  // Riders' last known positions: the socket for live updates, plus the Firestore `locations` docs for everyone already published.
  useEffect(() => {
    if (!groupId) return;
    useRidersStore.getState().subscribe(groupId);
    let off: (() => void) | undefined;
    try {
      off = firestore()
        .collection(P.locations(groupId))
        .onSnapshot(
          (snap: { docs?: { data: () => unknown }[] }) => useRidersStore.getState().seedRiders((snap?.docs ?? []).map((d) => d.data())),
          (e: unknown) => warn('[Meetup] locations listener failed:', e),
        );
    } catch (e) {
      warn('[Meetup] could not listen to locations:', e);
    }
    return () => {
      off?.();
      // Live subscribes to the same room; only let go when we are not heading there.
      setTimeout(() => {
        if (navigationRef.isReady?.() && navigationRef.getCurrentRoute()?.name !== 'Live') useRidersStore.getState().unsubscribe();
      }, 500);
    };
  }, [groupId]);

  useEffect(() => {
    let alive = true;
    getPermissionStatus('location')
      .then((st) => alive && setLocationGranted(st === 'granted'))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Opening the roll call on a planned ride opens it for everybody.
  useEffect(() => {
    if (ride?.status === 'planned' && !opened.current) {
      opened.current = true;
      setRideStatus(groupId, 'meetup').catch((e) => warn('[Meetup] could not open the roll call:', e));
    }
  }, [ride?.status, groupId]);

  const ready = useMemo(() => readySet(room.rollCall), [room.rollCall]);
  const memberIds = ride?.member_ids ?? [];
  const allReady = everyoneReady(memberIds, ready);
  const meReady = uid != null && ready.has(uid);
  const isLead = uid != null && uid === lead;
  const meetup = ride?.meetup ?? ride?.ride_plan?.start ?? null;
  const readyCount = memberIds.filter((id) => ready.has(id)).length;
  const waiting = Math.max(0, memberIds.length - readyCount);

  const rollOut = useCallback(() => {
    if (rolled.current) return;
    rolled.current = true;
    setRideStatus(groupId, 'live').catch((e) => {
      rolled.current = false;
      warn('[Meetup] roll out failed:', e);
      push('Could not start the ride. Try again', 'error');
    });
  }, [groupId, push]);

  // Everybody ready: the lead's phone rolls out (the Bridge on every phone then shows the countdown and opens Live).
  useEffect(() => {
    if (!isLead || !allReady || ride?.status === 'live' || ride?.status === 'finished') return;
    const t = setTimeout(rollOut, AUTO_ROLL_DELAY_MS);
    return () => clearTimeout(t);
  }, [isLead, allReady, ride?.status, rollOut]);

  const toggleReady = useCallback(() => {
    if (!uid) return;
    setRollCall(groupId, uid, meReady ? 'notready' : 'ready').catch((e) => {
      warn('[Meetup] roll call write failed:', e);
      push('Could not update. Check your signal', 'error');
    });
  }, [groupId, uid, meReady, push]);

  const navigate = useCallback(() => {
    if (!meetup) {
      push('No meetup point set for this ride', 'warn');
      return;
    }
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${meetup.lat},${meetup.lng}`).catch(() => push('Could not open maps', 'warn'));
  }, [meetup, push]);

  const goBack = useCallback(() => {
    if (navigation?.canGoBack && !navigation.canGoBack() && navigation.reset) navigation.reset({ index: 0, routes: [{ name: 'GarageTabs' }] });
    else navigation?.goBack();
  }, [navigation]);

  // ---- tiles + map markers (real fixes only) ----
  const fixOf = useCallback(
    (id: string) => {
      if (id === uid) return own ? { lat: own.lat, lng: own.lng, speed_mps: own.speedMps } : null;
      const e = riders.get(id);
      return e ? { lat: e.location.lat, lng: e.location.lng, speed_mps: e.location.speed_mps } : null;
    },
    [uid, own, riders],
  );
  const tiles: TileSpec[] = members.map((m) => {
    const st = memberStatus({ ready: ready.has(m.uid), fix: fixOf(m.uid), meetup });
    return { uid: m.uid, name: m.name, initials: m.initials, color: m.color, status: st.label, ready: st.ready, me: m.me, role: m.role };
  });
  const markers: SketchMarker[] = [];
  members.forEach((m) => {
    const f = fixOf(m.uid);
    if (f) markers.push({ lat: f.lat, lng: f.lng, kind: 'rider', color: m.color, label: m.initials });
  });
  const checks = readyChecks({ accuracyM: own?.accuracyM ?? null, locationGranted, contacts: contacts.length, voiceLive: voiceStatus === 'live' });
  const pill = countdownLabel(ride?.start_time_ms ?? null, now);
  const leadName = leadDisplayName(lead, byId, uid);
  const placeLine = meetup?.label ?? 'No meetup point set';

  const cta = !ride ? undefined : (
    <View style={s.ctaRow}>
      {meReady ? (
        <Button
          testID="cta-unready"
          variant="ok"
          label={`Ready · waiting for ${waiting}`}
          leading={<Icon name="check" size={22} color="#FFFFFF" />}
          accessibilityLabel={waiting > 0 ? `Ready. Waiting for ${waiting}. Tap to cancel` : 'Ready. Tap to cancel'}
          onPress={toggleReady}
          style={{ flex: 1 }}
        />
      ) : (
        <Button testID="cta-ready" label="I’m ready" accessibilityLabel="I'm ready" onPress={toggleReady} style={{ flex: 1 }} />
      )}
      {isLead ? (
        <Button
          testID="cta-rollout"
          label="Roll out"
          variant={allReady ? 'primary' : 'soft'}
          disabled={readyCount < 1}
          accessibilityLabel="Roll out now"
          onPress={rollOut}
          style={{ flex: meReady ? 0.7 : 0.8 }}
        />
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <Screen testID="screen-Meetup" cta={cta}>
        <TopBar onBack={goBack} style={{ marginBottom: 10 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={type.label} numberOfLines={2}>{`ROLL CALL · ${(ride?.name ?? '…').toUpperCase()}`}</Text>
            <Text style={[type.h1, { marginTop: 8 }]}>Meetup</Text>
          </View>
          {pill ? <Pill label={pill} tone="ink" style={{ height: 34, paddingHorizontal: 14 }} /> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <Icon name="pin" size={14} color={colors.ink2} />
          <Text style={[type.sm, { flex: 1 }]} numberOfLines={2}>
            {placeLine}
            {leadName ? ` · everyone ready = ${leadName.charAt(0) + leadName.slice(1).toLowerCase()} rolls out` : ''}
          </Text>
        </View>

        {!ride ? (
          <Text style={[type.body, { marginTop: 24 }]} accessibilityLiveRegion="polite">Loading the roll call…</Text>
        ) : (
          <>
            <View style={s.mapWrap}>
              <MapSketch testID="meetup-map" points={meetup ? [{ lat: meetup.lat, lng: meetup.lng }] : []} markers={markers} height={150} pad={30} />
              <View style={s.mapPill}>
                <Pill label={`${readyCount} of ${memberIds.length} ready`} tone="ink" />
              </View>
            </View>

            <TileGrid tiles={tiles} style={{ marginTop: 16 }} testID="roll-tiles" />

            <Text style={[type.label, { marginTop: 24, marginBottom: 12 }]}>YOUR READY CHECK</Text>
            <View style={s.chips} testID="ready-checks">
              {checks.map((c) => (
                <ReadyChip key={c.key} label={c.label} ok={c.ok} testID={`check-${c.key}`} />
              ))}
            </View>

            <View style={{ flexDirection: 'row', marginTop: 16 }}>
              <Button
                label="Navigate"
                variant="soft"
                size="sm"
                leading={<Icon name="nav" size={18} color={colors.ink} />}
                accessibilityLabel="Navigate to the meetup point"
                onPress={navigate}
                style={{ flex: 1 }}
              />
            </View>
          </>
        )}
      </Screen>
      <ToastContainer top={64} />
    </View>
  );
}
