/**
 * Join (demo `join`): six boxes + the letter pad. "Join crew" resolves the code as a CREW code first and, when no
 * crew has it, as a RIDE code through the existing GroupService.joinGroup (old ride codes keep working).
 * Wrong or short code: the boxes shake with the demo's inline message. Success: the full-screen "YOU'RE IN" overlay
 * (2.4 s, tap to skip), then the rider is marked onboarded and lands on the Garage.
 * Reachable during onboarding (from CrewStart) and from the Crews tab; `route.params.code` prefills the boxes.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { GroupService } from '@routing/group/groupService';
import type { RootStackParamList } from '../../navigation/types';
import { CREW_CODE_ALPHABET, CREW_CODE_LENGTH, CrewError, findRideByCode, getCrewNextRide, joinCrewByCode } from '../../services/crewService';
import { usePrefsStore } from '../../store/prefsStore';
import { useSessionStore } from '../../store/sessionStore';
import { THEMES } from '../../theme/palettes';
import { useTheme } from '../../theme/ThemeProvider';
import { makeType } from '../../theme/typography';
import { Button, CodeBoxes, LetterKeypad, Screen, TopBar, haptic, useReducedMotion } from '../../ui';
import { formatWhen } from '../../utils/crewRides';
import { ridersLabel } from './CrewsScreen';
import CrewAvatars from './crew/CrewAvatars';

type Props = StackScreenProps<RootStackParamList, 'Join'>;

export const OVERLAY_MS = 2400;

interface Joined {
  title: string;
  uids: string[];
  count: number;
  /** "next ride tomorrow 6:30 AM" style detail, null when there is none. */
  next: { when: string | null; name: string } | null;
  kind: 'crew' | 'ride';
}

export function sanitizeCode(input: unknown): string {
  return String(input ?? '')
    .toUpperCase()
    .split('')
    .filter((ch) => CREW_CODE_ALPHABET.includes(ch))
    .join('')
    .slice(0, CREW_CODE_LENGTH);
}

let groupService: GroupService | null = null;
const rides = () => (groupService ??= new GroupService());

function YouAreIn({ joined, onDone }: { joined: Joined; onDone: () => void }) {
  const { themeId } = useTheme();
  const night = THEMES[themeId].dark.road;
  const t = makeType(night);
  const uid = useSessionStore((s) => s.uid);
  const fade = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) fade.setValue(1);
    else Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [fade, reduced]);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade, zIndex: 200 }]} testID="join-success">
      <Pressable
        onPress={onDone}
        accessibilityRole="button"
        accessibilityLabel={`You're in ${joined.title}. Continue`}
        style={{ flex: 1, backgroundColor: night.bg, alignItems: 'center', justifyContent: 'center', gap: 22, padding: 30 }}
      >
        <Text style={[t.label, { color: night.pri, letterSpacing: 11 * 0.25 }]} accessibilityLiveRegion="polite">{"YOU'RE IN"}</Text>
        <Text style={[t.display, { textAlign: 'center' }]} numberOfLines={3}>{joined.title}</Text>
        <CrewAvatars uids={joined.uids} meUid={uid} size={56} overlap={-12} ring={false} max={5} />
        <Text style={[t.body, { textAlign: 'center' }]}>
          {ridersLabel(joined.count)}
          {joined.next ? (
            <>
              {joined.kind === 'ride' ? ' · starts ' : ' · next ride '}
              {joined.next.when ? <Text style={{ color: night.ink, fontFamily: t.bodyStrong.fontFamily }}>{joined.next.when}</Text> : null}
              {joined.next.when ? `\n${joined.next.name}` : joined.next.name}
            </>
          ) : joined.kind === 'crew' ? (
            ' · no ride planned yet'
          ) : null}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default function JoinScreen({ navigation, route }: Props) {
  const { colors, type } = useTheme();
  const reduced = useReducedMotion();
  const [code, setCode] = useState(() => sanitizeCode(route.params?.code));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState<Joined | null>(null);
  const shake = useRef(new Animated.Value(0)).current;
  const alive = useRef(true);
  const left = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const doShake = useCallback(() => {
    if (reduced) return;
    const d = 8;
    const step = (to: number) => Animated.timing(shake, { toValue: to, duration: 90, useNativeDriver: true });
    Animated.sequence([step(-d), step(d), step(-d), step(d), step(0)]).start();
  }, [reduced, shake]);

  const proceed = useCallback(() => {
    if (left.current) return;
    left.current = true;
    if (timer.current) clearTimeout(timer.current);
    // Local state flips immediately; the Firestore write follows (and may wait for the network).
    Promise.resolve(usePrefsStore.getState().setOnboarded(true)).catch(() => undefined);
    navigation.reset({ index: 0, routes: [{ name: 'GarageTabs' }] });
  }, [navigation]);

  const succeed = (j: Joined) => {
    haptic('success');
    setJoined(j);
    timer.current = setTimeout(proceed, OVERLAY_MS);
  };

  const fail = (text: string, shaky = true) => {
    haptic('error');
    setMessage(text);
    if (shaky) doShake();
  };

  const key = (k: string) => {
    if (busy || code.length >= CREW_CODE_LENGTH) return;
    setCode((c) => c + k);
    setMessage(null);
  };
  const back = () => {
    if (busy) return;
    setCode((c) => c.slice(0, -1));
    setMessage(null);
  };

  const join = async () => {
    if (busy) return;
    if (code.length < CREW_CODE_LENGTH) {
      fail('Codes have six characters.');
      return;
    }
    setBusy(true);
    setMessage(null);
    const notFound = `No crew uses ${code}. Check with whoever sent it.`;
    try {
      let crew = null;
      try {
        crew = await joinCrewByCode(code);
      } catch (e) {
        if (!(e instanceof CrewError) || (e.kind !== 'not-found' && e.kind !== 'bad-code')) throw e;
      }
      if (crew) {
        const nextRide = await getCrewNextRide(crew.id);
        if (!alive.current) return;
        succeed({
          kind: 'crew',
          title: crew.name,
          uids: crew.member_ids,
          count: crew.member_ids.length,
          next: nextRide ? { when: formatWhen(nextRide.start_time_ms), name: nextRide.name } : null,
        });
        return;
      }
      // Not a crew code: an older ride code still works.
      const ride = await findRideByCode(code);
      if (!ride) {
        if (alive.current) fail(notFound);
        return;
      }
      await rides().joinGroup(code);
      if (!alive.current) return;
      const uid = useSessionStore.getState().uid;
      const members = uid && !ride.member_ids.includes(uid) ? [...ride.member_ids, uid] : ride.member_ids;
      succeed({
        kind: 'ride',
        title: ride.name,
        uids: members,
        count: members.length,
        next: { when: ride.start_time_ms != null ? formatWhen(ride.start_time_ms) : null, name: ride.name },
      });
    } catch (e) {
      if (!alive.current) return;
      if (e instanceof CrewError && e.kind === 'network') fail("You're offline. Connect and try again.", false);
      else fail("Couldn't join. Try again in a moment.", false);
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen
        testID="screen-Join"
        cta={
          <View style={{ gap: 7, marginHorizontal: -12 }}>
            <LetterKeypad onKey={key} onBackspace={back} />
            <Button
              label="Join crew"
              loading={busy}
              onPress={join}
              style={{ height: 52, borderRadius: 14, marginTop: 2, marginHorizontal: 12 }}
              accessibilityLabel="Join crew"
              testID="join-go"
            />
          </View>
        }
      >
        <TopBar onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.reset({ index: 0, routes: [{ name: 'CrewStart' }] }))} />
        <Text style={type.label}>JOIN A CREW</Text>
        <Text style={[type.h1, { marginTop: 12 }]} accessibilityRole="header">{'Enter the\ncrew code.'}</Text>
        <Animated.View style={{ marginTop: 32, transform: [{ translateX: shake }] }}>
          <CodeBoxes value={code} height={68} fontSize={30} testID="join-boxes" />
        </Animated.View>
        <View style={{ minHeight: 20, marginTop: 16 }}>
          {message ? (
            <Text style={[type.sm, { color: colors.bad }]} accessibilityLiveRegion="assertive" accessibilityRole="alert" testID="join-message">{message}</Text>
          ) : null}
        </View>
        <Text style={[type.sm, { marginTop: 24 }]}>
          Codes are six letters or digits. No 0, O, 1, I or L, so they're easy to read out over a helmet comm.
        </Text>
      </Screen>
      {joined ? <YouAreIn joined={joined} onDone={proceed} /> : null}
    </View>
  );
}
