/**
 * CreateRideModal — pop-up shown when the user taps "+" (Create Ride).
 * Collects: start location, destination, and any intermediate stops.
 * Each location field autocompletes via Mapbox Geocoding.
 * On Create: saves plan to ridePlanStore, creates the Firestore group.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, TextInput, FlatList,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { WeRideColors, WeRideFonts } from '../theme/theme';
import { geocodeSearch, GeoResult } from '../utils/geocode';
import { useRidePlanStore, PlannedStop } from '../store/ridePlanStore';
import { useToastStore } from '../store/toastStore';
import { GroupService } from '@routing/group/groupService';
import { useAppStore } from '../store/appStore';

type Field = 'start' | 'destination' | 'stop';

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

export default function CreateRideModal({ visible, onClose, onCreated }: Props) {
  const { start, destination, stops, setStart, setDestination, addStop, removeStop, moveStop } =
    useRidePlanStore();
  const setGroupId = useAppStore((s) => s.setGroupId);
  const push = useToastStore((s) => s.push);

  const [field, setField] = useState<Field>('start');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // Debounced geocoding autocomplete
  useEffect(() => {
    if (!visible) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.trim().length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const r = await geocodeSearch(query);
      setResults(r);
      setSearching(false);
    }, 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, visible]);

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
      const groupService = new GroupService();
      const groupId = await groupService.createGroup(
        destination ? `Ride to ${destination.label.split(',')[0]}` : undefined,
        {
          start: start ? { label: start.label, lat: start.lat, lng: start.lng } : null,
          destination: destination ? { label: destination.label, lat: destination.lat, lng: destination.lng } : null,
          stops: stops.map((s) => ({ id: s.id, label: s.label, lat: s.lat, lng: s.lng, icon: s.icon })),
        }
      );
      setGroupId(groupId);
      push('Ride created — share the join code with your group', 'success');
      onCreated(groupId);
      onClose();
    } catch (e) {
      console.error('[CreateRideModal] createGroup failed:', e);
      push('Failed to create ride', 'error');
    } finally {
      setCreating(false);
    }
  }, [canCreate, start, destination, stops, setGroupId, push, onCreated, onClose]);

  const renderLocationRow = (label: string, value: GeoResult | null, f: Field, icon: string) => (
    <Pressable
      style={[styles.locRow, field === f && styles.locRowActive]}
      onPress={() => { setField(f); setQuery(''); setResults([]); }}
      accessibilityLabel={`${label} field`}
    >
      <Text style={styles.locIcon}>{icon}</Text>
      <View style={styles.locTextWrap}>
        <Text style={styles.locLabel}>{label}</Text>
        {value ? (
          <Text style={styles.locValue} numberOfLines={1}>{value.label}</Text>
        ) : (
          <Text style={styles.locPlaceholder}>Tap, then type to search</Text>
        )}
      </View>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <Pressable style={styles.overlayPress} onPress={onClose} accessibilityLabel="Close create ride" />
        <View style={styles.box}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.eyebrow}>NEW RIDE</Text>
              <Text style={styles.title}>Plan your route</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {renderLocationRow('Starting from', start, 'start', '📍')}
            {renderLocationRow('Destination', destination, 'destination', '🏁')}
            {renderLocationRow('Add a stop', null, 'stop', '➕')}

            {/* Search input for the selected field */}
            <TextInput
              style={styles.searchInput}
              placeholder={`Search ${field === 'start' ? 'start location' : field === 'destination' ? 'destination' : 'a stop'}`}
              placeholderTextColor={WeRideColors.textSub}
              value={query}
              onChangeText={setQuery}
              accessibilityLabel="Location search input"
            />
            {searching ? <ActivityIndicator color={WeRideColors.primary} style={styles.searching} /> : null}

            {results.length > 0 && (
              <View style={styles.resultsBox}>
                <FlatList
                  data={results}
                  keyExtractor={(r, i) => `${r.lat},${r.lng},${i}`}
                  renderItem={({ item }) => (
                    <Pressable style={styles.resultRow} onPress={() => pick(item)} accessibilityLabel={`Select ${item.label}`}>
                      <Text style={styles.resultText} numberOfLines={2}>{item.label}</Text>
                    </Pressable>
                  )}
                />
              </View>
            )}

            {/* Chosen stops list */}
            {stops.length > 0 && (
              <View style={styles.stopsBox}>
                <Text style={styles.stopsHeader}>STOPS</Text>
                {stops.map((s: PlannedStop, i) => (
                  <View key={s.id} style={styles.stopRow}>
                    <Text style={styles.stopIconText}>{s.icon}</Text>
                    <Text style={styles.stopLabel} numberOfLines={1}>{s.label}</Text>
                    <Pressable onPress={() => moveStop(s.id, -1)} disabled={i === 0} hitSlop={6} accessibilityLabel="Move stop up">
                      <Text style={[styles.stopBtn, i === 0 && styles.stopBtnDisabled]}>↑</Text>
                    </Pressable>
                    <Pressable onPress={() => moveStop(s.id, 1)} disabled={i === stops.length - 1} hitSlop={6} accessibilityLabel="Move stop down">
                      <Text style={[styles.stopBtn, i === stops.length - 1 && styles.stopBtnDisabled]}>↓</Text>
                    </Pressable>
                    <Pressable onPress={() => removeStop(s.id)} hitSlop={6} accessibilityLabel="Remove stop">
                      <Text style={styles.stopRemove}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <Pressable
            style={({ pressed }) => [styles.createBtn, pressed && styles.btnPressed, !canCreate && styles.btnDisabled]}
            onPress={create}
            disabled={!canCreate}
            accessibilityLabel="Create ride"
            accessibilityRole="button"
          >
            {creating ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={WeRideColors.onPrimary} size="small" />
                <Text style={styles.createBtnText}>Creating…</Text>
              </View>
            ) : (
              <Text style={styles.createBtnText}>Create Ride</Text>
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10,
  },
  eyebrow: { fontFamily: WeRideFonts.mono, fontSize: 9, letterSpacing: 1, color: WeRideColors.primary },
  title: { fontFamily: WeRideFonts.heading, fontSize: 24, color: WeRideColors.text },
  close: { fontFamily: WeRideFonts.body, fontSize: 18, color: WeRideColors.textSub, padding: 4 },
  scroll: { maxHeight: 400 },
  scrollContent: { paddingHorizontal: 18 },
  locRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: WeRideColors.dark3, borderWidth: 1, borderColor: WeRideColors.border,
    borderRadius: 10, padding: 12, marginTop: 8,
  },
  locRowActive: { borderColor: WeRideColors.primary },
  locIcon: { fontSize: 18 },
  locTextWrap: { flex: 1 },
  locLabel: { fontFamily: WeRideFonts.mono, fontSize: 9, letterSpacing: 1, color: WeRideColors.textSub, textTransform: 'uppercase' },
  locValue: { fontFamily: WeRideFonts.body, fontSize: 13, color: WeRideColors.text, marginTop: 2 },
  locPlaceholder: { fontFamily: WeRideFonts.body, fontSize: 12, color: WeRideColors.textSub, marginTop: 2 },
  searchInput: {
    height: 44, backgroundColor: WeRideColors.dark3, borderWidth: 1, borderColor: WeRideColors.border,
    borderRadius: 10, paddingHorizontal: 12, marginTop: 10,
    fontFamily: WeRideFonts.body, fontSize: 14, color: WeRideColors.text,
  },
  searching: { marginTop: 8, alignSelf: 'center' },
  resultsBox: {
    backgroundColor: WeRideColors.dark3, borderWidth: 1, borderColor: WeRideColors.border,
    borderRadius: 10, marginTop: 8, maxHeight: 180,
  },
  resultRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: WeRideColors.border },
  resultText: { fontFamily: WeRideFonts.body, fontSize: 12, color: WeRideColors.text },
  stopsBox: { marginTop: 12 },
  stopsHeader: { fontFamily: WeRideFonts.mono, fontSize: 9, letterSpacing: 1, color: WeRideColors.textSub, marginBottom: 6 },
  stopRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: WeRideColors.dark3, borderWidth: 1, borderColor: WeRideColors.border,
    borderRadius: 10, padding: 10, marginBottom: 6,
  },
  stopIconText: { fontSize: 14 },
  stopLabel: { flex: 1, fontFamily: WeRideFonts.body, fontSize: 12, color: WeRideColors.text },
  stopBtn: { fontSize: 14, color: WeRideColors.primary, width: 22, textAlign: 'center' },
  stopBtnDisabled: { color: WeRideColors.textSub, opacity: 0.4 },
  stopRemove: { fontSize: 13, color: WeRideColors.error, width: 22, textAlign: 'center' },
  createBtn: {
    height: 50, backgroundColor: WeRideColors.primary, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginHorizontal: 18, marginTop: 14,
  },
  btnPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.4 },
  createBtnText: { fontFamily: WeRideFonts.body, fontSize: 14, fontWeight: '700', color: WeRideColors.onPrimary },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});