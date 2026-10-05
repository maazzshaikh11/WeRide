/**
 * Group List / Join / Create Ride screen.
 * Tap a ride -> setGroupId -> MainApp. Join by short code (or raw group id),
 * copy a ride's join code, leave a ride, sign out.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, TextInput, FlatList, Text, StyleSheet, Pressable, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import { firebaseAuth } from '../services/firebaseService';
import { useAppStore } from '../store/appStore';
import { resetRideSession } from '../store/rideSession';
import { WeRideColors, WeRideFonts, WeRideRadius, WeRideSpacing } from '../theme/theme';
import { type } from '../theme/typography';
import { GroupService, Group } from '@routing/group/groupService';
import CreateRideModal from '../components/CreateRideModal';
import { describeStart } from '../utils/startTime';

type LoadStatus = 'loading' | 'ready' | 'error';
type Notice = { id: string; text: string } | null;

const COPIED_MS = 1800;
const TICK_MS = 60_000;

function errorText(e: unknown, fallback: string): string {
  const m = (e as { message?: unknown } | null)?.message;
  return typeof m === 'string' && m.trim() ? m : fallback;
}

function riderCount(g: Group): string {
  const n = g.member_ids?.length ?? 0;
  return `${n} ${n === 1 ? 'rider' : 'riders'}`;
}

export default function GroupListScreen({ navigation }: any) {
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  // `input` is what was submitted; the name is resolved from the live list.
  const [joined, setJoined] = useState<{ input: string } | null>(null);

  const [groups, setGroups] = useState<Group[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [cardNotice, setCardNotice] = useState<Notice>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const uid = firebaseAuth.currentUser?.uid;
  const setGroupId = useAppStore((s) => s.setGroupId);
  const setUserId = useAppStore((s) => s.setUserId);
  const groupService = useMemo(() => new GroupService(), []);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  // Subscribe to my groups; `reloadKey` resubscribes after an error.
  useEffect(() => {
    if (!uid) {
      setGroups([]);
      setStatus('ready');
      return;
    }
    setStatus('loading');
    setLoadError(null);
    try {
      return groupService.myGroups(
        (fetched) => {
          setGroups(fetched);
          setStatus('ready');
        },
        (e) => {
          setLoadError(errorText(e, 'Could not load your rides.'));
          setStatus('error');
        }
      );
    } catch (e) {
      setLoadError(errorText(e, 'Could not load your rides.'));
      setStatus('error');
      return;
    }
  }, [uid, groupService, reloadKey]);

  // Keep "Starts in N min" fresh while any ride has a start time.
  const hasStartTimes = groups.some((g) => g.start_time_ms);
  useEffect(() => {
    if (!hasStartTimes) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, [hasStartTimes]);

  const joinedName = useMemo(() => {
    if (!joined) return null;
    const needle = joined.input.toUpperCase();
    const hit = groups.find((g) => g.id === joined.input || g.join_code?.toUpperCase() === needle);
    return hit?.name ?? null;
  }, [joined, groups]);

  const onJoinChange = (v: string) => {
    // Short codes are shown uppercase. Longer input is a raw group id: case matters, leave it.
    setJoinCode(v.replace(/\s/g, '').length <= 6 ? v.toUpperCase() : v);
    setJoinError(null);
    setJoined(null);
  };

  const submitJoin = async () => {
    const input = joinCode.trim();
    if (!input || joining) return;
    setJoining(true);
    setJoinError(null);
    setJoined(null);
    try {
      await groupService.joinGroup(input);
      if (!mounted.current) return;
      setJoinCode('');
      setJoined({ input });
    } catch (e) {
      if (!mounted.current) return;
      setJoinError(errorText(e, 'Could not join this ride.'));
    } finally {
      if (mounted.current) setJoining(false);
    }
  };

  const openRide = (g: Group) => {
    // Each ride starts from a clean slate (route/plan/stops/riders).
    resetRideSession();
    setGroupId(g.id);
    navigation.navigate('MainApp', { groupId: g.id });
  };

  const copy = (key: string, value: string) => {
    setCardNotice(null);
    try {
      Clipboard.setString(value);
    } catch {
      setCardNotice({ id: key, text: 'Could not copy. Try again.' });
      return;
    }
    setCopiedKey(key);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedKey(null), COPIED_MS);
  };

  const leave = async (g: Group) => {
    setLeavingId(g.id);
    setCardNotice(null);
    try {
      await groupService.leaveGroup(g.id);
    } catch (e) {
      if (mounted.current) setCardNotice({ id: g.id, text: errorText(e, 'Could not leave this ride.') });
    } finally {
      if (mounted.current) setLeavingId(null);
    }
  };

  const confirmLeave = (g: Group) => {
    Alert.alert(
      `Leave "${g.name}"?`,
      'It will be removed from your rides. You can rejoin with its join code.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => { leave(g); } },
      ]
    );
  };

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(null);
    try {
      await firebaseAuth.signOut();
      setUserId(null);
      setGroupId(null);
      resetRideSession();
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (e) {
      if (mounted.current) {
        setSignOutError(errorText(e, 'Could not sign out. Try again.'));
        setSigningOut(false);
      }
    }
  };

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  const renderGroup = ({ item }: { item: Group }) => {
    const start = describeStart(item.start_time_ms, now);
    const meta = [riderCount(item), item.ride_type].filter(Boolean).join(' · ');
    const code = item.join_code;
    const copyKey = item.id;
    const copied = copiedKey === copyKey;
    const leaving = leavingId === item.id;
    const notice = cardNotice && cardNotice.id === item.id ? cardNotice.text : null;
    return (
      <View style={styles.card}>
        <Pressable
          onPress={() => openRide(item)}
          style={({ pressed }) => [styles.cardBody, pressed && styles.pressed]}
          accessibilityLabel={`Open ride ${item.name}`}
          accessibilityRole="button"
        >
          <Text style={type.heading} numberOfLines={2}>{item.name}</Text>
          <Text style={[type.caption, styles.meta]}>{meta}</Text>
          {start ? <Text style={[type.captionStrong, styles.start]}>{start}</Text> : null}
        </Pressable>

        <View style={styles.cardActions}>
          {code ? <Text style={styles.codeChip} selectable accessibilityLabel={`Join code ${code}`}>{code}</Text> : null}
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            onPress={() => copy(copyKey, code ?? item.id)}
            accessibilityRole="button"
            accessibilityLabel={code ? `Copy join code for ${item.name}` : `Copy ride ID for ${item.name}`}
          >
            <Text style={[type.captionStrong, { color: WeRideColors.primary }]}>
              {copied ? 'Copied' : code ? 'Copy' : 'Copy ID'}
            </Text>
          </Pressable>
          <View style={styles.spacer} />
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed, leaving && styles.disabled]}
            onPress={() => confirmLeave(item)}
            disabled={leaving}
            accessibilityRole="button"
            accessibilityLabel={`Leave ${item.name}`}
            accessibilityState={{ disabled: leaving, busy: leaving }}
          >
            {leaving ? (
              <ActivityIndicator size="small" color={WeRideColors.error} />
            ) : (
              <Text style={[type.captionStrong, { color: WeRideColors.error }]}>Leave</Text>
            )}
          </Pressable>
        </View>
        {notice ? (
          <Text style={[type.caption, styles.noticeError]} accessibilityLiveRegion="polite">{notice}</Text>
        ) : null}
      </View>
    );
  };

  const renderEmpty = () => {
    if (status === 'loading') {
      return (
        <View accessibilityLabel="Loading rides" accessibilityLiveRegion="polite">
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.card, styles.skeletonCard]}>
              <View style={[styles.skeletonLine, { width: '55%' }]} />
              <View style={[styles.skeletonLine, { width: '30%', marginTop: WeRideSpacing.sm }]} />
            </View>
          ))}
        </View>
      );
    }
    if (status === 'error') {
      return (
        <View style={styles.statePanel} accessibilityRole="alert">
          <Text style={type.heading}>Couldn't load your rides</Text>
          <Text style={[type.body, styles.stateText]}>
            {loadError ?? 'Check your connection and try again.'}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
            onPress={retry}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={[type.buttonSm, { color: WeRideColors.primary }]}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.statePanel}>
        <Text style={type.heading}>No rides yet</Text>
        <Text style={[type.body, styles.stateText]}>
          Create one with the + button, or join with a code.
        </Text>
      </View>
    );
  };

  const canJoin = joinCode.trim().length > 0 && !joining;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={type.title} accessibilityRole="header">My rides</Text>
          <Pressable
            style={({ pressed }) => [styles.signOutBtn, pressed && styles.pressed, signingOut && styles.disabled]}
            onPress={signOut}
            disabled={signingOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            accessibilityState={{ disabled: signingOut, busy: signingOut }}
          >
            {signingOut ? (
              <ActivityIndicator size="small" color={WeRideColors.textSub} />
            ) : (
              <Text style={[type.bodyStrong, { color: WeRideColors.textSub }]}>Sign out</Text>
            )}
          </Pressable>
        </View>
        {signOutError ? (
          <Text style={[type.caption, styles.bannerError]} accessibilityLiveRegion="polite">{signOutError}</Text>
        ) : null}

        <View style={styles.joinWrap}>
          <View style={styles.joinRow}>
            <TextInput
              style={styles.input}
              placeholder="Join code"
              placeholderTextColor={WeRideColors.textSub}
              value={joinCode}
              onChangeText={onJoinChange}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={submitJoin}
              editable={!joining}
              accessibilityLabel="Join code input"
            />
            <Pressable
              style={({ pressed }) => [styles.joinButton, pressed && styles.joinButtonPressed, !canJoin && styles.disabled]}
              onPress={submitJoin}
              disabled={!canJoin}
              accessibilityLabel="Join group"
              accessibilityRole="button"
              accessibilityState={{ disabled: !canJoin, busy: joining }}
            >
              {joining ? (
                <ActivityIndicator size="small" color={WeRideColors.primary} />
              ) : (
                <Text style={[type.bodyStrong, { color: WeRideColors.primary }]}>Join</Text>
              )}
            </Pressable>
          </View>
          {joinError ? (
            <Text style={[type.caption, styles.noticeError]} accessibilityLiveRegion="polite">{joinError}</Text>
          ) : null}
          {joined ? (
            <Text style={[type.caption, styles.noticeOk]} accessibilityLiveRegion="polite">
              {joinedName ? `Joined ${joinedName}` : 'Joined the ride'}
            </Text>
          ) : null}
        </View>

        <FlatList
          data={status === 'ready' ? groups : []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={renderGroup}
          ListEmptyComponent={renderEmpty}
          extraData={[copiedKey, leavingId, cardNotice, now]}
          keyboardShouldPersistTaps="handled"
        />

        <Pressable
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          onPress={() => {
            // Fresh draft: don't pre-fill the form with the previous ride's plan.
            resetRideSession();
            setCreateModalOpen(true);
          }}
          accessibilityLabel="Create new ride"
          accessibilityRole="button"
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>

        <CreateRideModal
          visible={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onCreated={(groupId) => {
            setCreateModalOpen(false);
            navigation.navigate('MainApp', { groupId });
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WeRideColors.dark },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: WeRideSpacing.lg,
    paddingTop: WeRideSpacing.md,
    paddingBottom: WeRideSpacing.sm,
  },
  signOutBtn: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: WeRideSpacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerError: { color: WeRideColors.error, paddingHorizontal: WeRideSpacing.lg, paddingBottom: WeRideSpacing.sm },
  joinWrap: { paddingHorizontal: WeRideSpacing.lg, paddingBottom: WeRideSpacing.lg },
  joinRow: { flexDirection: 'row', alignItems: 'center', gap: WeRideSpacing.sm },
  input: {
    ...type.input,
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: WeRideRadius.md,
    paddingHorizontal: WeRideSpacing.md,
    backgroundColor: WeRideColors.dark3,
  },
  joinButton: {
    minHeight: 48,
    minWidth: 72,
    paddingHorizontal: WeRideSpacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: WeRideRadius.md,
  },
  joinButtonPressed: { backgroundColor: WeRideColors.primaryDim },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
  noticeError: { color: WeRideColors.error, marginTop: WeRideSpacing.sm },
  noticeOk: { color: WeRideColors.green, marginTop: WeRideSpacing.sm },
  listContent: { paddingHorizontal: WeRideSpacing.lg, paddingBottom: 96 },
  card: {
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: WeRideRadius.xxl,
    padding: WeRideSpacing.lg,
    marginBottom: WeRideSpacing.md,
  },
  cardBody: { minHeight: 44 },
  meta: { marginTop: WeRideSpacing.xs },
  start: { marginTop: WeRideSpacing.xs, color: WeRideColors.text },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: WeRideSpacing.sm,
    marginTop: WeRideSpacing.md,
  },
  codeChip: {
    fontFamily: WeRideFonts.monoBold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 2,
    color: WeRideColors.text,
    backgroundColor: WeRideColors.dark2,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: WeRideRadius.md,
    paddingHorizontal: WeRideSpacing.md,
    paddingVertical: WeRideSpacing.sm,
    overflow: 'hidden',
  },
  actionBtn: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: WeRideSpacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: { flex: 1 },
  skeletonCard: { height: 84 },
  skeletonLine: { height: 14, borderRadius: WeRideRadius.sm, backgroundColor: WeRideColors.border },
  statePanel: { paddingVertical: WeRideSpacing.xxxl, alignItems: 'center' },
  stateText: { color: WeRideColors.textSub, marginTop: WeRideSpacing.xs, textAlign: 'center' },
  retryBtn: {
    minHeight: 44,
    paddingHorizontal: WeRideSpacing.xl,
    marginTop: WeRideSpacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: WeRideColors.primary,
    borderRadius: WeRideRadius.md,
  },
  fab: {
    position: 'absolute',
    bottom: WeRideSpacing.xxl,
    right: WeRideSpacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: WeRideColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  fabPressed: { opacity: 0.85, transform: [{ scale: 0.92 }] },
  fabText: { ...type.title, color: WeRideColors.onPrimary, fontFamily: WeRideFonts.body, fontSize: 28 },
});
