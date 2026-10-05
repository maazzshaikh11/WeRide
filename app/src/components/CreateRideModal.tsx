/**
 * CreateRideModal — pop-up shown when the user taps "+" (Create Ride).
 * Collects: start location, destination, intermediate stops, and an optional
 * ride type and start time. Each location field autocompletes via Mapbox.
 * On Create: saves plan to ridePlanStore, creates the Firestore group.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Modal, Pressable, TextInput, Animated,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, LayoutAnimation, UIManager,
} from 'react-native';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import { geocodeSearchStrict, GeoResult } from '../utils/geocode';
import { START_PRESETS, StartPreset, startTimeFromPreset } from '../utils/startTime';
import { useRidePlanStore, PlannedStop } from '../store/ridePlanStore';
import { useToastStore } from '../store/toastStore';
import { GroupService, RIDE_TYPES, RideType, RideMeta } from '@routing/group/groupService';
import { useAppStore } from '../store/appStore';
import {
  Button, Chip, FadeIn, Icon, PressableCard, PressableScale, TextField, haptic, useReducedMotion,
} from '../ui';

type Field = 'start' | 'destination' | 'stop';
type SearchState = { status: 'idle' | 'loading' | 'done' | 'error'; query: string };

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called with the newly created group id. */
  onCreated: (groupId: string) => void;
}

const STOP_ICONS = ['⛽', '☕', '🍽️', '🚻', '🅿️', '📸'];

function stopIcon(): string {
  return STOP_ICONS[Math.floor(Math.random() * STOP_ICONS.length)];
}

const FIELD_PLACEHOLDER: Record<Field, string> = {
  start: 'Search start location',
  destination: 'Search destination',
  stop: 'Search a stop',
};

const FADE_MS = 160;

// Android needs layout animations switched on once (no-op elsewhere / in jest).
if (Platform.OS === 'android' && typeof UIManager?.setLayoutAnimationEnabledExperimental === 'function') {
  try {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  } catch {
    // Optional nicety.
  }
}

/** Smooth the NEXT layout change (stop removed/reordered/added, content sliding). */
function animateLayout(): void {
  try {
    LayoutAnimation.configureNext({
      duration: 220,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
  } catch {
    // Layout animation is a nicety; never block a state change.
  }
}

/**
 * Mounts its children with a fade-in and, when `visible` flips false, fades
 * them out before unmounting (then lets the content below slide up).
 */
function PresenceFade({
  visible, reduced, children,
}: { visible: boolean; reduced: boolean; children: React.ReactNode }) {
  const t = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [mounted, setMounted] = useState(visible);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (visible) setMounted(true);
    else if (mounted) {
      timer = setTimeout(() => {
        if (!reduced) animateLayout();
        setMounted(false);
      }, reduced ? 0 : FADE_MS);
    }
    if (reduced) t.setValue(visible ? 1 : 0);
    else Animated.timing(t, { toValue: visible ? 1 : 0, duration: FADE_MS, useNativeDriver: true }).start();
    return () => {
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `mounted` only gates the unmount timer
  }, [visible, reduced, t]);
  if (!mounted) return null;
  return <Animated.View style={{ opacity: t }}>{children}</Animated.View>;
}

export default function CreateRideModal({ visible, onClose, onCreated }: Props) {
  const { colors, type } = useTheme();
  const styles = useStyles(({ colors: c, type: t }) => ({
    overlay: { flex: 1, backgroundColor: c.scrim, justifyContent: 'flex-end' },
    overlayPress: { flex: 1 },
    // Demo `.sheet`: radius 30 top, 12/20/38 padding, grab handle 44x5.
    box: {
      backgroundColor: c.bg,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      maxHeight: '90%',
      paddingTop: 12,
      paddingHorizontal: 20,
      paddingBottom: 38,
    },
    grab: { width: 44, height: 5, borderRadius: 3, backgroundColor: c.line2, alignSelf: 'center', marginBottom: 18 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8 },
    headerTitle: { ...t.h2, marginTop: 8 },
    closeBtn: {
      width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.card, borderWidth: 1.5, borderColor: c.line,
    },
    scroll: { flexGrow: 0, flexShrink: 1 },
    scrollContent: { paddingBottom: 8 },
    locRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 10, paddingHorizontal: 18, marginTop: 10 },
    dot: {
      width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: c.ink,
      alignItems: 'center', justifyContent: 'center',
    },
    dotFilled: { borderColor: c.ink, backgroundColor: c.pri },
    dotPlus: { borderWidth: 0 },
    locTextWrap: { flex: 1 },
    locLabel: { ...t.fieldLabel },
    locValue: { ...t.listTitle, marginTop: 4 },
    locHint: { ...t.listSub, marginTop: 4 },
    searchField: { marginTop: 14 },
    searching: { marginTop: 8, alignSelf: 'center' },
    searchMsgRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
    searchMsg: { ...t.sm, flex: 1, color: c.bad },
    searchMsgSolo: { ...t.sm, marginTop: 8 },
    retryBtn: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
    retryText: { ...t.smStrong, textDecorationLine: 'underline', textDecorationColor: c.pri },
    results: { marginTop: 8 },
    resultWrap: { marginBottom: 8 },
    resultRow: { minHeight: 52, justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 16 },
    section: { marginTop: 24 },
    sectionLabel: { ...t.fieldLabel, marginLeft: 2, marginBottom: 8 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    stopRow: {
      flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 52,
      backgroundColor: c.card, borderWidth: 1.5, borderColor: c.line,
      borderRadius: 18, paddingLeft: 16, marginBottom: 8,
    },
    stopIconText: { fontSize: 16, lineHeight: 20 },
    stopLabel: { ...t.listTitle, flex: 1, marginLeft: 8 },
    stopBtnWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    reason: { ...t.sm, marginTop: 16, textAlign: 'center' },
    createBtn: { marginTop: 16 },
  }));
  const { start, destination, stops, setStart, setDestination, addStop, removeStop, moveStop } =
    useRidePlanStore();
  const setGroupId = useAppStore((s) => s.setGroupId);
  const push = useToastStore((s) => s.push);
  const reduced = useReducedMotion();

  const [field, setField] = useState<Field>('start');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [search, setSearch] = useState<SearchState>({ status: 'idle', query: '' });
  const [retryNonce, setRetryNonce] = useState(0);
  const [creating, setCreating] = useState(false);
  const [rideType, setRideType] = useState<RideType | null>(null);
  const [startPreset, setStartPreset] = useState<StartPreset | null>(null);
  const searchRef = useRef<TextInput>(null);
  const serviceRef = useRef<GroupService | null>(null);

  // Every time the modal opens, start from an empty selection.
  useEffect(() => {
    if (!visible) return;
    setRideType(null);
    setStartPreset(null);
    setQuery('');
    setResults([]);
    setSearch({ status: 'idle', query: '' });
  }, [visible]);

  // Debounced geocoding autocomplete
  useEffect(() => {
    if (!visible) return;
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setSearch({ status: 'idle', query: q });
      return;
    }
    setSearch({ status: 'loading', query: q });
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const r = await geocodeSearchStrict(q);
        if (cancelled) return;
        setResults(r);
        setSearch({ status: 'done', query: q });
      } catch {
        if (cancelled) return;
        setResults([]);
        setSearch({ status: 'error', query: q });
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, visible, retryNonce]);

  const pick = useCallback((r: GeoResult) => {
    if (!reduced) animateLayout(); // results collapse / a stop row is added
    if (field === 'start') setStart(r);
    else if (field === 'destination') setDestination(r);
    else {
      addStop({ id: `${Date.now()}-${Math.random()}`, label: r.label, lat: r.lat, lng: r.lng, icon: stopIcon() });
    }
    setQuery('');
    setResults([]);
  }, [field, reduced, setStart, setDestination, addStop]);

  const canCreate = destination != null && !creating;

  const create = useCallback(async () => {
    if (!canCreate) return;
    setCreating(true);
    try {
      if (!serviceRef.current) serviceRef.current = new GroupService();
      const groupService = serviceRef.current;
      const meta: RideMeta = {};
      if (rideType) meta.ride_type = rideType;
      if (startPreset) meta.start_time_ms = startTimeFromPreset(startPreset, Date.now());
      const groupId = await groupService.createGroup(
        destination ? `Ride to ${destination.label.split(',')[0]}` : undefined,
        {
          start: start ? { label: start.label, lat: start.lat, lng: start.lng } : null,
          destination: destination ? { label: destination.label, lat: destination.lat, lng: destination.lng } : null,
          stops: stops.map((s) => ({ id: s.id, label: s.label, lat: s.lat, lng: s.lng, icon: s.icon })),
        },
        meta
      );
      setGroupId(groupId);
      let message = 'Ride created — share the join code with your group';
      try {
        const group = await groupService.getGroup(groupId);
        if (group?.join_code) message = `Ride created — join code ${group.join_code}`;
      } catch {
        // Keep the generic message; the code is still visible on the ride list.
      }
      push(message, 'success');
      haptic('success');
      onCreated(groupId);
      onClose();
    } catch {
      haptic('error');
      push('Could not create the ride. Try again.', 'error');
    } finally {
      setCreating(false);
    }
  }, [canCreate, start, destination, stops, rideType, startPreset, setGroupId, push, onCreated, onClose]);

  const renderLocationRow = (label: string, hint: string, value: GeoResult | null, f: Field) => (
    <PressableCard
      radius={18}
      active={field === f}
      style={styles.locRow}
      haptic="select"
      onPress={() => { setField(f); setQuery(''); setResults([]); searchRef.current?.focus(); }}
      accessibilityRole="button"
      accessibilityLabel={`${label} field`}
      accessibilityState={{ selected: field === f }}
    >
      <View style={[styles.dot, f === 'destination' && styles.dotFilled, f === 'stop' && styles.dotPlus]}>
        {f === 'stop' ? <Icon name="plus" size={16} color={colors.ink2} /> : null}
      </View>
      <View style={styles.locTextWrap}>
        <Text style={styles.locLabel}>{label.toUpperCase()}</Text>
        {value ? (
          <Text style={styles.locValue} numberOfLines={1}>{value.label}</Text>
        ) : (
          <Text style={styles.locHint}>{hint}</Text>
        )}
      </View>
    </PressableCard>
  );

  const searching = search.status === 'loading';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <Pressable style={styles.overlayPress} onPress={onClose} accessibilityLabel="Close create ride" />
        <View style={styles.box}>
          <View style={styles.grab} />
          <View style={styles.headerRow}>
            <View>
              <Text style={type.label}>NEW RIDE</Text>
              <Text style={styles.headerTitle} accessibilityRole="header">Plan your route</Text>
            </View>
            <PressableScale
              onPress={onClose}
              style={styles.closeBtn}
              haptic="tap"
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Icon name="close" size={20} color={colors.ink} />
            </PressableScale>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {renderLocationRow('Starting from', 'Optional. Tap, then search', start, 'start')}
            {renderLocationRow('Destination', 'Required. Tap, then search', destination, 'destination')}
            {renderLocationRow('Add a stop', 'Optional. Tap, then search', null, 'stop')}

            <TextField
              ref={searchRef}
              containerStyle={styles.searchField}
              placeholder={FIELD_PLACEHOLDER[field]}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Location search input"
            />
            {searching ? <ActivityIndicator color={colors.ink2} style={styles.searching} /> : null}

            {search.status === 'error' ? (
              <FadeIn>
                <View style={styles.searchMsgRow} accessibilityLiveRegion="polite">
                  <Text style={styles.searchMsg}>
                    Search is unavailable — check your connection
                  </Text>
                  <PressableScale
                    style={styles.retryBtn}
                    onPress={() => setRetryNonce((n) => n + 1)}
                    haptic="tap"
                    accessibilityRole="button"
                    accessibilityLabel="Retry search"
                  >
                    <Text style={styles.retryText}>Retry</Text>
                  </PressableScale>
                </View>
              </FadeIn>
            ) : null}
            {search.status === 'done' && results.length === 0 ? (
              <FadeIn>
                <Text style={styles.searchMsgSolo} accessibilityLiveRegion="polite">
                  {`No places found for "${search.query}"`}
                </Text>
              </FadeIn>
            ) : null}

            {results.length > 0 && (
              <View style={styles.results}>
                {results.map((item, i) => (
                  <FadeIn key={`${item.lat},${item.lng},${i}`} index={i} style={styles.resultWrap}>
                    <PressableCard
                      radius={18}
                      style={styles.resultRow}
                      haptic="select"
                      onPress={() => pick(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${item.label}`}
                    >
                      <Text style={type.listTitle} numberOfLines={2}>{item.label}</Text>
                    </PressableCard>
                  </FadeIn>
                ))}
              </View>
            )}

            {stops.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>STOPS</Text>
                {stops.map((s: PlannedStop, i) => (
                  <FadeIn key={s.id}>
                    <View style={styles.stopRow}>
                      <Text style={styles.stopIconText}>{s.icon}</Text>
                      <Text style={styles.stopLabel} numberOfLines={1}>{s.label}</Text>
                      <PressableScale
                        style={styles.stopBtnWrap}
                        onPress={() => { if (!reduced) animateLayout(); moveStop(s.id, -1); }}
                        disabled={i === 0}
                        haptic="select"
                        accessibilityRole="button"
                        accessibilityLabel="Move stop up"
                      >
                        <Icon name="up" size={20} color={i === 0 ? colors.ink3 : colors.ink} />
                      </PressableScale>
                      <PressableScale
                        style={styles.stopBtnWrap}
                        onPress={() => { if (!reduced) animateLayout(); moveStop(s.id, 1); }}
                        disabled={i === stops.length - 1}
                        haptic="select"
                        accessibilityRole="button"
                        accessibilityLabel="Move stop down"
                      >
                        <Icon name="down" size={20} color={i === stops.length - 1 ? colors.ink3 : colors.ink} />
                      </PressableScale>
                      <PressableScale
                        style={styles.stopBtnWrap}
                        onPress={() => { if (!reduced) animateLayout(); removeStop(s.id); }}
                        haptic="tap"
                        accessibilityRole="button"
                        accessibilityLabel="Remove stop"
                      >
                        <Icon name="close" size={20} color={colors.bad} />
                      </PressableScale>
                    </View>
                  </FadeIn>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>RIDE TYPE · OPTIONAL</Text>
              <View style={styles.chipRow}>
                {RIDE_TYPES.map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    on={rideType === t}
                    onPress={() => setRideType((cur) => (cur === t ? null : t))}
                  />
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>START TIME · OPTIONAL</Text>
              <View style={styles.chipRow}>
                {START_PRESETS.map((p) => (
                  <Chip
                    key={p}
                    label={p}
                    on={startPreset === p}
                    onPress={() => setStartPreset((cur) => (cur === p ? null : p))}
                  />
                ))}
              </View>
            </View>
          </ScrollView>

          <PresenceFade visible={destination == null} reduced={reduced}>
            <Text style={styles.reason} accessibilityLiveRegion="polite">
              Choose a destination to continue
            </Text>
          </PresenceFade>
          <Button
            label="Create ride"
            onPress={create}
            loading={creating}
            disabled={!canCreate}
            style={styles.createBtn}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
