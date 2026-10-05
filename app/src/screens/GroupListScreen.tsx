/**
 * Group List / Join / Create Ride screen.
 * Tap a ride -> setGroupId -> MainApp. Join by short code (or raw group id),
 * copy a ride's join code, leave a ride, sign out.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, FlatList, Text, StyleSheet, Alert, ActivityIndicator, Animated,
  LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import { firebaseAuth } from '../services/firebaseService';
import { useAppStore } from '../store/appStore';
import { resetRideSession } from '../store/rideSession';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import { GroupService, Group } from '@routing/group/groupService';
import CreateRideModal from '../components/CreateRideModal';
import RideCard from '../components/RideCard';
import {
  dayLabel, formatKm, greetingFor, planDistanceKm, planPoints, rideBadge, sectionRides, shortPlace,
  startLabel, timeOfDay,
} from '../utils/rides';
import {
  Button, FadeIn, Icon, PressableScale, SectionLabel, Skeleton, TextField, haptic, useReducedMotion,
} from '../ui';

type LoadStatus = 'loading' | 'ready' | 'error';
type Notice = { id: string; text: string } | null;

const COPIED_MS = 1800;
const TICK_MS = 60_000;
const COPIED_FADE_MS = 160;

// Android needs layout animations switched on once (no-op elsewhere / in jest).
if (Platform.OS === 'android' && typeof UIManager?.setLayoutAnimationEnabledExperimental === 'function') {
  try {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  } catch {
    // Optional nicety.
  }
}

/**
 * Smooth the NEXT layout change: cards below a removed/added ride slide into
 * place and a removed card fades out. Entering cards are animated by FadeIn.
 */
function animateLayout(): void {
  try {
    LayoutAnimation.configureNext({
      duration: 240,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
  } catch {
    // Layout animation is a nicety; never block a data update.
  }
}

/**
 * Copy chip label: the idle label cross-fades into "Copied" (which pops in from
 * a slightly smaller scale) and back. Opacity/transform only, native driver.
 * "Copied" stays mounted just long enough to fade out, then unmounts.
 */
function CopyLabel({ idle, copied, reduced }: { idle: string; copied: boolean; reduced: boolean }) {
  const styles = useStyles(({ colors: c, type: ty }) => ({
    copyLabel: { minWidth: 48, alignItems: 'center', justifyContent: 'center' },
    copiedWrap: { alignItems: 'center', justifyContent: 'center' },
    copyText: { ...ty.smStrong, color: c.ink },
  }));
  const t = useRef(new Animated.Value(copied ? 1 : 0)).current;
  const [showCopied, setShowCopied] = useState(copied);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (copied) setShowCopied(true);
    else timer = setTimeout(() => setShowCopied(false), COPIED_FADE_MS + 40);
    if (reduced) t.setValue(copied ? 1 : 0);
    else Animated.timing(t, { toValue: copied ? 1 : 0, duration: COPIED_FADE_MS, useNativeDriver: true }).start();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [copied, reduced, t]);

  return (
    <View style={styles.copyLabel}>
      <Animated.Text
        style={[styles.copyText, { opacity: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
      >
        {idle}
      </Animated.Text>
      {showCopied ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.copiedWrap,
            {
              opacity: t,
              transform: [{ scale: reduced ? 1 : t.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
            },
          ]}
        >
          <Text style={styles.copyText} numberOfLines={1}>Copied</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

function errorText(e: unknown, fallback: string): string {
  const m = (e as { message?: unknown } | null)?.message;
  return typeof m === 'string' && m.trim() ? m : fallback;
}

type Row =
  | { kind: 'label'; key: string; text: string }
  | { kind: 'ride'; key: string; group: Group; variant: 'hero' | 'standard' | 'compact' };

/** Flatten the sections (Up next / Your rides / Earlier) into list rows. */
function buildRows(groups: Group[], now: number): Row[] {
  const { upNext, rides, earlier } = sectionRides(groups, now);
  const rows: Row[] = [];
  if (upNext) {
    rows.push({ kind: 'label', key: 'l-next', text: 'Up next' });
    rows.push({ kind: 'ride', key: upNext.id, group: upNext, variant: 'hero' });
  }
  if (rides.length) {
    rows.push({ kind: 'label', key: 'l-rides', text: 'Your rides' });
    rides.forEach((g) => rows.push({ kind: 'ride', key: g.id, group: g, variant: 'standard' }));
  }
  if (earlier.length) {
    rows.push({ kind: 'label', key: 'l-earlier', text: 'Earlier' });
    earlier.forEach((g) => rows.push({ kind: 'ride', key: g.id, group: g, variant: 'compact' }));
  }
  return rows;
}

export default function GroupListScreen({ navigation }: any) {
  const { colors, type } = useTheme();
  const styles = useStyles(({ colors: c, type: t }) => ({
    safe: { flex: 1, backgroundColor: c.bg },
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, gap: 12 },
    headerText: { flex: 1, minWidth: 0 },
    settingsBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card, borderWidth: 1.5, borderColor: c.line },
    headerTitle: { ...t.h1, marginTop: 8 },
    bannerError: { ...t.sm, color: c.bad, paddingHorizontal: 20, paddingBottom: 8 },
    joinWrap: { paddingHorizontal: 20, paddingBottom: 16 },
    // flex-start: the field's error text grows it downward without moving the button.
    joinRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    joinField: { flex: 1 },
    joinButton: { minWidth: 88, height: 60 },
    noticeError: { ...t.sm, color: c.bad, marginTop: 8 },
    noticeOk: { ...t.sm, color: c.ok, marginTop: 8 },
    listContent: { paddingHorizontal: 20, paddingBottom: 110 },
    cardWrap: { marginBottom: 16 },
    // Non-pressable twin of the RideCard surface, for the skeleton placeholders.
    cardSurface: { backgroundColor: c.card, borderWidth: 1.5, borderColor: c.line, borderRadius: 26, overflow: 'hidden' },
    skelBody: { padding: 18 },
    skelStats: { marginTop: 16 },
    meta: { marginTop: 8 },
    skel: { backgroundColor: c.line2 },
    codeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    codeChip: { ...t.num, fontSize: 13, lineHeight: 16, letterSpacing: 1.5 },
    actionBtn: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
    // Line boxes match the real text line-heights (h2 24, sm 18) so heights agree.
    skelTitle: { height: 24, justifyContent: 'center' },
    skelLine: { height: 18, justifyContent: 'center' },
    statePanel: { paddingVertical: 48, alignItems: 'center' },
    stateText: { ...t.body, marginTop: 8, textAlign: 'center' },
    retryBtn: { marginTop: 24 },
    fab: {
      position: 'absolute', bottom: 32, right: 20, width: 58, height: 58, borderRadius: 18,
      backgroundColor: c.pri, justifyContent: 'center', alignItems: 'center', elevation: 4,
      borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.14)',
    },
  }));
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
  const setGroupName = useAppStore((s) => s.setGroupName);
  const setUserId = useAppStore((s) => s.setUserId);
  const groupService = useMemo(() => new GroupService(), []);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  // Used to animate only real list changes (a leave/join), not the first load.
  const listReady = useRef(false);
  const listCount = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  // Subscribe to my groups; `reloadKey` resubscribes after an error.
  useEffect(() => {
    listReady.current = false;
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
          if (listReady.current && fetched.length !== listCount.current && !reducedRef.current) animateLayout();
          listReady.current = true;
          listCount.current = fetched.length;
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
      haptic('success');
    } catch (e) {
      if (!mounted.current) return;
      haptic('error');
      setJoinError(errorText(e, 'Could not join this ride.'));
    } finally {
      if (mounted.current) setJoining(false);
    }
  };

  const openRide = (g: Group) => {
    // Each ride starts from a clean slate (route/plan/stops/riders).
    resetRideSession();
    setGroupId(g.id);
    setGroupName(g.name);
    navigation.navigate('MainApp', { groupId: g.id });
  };

  const copy = (key: string, value: string) => {
    setCardNotice(null);
    try {
      Clipboard.setString(value);
    } catch {
      haptic('error');
      setCardNotice({ id: key, text: 'Could not copy. Try again.' });
      return;
    }
    haptic('success');
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

  const selfInitial = firebaseAuth.currentUser?.email?.trim()?.[0]?.toUpperCase();

  const renderRow = ({ item: row, index }: { item: Row; index: number }) => {
    if (row.kind === 'label') {
      return (
        <FadeIn index={index < 8 ? index : 0}>
          <SectionLabel style={index === 0 ? { marginTop: 0 } : undefined}>{row.text}</SectionLabel>
        </FadeIn>
      );
    }
    const item = row.group;
    const code = item.join_code;
    const copyKey = item.id;
    const copied = copiedKey === copyKey;
    const leaving = leavingId === item.id;
    const notice = cardNotice && cardNotice.id === item.id ? cardNotice.text : null;
    const copyLabel = code ? `Copy join code for ${item.name}` : `Copy ride ID for ${item.name}`;

    const points = planPoints(item);
    const km = planDistanceKm(item);
    const members = item.member_ids?.length ?? 0;
    const stats = [
      // Straight-line along the planned waypoints, not road distance: marked with "~".
      ...(km != null ? [{ value: `~${formatKm(km)}`, label: 'km' }] : []),
      { value: String(members), label: members === 1 ? 'rider' : 'riders' },
      ...(item.ride_type ? [{ value: item.ride_type, label: 'type' }] : []),
      ...(item.start_time_ms ? [{ value: timeOfDay(new Date(item.start_time_ms)), label: 'start' }] : []),
    ];

    return (
      // Only the first screenful staggers; rows mounted later (scroll) appear at once.
      <FadeIn index={index < 8 ? index : 0} style={styles.cardWrap}>
        <RideCard
          variant={row.variant}
          badge={rideBadge(item, now)}
          dateLabel={startLabel(item.start_time_ms)}
          title={item.name}
          from={shortPlace(item.ride_plan?.start?.label)}
          to={shortPlace(item.ride_plan?.destination?.label)}
          stats={stats}
          mapPoints={points}
          memberCount={members}
          selfInitial={selfInitial}
          onPress={() => openRide(item)}
          accessibilityLabel={`Open ride ${item.name}`}
          // Children (Copy / Leave) are their own pressables; iOS groups them into this
          // element for VoiceOver, so expose them as custom actions too.
          accessibilityActions={[
            { name: 'copy', label: code ? 'Copy join code' : 'Copy ride ID' },
            { name: 'leave', label: 'Leave ride' },
          ]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'copy') copy(copyKey, code ?? item.id);
            else if (e.nativeEvent.actionName === 'leave' && !leaving) confirmLeave(item);
          }}
          headerRight={
            <View style={styles.codeRow}>
              {code ? <Text style={styles.codeChip} numberOfLines={1} accessibilityLabel={`Join code ${code}`}>{code}</Text> : null}
              <PressableScale
                style={styles.actionBtn}
                onPress={() => copy(copyKey, code ?? item.id)}
                haptic={false}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                accessibilityRole="button"
                accessibilityLabel={copyLabel}
              >
                <CopyLabel idle={code ? 'Copy' : 'Copy ID'} copied={copied} reduced={reduced} />
              </PressableScale>
            </View>
          }
          footerActions={
            <PressableScale
              style={styles.actionBtn}
              onPress={() => confirmLeave(item)}
              disabled={leaving}
              haptic="warning"
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={`Leave ${item.name}`}
              accessibilityState={{ disabled: leaving, busy: leaving }}
            >
              {leaving ? (
                <ActivityIndicator size="small" color={colors.bad} />
              ) : (
                <Text style={[type.smStrong, { color: colors.bad }]}>Leave</Text>
              )}
            </PressableScale>
          }
        />
        {notice ? (
          <FadeIn>
            <Text style={styles.noticeError} accessibilityLiveRegion="polite">{notice}</Text>
          </FadeIn>
        ) : null}
      </FadeIn>
    );
  };

  const renderEmpty = () => {
    if (status === 'loading') {
      // Same structure and height as a real card, so cards replace these in place.
      return (
        <View accessibilityLabel="Loading rides" accessibilityLiveRegion="polite">
          {[0, 1, 2].map((i) => (
            <FadeIn key={i} index={i} style={styles.cardWrap}>
              <View style={styles.cardSurface}>
                <Skeleton width="100%" height={124} radius={0} style={styles.skel} />
                <View style={styles.skelBody}>
                  <View style={styles.skelTitle}>
                    <Skeleton width="55%" height={16} style={styles.skel} />
                  </View>
                  <View style={[styles.skelLine, styles.meta]}>
                    <Skeleton width="38%" height={12} style={styles.skel} />
                  </View>
                  <View style={[styles.skelLine, styles.skelStats]}>
                    <Skeleton width="80%" height={12} style={styles.skel} />
                  </View>
                </View>
              </View>
            </FadeIn>
          ))}
        </View>
      );
    }
    if (status === 'error') {
      return (
        <FadeIn>
          <View style={styles.statePanel} accessibilityRole="alert">
            <Text style={type.h2}>Couldn't load your rides</Text>
            <Text style={styles.stateText}>
              {loadError ?? 'Check your connection and try again.'}
            </Text>
            <Button label="Try again" variant="soft" size="sm" onPress={retry} style={styles.retryBtn} />
          </View>
        </FadeIn>
      );
    }
    return (
      <FadeIn>
        <View style={styles.statePanel}>
          <Text style={type.h2}>No rides yet</Text>
          <Text style={styles.stateText}>
            Create one with the + button, or join with a code.
          </Text>
        </View>
      </FadeIn>
    );
  };

  const canJoin = joinCode.trim().length > 0 && !joining;
  const rows = useMemo(() => buildRows(groups, now), [groups, now]);
  const upcomingCount = groups.filter((g) => (g.start_time_ms ?? 0) > now).length;
  const headerEyebrow = [dayLabel(new Date(now)), upcomingCount > 0 ? `${upcomingCount} upcoming` : null]
    .filter(Boolean)
    .join(' · ')
    .toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={type.label} numberOfLines={1}>{headerEyebrow}</Text>
            <Text style={styles.headerTitle} accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {greetingFor(new Date(now))}, rider
            </Text>
          </View>
          <PressableScale
            onPress={() => navigation.navigate('Settings')}
            haptic="tap"
            accessibilityRole="button"
            accessibilityLabel="Settings"
            style={styles.settingsBtn}
          >
            <Icon name="gear" size={22} />
          </PressableScale>
          <Button
            label="Sign out"
            variant="ghost"
            size="sm"
            onPress={signOut}
            loading={signingOut}
            disabled={signingOut}
            haptic="tap"
          />
        </View>
        {signOutError ? (
          <FadeIn>
            <Text style={styles.bannerError} accessibilityLiveRegion="polite">{signOutError}</Text>
          </FadeIn>
        ) : null}

        <View style={styles.joinWrap}>
          <View style={styles.joinRow}>
            <TextField
              containerStyle={styles.joinField}
              placeholder="Join code"
              value={joinCode}
              onChangeText={onJoinChange}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={submitJoin}
              editable={!joining}
              error={joinError}
              accessibilityLabel="Join code input"
            />
            <Button
              label="Join"
              accessibilityLabel="Join group"
              variant="soft"
              onPress={submitJoin}
              loading={joining}
              disabled={!canJoin}
              style={styles.joinButton}
            />
          </View>
          {joined ? (
            <FadeIn>
              <Text style={styles.noticeOk} accessibilityLiveRegion="polite">
                {joinedName ? `Joined ${joinedName}` : 'Joined the ride'}
              </Text>
            </FadeIn>
          ) : null}
        </View>

        <FlatList
          data={status === 'ready' ? rows : []}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.listContent}
          renderItem={renderRow}
          ListEmptyComponent={renderEmpty}
          extraData={[copiedKey, leavingId, cardNotice, now]}
          keyboardShouldPersistTaps="handled"
        />

        <PressableScale
          style={styles.fab}
          haptic="select"
          onPress={() => {
            // Fresh draft: don't pre-fill the form with the previous ride's plan.
            resetRideSession();
            setCreateModalOpen(true);
          }}
          accessibilityLabel="Create new ride"
          accessibilityRole="button"
        >
          <Icon name="plus" size={26} color={colors.priInk} />
        </PressableScale>

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
