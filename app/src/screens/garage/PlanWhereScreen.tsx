/**
 * PlanWhere — step 1 of 3 (demo `plan-where`): "Where to?". Search any place with the Mapbox geocoder
 * (loading / error / empty states), start from the rider's current position (or a searched place), and pick
 * from "Popular with crews near you" = destinations of the rides in the rider's crews.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/types';
import type { Place } from '../../models/domain';
import { useCrewsStore } from '../../store/crewsStore';
import { usePlanDraftStore } from '../../store/planDraftStore';
import { usePrefsStore } from '../../store/prefsStore';
import { useRidesStore } from '../../store/ridesStore';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import { Icon, List, ListItem, Pill, PressableScale, Screen, SectionLabel } from '../../ui';
import { geocodingAvailable, geocodeSearchStrict, GeoResult, reverseGeocode } from '../../utils/geocode';
import { getMyPosition, MY_LOCATION_FALLBACK } from '../../utils/myPosition';
import { popularPlaces } from '../../utils/popularPlaces';
import { formatDistance } from '../../utils/units';
import StepHeader from './parts/StepHeader';

type Props = StackScreenProps<RootStackParamList, 'PlanWhere'>;
type Search = { status: 'idle' | 'loading' | 'done' | 'error'; query: string };

const DEBOUNCE_MS = 400;

export default function PlanWhereScreen({ navigation }: Props) {
  const { colors, type } = useTheme();
  const styles = useStyles(({ colors: c, type: t }) => ({
    searchWrap: { marginTop: 24, justifyContent: 'center' },
    searchIcon: { position: 'absolute', left: 18, zIndex: 1 },
    field: { height: 60, backgroundColor: c.card, borderWidth: 1.5, borderColor: c.line2, borderRadius: 18, paddingLeft: 52, paddingRight: 18, ...t.input },
    startRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
    startPill: { minHeight: 44, justifyContent: 'center' },
    note: { ...t.sm, marginTop: 12 },
    err: { ...t.sm, color: c.bad, flex: 1 },
    row: { padding: 16 },
    retry: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
    retryText: { ...t.smStrong, textDecorationLine: 'underline' },
    km: { ...t.num, fontSize: 14 },
  }));
  const units = usePrefsStore((s) => s.prefs.units);
  const rides = useRidesStore((s) => s.rides);
  const crews = useCrewsStore((s) => s.crews);
  const start = usePlanDraftStore((s) => s.start);
  const setStart = usePlanDraftStore((s) => s.setStart);
  const setDestination = usePlanDraftStore((s) => s.setDestination);

  const [editingStart, setEditingStart] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [search, setSearch] = useState<Search>({ status: 'idle', query: '' });
  const [retry, setRetry] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locFailed, setLocFailed] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const canSearch = geocodingAvailable();

  /** Start = where the rider is now, labelled with a real place name. */
  const locateMe = useCallback(async () => {
    setLocating(true);
    setLocFailed(false);
    try {
      const pos = await getMyPosition();
      if (!pos) {
        setLocFailed(true);
        return;
      }
      const label = (await reverseGeocode(pos.lat, pos.lng)) ?? MY_LOCATION_FALLBACK;
      setStart({ label, lat: pos.lat, lng: pos.lng });
    } finally {
      setLocating(false);
    }
  }, [setStart]);

  useEffect(() => {
    if (!usePlanDraftStore.getState().start) void locateMe();
  }, [locateMe]);

  // Debounced search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3 || !canSearch) {
      setResults([]);
      setSearch({ status: 'idle', query: q });
      return undefined;
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
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, retry, canSearch]);

  const popular = useMemo(() => popularPlaces(rides, crews, start), [rides, crews, start]);

  const choose = (p: Place) => {
    if (editingStart) {
      setStart(p);
      setEditingStart(false);
      setQuery('');
      setResults([]);
      return;
    }
    setDestination(p);
    navigation.navigate('PlanRoute');
  };

  const searching = query.trim().length >= 3;
  const startLabel = start ? start.label : locating ? 'Finding you…' : 'Choose a start';

  return (
    <Screen testID="screen-PlanWhere">
      <StepHeader step={1} title={editingStart ? 'Starting from?' : 'Where to?'} onBack={() => navigation.goBack()} />

      <View style={styles.searchWrap}>
        <View style={styles.searchIcon} pointerEvents="none">
          <Icon name="search" size={22} color={colors.ink3} />
        </View>
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={setQuery}
          placeholder={editingStart ? 'Search a starting point' : 'Search a town, ghat or lake'}
          placeholderTextColor={colors.ink3}
          style={styles.field}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel={editingStart ? 'Search a starting point' : 'Search a destination'}
          testID="plan-search"
        />
      </View>

      <View style={styles.startRow}>
        <Text style={type.sm}>Starting from</Text>
        <PressableScale
          onPress={() => {
            setEditingStart((v) => !v);
            setQuery('');
            setResults([]);
            inputRef.current?.focus();
          }}
          haptic="select"
          hitSlop={{ top: 9, bottom: 9, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel={`Starting from ${startLabel}. Tap to change`}
          style={styles.startPill}
          testID="start-pill"
        >
          <Pill label={startLabel} tone="ink" />
        </PressableScale>
        {locating ? <ActivityIndicator size="small" color={colors.ink2} /> : null}
      </View>
      {locFailed && !start ? (
        <Text style={[styles.note, { color: colors.bad }]} accessibilityLiveRegion="polite">
          We couldn’t find your location. Tap the start above to search for a starting point.
        </Text>
      ) : null}

      {editingStart && !searching ? (
        <List style={{ marginTop: 16 }}>
          <ListItem first icon="target" title="Use my current position" subtitle={locating ? 'Finding you…' : undefined} onPress={() => { void locateMe().then(() => setEditingStart(false)); }} testID="use-my-position" />
        </List>
      ) : null}

      {!canSearch && searching ? (
        <Text style={styles.note} accessibilityLiveRegion="polite">Place search isn’t available in this build.</Text>
      ) : null}

      {searching && canSearch ? (
        <>
          <SectionLabel>Results</SectionLabel>
          {search.status === 'loading' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityLiveRegion="polite" testID="search-loading">
              <ActivityIndicator color={colors.ink2} />
              <Text style={type.sm}>Searching…</Text>
            </View>
          ) : null}
          {search.status === 'error' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }} accessibilityLiveRegion="polite" testID="search-error">
              <Text style={styles.err}>Search is unavailable. Check your connection.</Text>
              <PressableScale onPress={() => setRetry((n) => n + 1)} haptic="tap" accessibilityRole="button" accessibilityLabel="Retry search" style={styles.retry}>
                <Text style={styles.retryText}>Retry</Text>
              </PressableScale>
            </View>
          ) : null}
          {search.status === 'done' && results.length === 0 ? (
            <Text style={type.sm} accessibilityLiveRegion="polite" testID="search-empty">{`No places found for “${search.query}”.`}</Text>
          ) : null}
          {results.length > 0 ? (
            <List>
              {results.map((r, i) => {
                const [head, ...rest] = r.label.split(',');
                return (
                  <ListItem
                    key={`${r.lat},${r.lng},${i}`}
                    first={i === 0}
                    icon="pin"
                    title={head}
                    subtitle={rest.join(',').trim() || undefined}
                    onPress={() => choose({ label: r.label, lat: r.lat, lng: r.lng })}
                    accessibilityLabel={`Select ${r.label}`}
                    testID={`result-${i}`}
                  />
                );
              })}
            </List>
          ) : null}
        </>
      ) : !editingStart && popular.length > 0 ? (
        <>
          <SectionLabel>Popular with crews near you</SectionLabel>
          <List>
            {popular.map((p, i) => (
              <ListItem
                key={p.short}
                first={i === 0}
                icon="pin"
                title={p.short}
                subtitle={[p.crewName, `${p.rides} ${p.rides === 1 ? 'ride' : 'rides'}`].filter(Boolean).join(' ∙ ')}
                right={p.kmFromStart != null ? <Text style={styles.km} accessibilityLabel={`About ${formatDistance(p.kmFromStart, units)} in a straight line`}>{`~${formatDistance(p.kmFromStart, units)}`}</Text> : undefined}
                onPress={() => choose({ label: p.label, lat: p.lat, lng: p.lng })}
                testID={`popular-${i}`}
              />
            ))}
          </List>
        </>
      ) : !editingStart ? (
        <Text style={styles.note} testID="plan-where-hint">
          Search for a town, ghat or lake to plan your route.
        </Text>
      ) : null}
    </Screen>
  );
}
