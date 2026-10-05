/**
 * CreateRideModal — pop-up shown when the user taps "+" (Create Ride).
 * Collects: start location, destination, intermediate stops, and an optional
 * ride type and start time. Each location field autocompletes via Mapbox.
 * On Create: saves plan to ridePlanStore, creates the Firestore group.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { WeRideColors, WeRideRadius, WeRideSpacing } from '../theme/theme';
import { type } from '../theme/typography';
import { geocodeSearchStrict, GeoResult } from '../utils/geocode';
import { START_PRESETS, StartPreset, startTimeFromPreset } from '../utils/startTime';
import { useRidePlanStore, PlannedStop } from '../store/ridePlanStore';
import { useToastStore } from '../store/toastStore';
import { GroupService, RIDE_TYPES, RideType, RideMeta } from '@routing/group/groupService';
import { useAppStore } from '../store/appStore';

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

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      <Text style={[type.bodyStrong, { color: selected ? WeRideColors.primary : WeRideColors.textSub }]}>{label}</Text>
    </Pressable>
  );
}

export default function CreateRideModal({ visible, onClose, onCreated }: Props) {
  const { start, destination, stops, setStart, setDestination, addStop, removeStop, moveStop } =
    useRidePlanStore();
  const setGroupId = useAppStore((s) => s.setGroupId);
  const push = useToastStore((s) => s.push);

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
    if (field === 'start') setStart(r);
    else if (field === 'destination') setDestination(r);
    else addStop({ id: `${Date.now()}-${Math.random()}`, label: r.label, lat: r.lat, lng: r.lng, icon: stopIcon() });
    setQuery('');
    setResults([]);
  }, [field, setStart, setDestination, addStop]);

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
      onCreated(groupId);
      onClose();
    } catch {
      push('Could not create the ride. Try again.', 'error');
    } finally {
      setCreating(false);
    }
  }, [canCreate, start, destination, stops, rideType, startPreset, setGroupId, push, onCreated, onClose]);

  const renderLocationRow = (label: string, hint: string, value: GeoResult | null, f: Field) => (
    <Pressable
      style={[styles.locRow, field === f && styles.locRowActive]}
      onPress={() => { setField(f); setQuery(''); setResults([]); searchRef.current?.focus(); }}
      accessibilityRole="button"
      accessibilityLabel={`${label} field`}
      accessibilityState={{ selected: field === f }}
    >
      <View style={[styles.dot, f === 'destination' && styles.dotFilled, f === 'stop' && styles.dotPlus]}>
        {f === 'stop' ? <Text style={[type.captionStrong, { color: WeRideColors.textSub }]}>+</Text> : null}
      </View>
      <View style={styles.locTextWrap}>
        <Text style={[type.label, styles.upper]}>{label}</Text>
        {value ? (
          <Text style={[type.body, styles.locValue]} numberOfLines={1}>{value.label}</Text>
        ) : (
          <Text style={[type.caption, styles.locValue]}>{hint}</Text>
        )}
      </View>
    </Pressable>
  );

  const searching = search.status === 'loading';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <Pressable style={styles.overlayPress} onPress={onClose} accessibilityLabel="Close create ride" />
        <View style={styles.box}>
          <View style={styles.headerRow}>
            <View>
              <Text style={type.eyebrow}>NEW RIDE</Text>
              <Text style={type.titleSm}>Plan your route</Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={[type.body, { color: WeRideColors.textSub }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {renderLocationRow('Starting from', 'Optional. Tap, then search', start, 'start')}
            {renderLocationRow('Destination', 'Required. Tap, then search', destination, 'destination')}
            {renderLocationRow('Add a stop', 'Optional. Tap, then search', null, 'stop')}

            <TextInput
              ref={searchRef}
              style={styles.searchInput}
              placeholder={FIELD_PLACEHOLDER[field]}
              placeholderTextColor={WeRideColors.textSub}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Location search input"
            />
            {searching ? <ActivityIndicator color={WeRideColors.primary} style={styles.searching} /> : null}

            {search.status === 'error' ? (
              <View style={styles.searchMsgRow} accessibilityLiveRegion="polite">
                <Text style={[type.caption, styles.searchMsg, { color: WeRideColors.error }]}>
                  Search is unavailable — check your connection
                </Text>
                <Pressable
                  style={styles.retryBtn}
                  onPress={() => setRetryNonce((n) => n + 1)}
                  accessibilityRole="button"
                  accessibilityLabel="Retry search"
                >
                  <Text style={[type.captionStrong, { color: WeRideColors.primary }]}>Retry</Text>
                </Pressable>
              </View>
            ) : null}
            {search.status === 'done' && results.length === 0 ? (
              <Text style={[type.caption, styles.searchMsgSolo]} accessibilityLiveRegion="polite">
                {`No places found for "${search.query}"`}
              </Text>
            ) : null}

            {results.length > 0 && (
              <View style={styles.resultsBox}>
                {results.map((item, i) => (
                  <Pressable
                    key={`${item.lat},${item.lng},${i}`}
                    style={[styles.resultRow, i === results.length - 1 && styles.resultRowLast]}
                    onPress={() => pick(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${item.label}`}
                  >
                    <Text style={type.body} numberOfLines={2}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {stops.length > 0 && (
              <View style={styles.section}>
                <Text style={[type.label, styles.sectionLabel]}>STOPS</Text>
                {stops.map((s: PlannedStop, i) => (
                  <View key={s.id} style={styles.stopRow}>
                    <Text style={styles.stopIconText}>{s.icon}</Text>
                    <Text style={[type.body, styles.stopLabel]} numberOfLines={1}>{s.label}</Text>
                    <Pressable
                      style={styles.stopBtnWrap}
                      onPress={() => moveStop(s.id, -1)}
                      disabled={i === 0}
                      accessibilityRole="button"
                      accessibilityLabel="Move stop up"
                    >
                      <Text style={[styles.stopBtn, i === 0 && styles.stopBtnDisabled]}>↑</Text>
                    </Pressable>
                    <Pressable
                      style={styles.stopBtnWrap}
                      onPress={() => moveStop(s.id, 1)}
                      disabled={i === stops.length - 1}
                      accessibilityRole="button"
                      accessibilityLabel="Move stop down"
                    >
                      <Text style={[styles.stopBtn, i === stops.length - 1 && styles.stopBtnDisabled]}>↓</Text>
                    </Pressable>
                    <Pressable
                      style={styles.stopBtnWrap}
                      onPress={() => removeStop(s.id)}
                      accessibilityRole="button"
                      accessibilityLabel="Remove stop"
                    >
                      <Text style={styles.stopRemove}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text style={[type.label, styles.sectionLabel]}>RIDE TYPE · OPTIONAL</Text>
              <View style={styles.chipRow}>
                {RIDE_TYPES.map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    selected={rideType === t}
                    onPress={() => setRideType((cur) => (cur === t ? null : t))}
                  />
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[type.label, styles.sectionLabel]}>START TIME · OPTIONAL</Text>
              <View style={styles.chipRow}>
                {START_PRESETS.map((p) => (
                  <Chip
                    key={p}
                    label={p}
                    selected={startPreset === p}
                    onPress={() => setStartPreset((cur) => (cur === p ? null : p))}
                  />
                ))}
              </View>
            </View>
          </ScrollView>

          {destination == null ? (
            <Text style={[type.caption, styles.reason]} accessibilityLiveRegion="polite">
              Choose a destination to continue
            </Text>
          ) : null}
          <Pressable
            style={({ pressed }) => [styles.createBtn, pressed && styles.btnPressed, !canCreate && styles.btnDisabled]}
            onPress={create}
            disabled={!canCreate}
            accessibilityLabel="Create ride"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canCreate, busy: creating }}
          >
            {creating ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={WeRideColors.onPrimary} size="small" />
                <Text style={type.button}>Creating…</Text>
              </View>
            ) : (
              <Text style={type.button}>Create ride</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000CC', justifyContent: 'flex-end' },
  overlayPress: { flex: 1 },
  box: {
    backgroundColor: WeRideColors.dark2,
    borderTopLeftRadius: WeRideRadius.xxxl,
    borderTopRightRadius: WeRideRadius.xxxl,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    maxHeight: '90%',
    paddingBottom: WeRideSpacing.xxl,
  },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: WeRideSpacing.lg, paddingTop: WeRideSpacing.lg, paddingBottom: WeRideSpacing.sm,
  },
  closeBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 0, flexShrink: 1 },
  scrollContent: { paddingHorizontal: WeRideSpacing.lg, paddingBottom: WeRideSpacing.sm },
  upper: { textTransform: 'uppercase' },
  locRow: {
    flexDirection: 'row', alignItems: 'center', gap: WeRideSpacing.md,
    minHeight: 56,
    backgroundColor: WeRideColors.dark3, borderWidth: 1, borderColor: WeRideColors.border,
    borderRadius: WeRideRadius.lg, padding: WeRideSpacing.md, marginTop: WeRideSpacing.sm,
  },
  locRowActive: { borderColor: WeRideColors.primary },
  dot: {
    width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: WeRideColors.textSub,
    alignItems: 'center', justifyContent: 'center',
  },
  dotFilled: { borderColor: WeRideColors.primary, backgroundColor: WeRideColors.primary },
  dotPlus: { borderWidth: 0 },
  locTextWrap: { flex: 1 },
  locValue: { marginTop: WeRideSpacing.xs },
  searchInput: {
    ...type.input,
    height: 48, backgroundColor: WeRideColors.dark3, borderWidth: 1, borderColor: WeRideColors.border,
    borderRadius: WeRideRadius.lg, paddingHorizontal: WeRideSpacing.md, marginTop: WeRideSpacing.md,
  },
  searching: { marginTop: WeRideSpacing.sm, alignSelf: 'center' },
  searchMsgRow: { flexDirection: 'row', alignItems: 'center', marginTop: WeRideSpacing.sm, gap: WeRideSpacing.sm },
  searchMsg: { flex: 1 },
  searchMsgSolo: { marginTop: WeRideSpacing.sm },
  retryBtn: { minHeight: 44, minWidth: 44, paddingHorizontal: WeRideSpacing.md, alignItems: 'center', justifyContent: 'center' },
  resultsBox: {
    backgroundColor: WeRideColors.dark3, borderWidth: 1, borderColor: WeRideColors.border,
    borderRadius: WeRideRadius.lg, marginTop: WeRideSpacing.sm,
  },
  resultRow: {
    minHeight: 44, justifyContent: 'center', padding: WeRideSpacing.md,
    borderBottomWidth: 1, borderBottomColor: WeRideColors.border,
  },
  resultRowLast: { borderBottomWidth: 0 },
  section: { marginTop: WeRideSpacing.lg },
  sectionLabel: { marginBottom: WeRideSpacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: WeRideSpacing.sm },
  chip: {
    minHeight: 44, paddingHorizontal: WeRideSpacing.lg, justifyContent: 'center',
    backgroundColor: WeRideColors.dark3, borderWidth: 1, borderColor: WeRideColors.border,
    borderRadius: WeRideRadius.pill,
  },
  chipSelected: { borderColor: WeRideColors.primary, backgroundColor: WeRideColors.primaryDim },
  stopRow: {
    flexDirection: 'row', alignItems: 'center', gap: WeRideSpacing.xs,
    minHeight: 48,
    backgroundColor: WeRideColors.dark3, borderWidth: 1, borderColor: WeRideColors.border,
    borderRadius: WeRideRadius.lg, paddingLeft: WeRideSpacing.md, marginBottom: WeRideSpacing.sm,
  },
  stopIconText: { fontSize: 16, lineHeight: 20 },
  stopLabel: { flex: 1, marginLeft: WeRideSpacing.sm },
  stopBtnWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stopBtn: { ...type.body, color: WeRideColors.primary },
  stopBtnDisabled: { color: WeRideColors.textSub, opacity: 0.4 },
  stopRemove: { ...type.body, color: WeRideColors.error },
  reason: { marginHorizontal: WeRideSpacing.lg, marginTop: WeRideSpacing.md, textAlign: 'center' },
  createBtn: {
    minHeight: 50, backgroundColor: WeRideColors.primary, borderRadius: WeRideRadius.xl,
    justifyContent: 'center', alignItems: 'center',
    marginHorizontal: WeRideSpacing.lg, marginTop: WeRideSpacing.md,
  },
  btnPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.4 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: WeRideSpacing.sm },
});
