/**
 * PlanRoute — step 2 of 3 (demo `plan-route`): the real routing server's options between the start and the
 * destination (up to three: duration, distance, safety score, hazard note), a map sketch of the chosen one
 * with hazard diamonds from the real active clusters near its path, and "Use this route".
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { RoutingClient } from '@routing/client/routingClient';
import type { RootStackParamList } from '../../navigation/types';
import type { RouteAlternative } from '../../models/routeResponse';
import type { HazardCluster } from '../../models/hazardCluster';
import { ROUTING_BASE_URL } from '../../services/endpoints';
import { usePlanDraftStore } from '../../store/planDraftStore';
import { usePrefsStore } from '../../store/prefsStore';
import { useRidesStore } from '../../store/ridesStore';
import { useSessionStore } from '../../store/sessionStore';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import { Button, IconWell, MapSketch, Pill, PressableScale, Screen, Skeleton } from '../../ui';
import type { IconName, SketchMarker } from '../../ui';
import { reverseGeocode } from '../../utils/geocode';
import { getMyPosition, MY_LOCATION_FALLBACK } from '../../utils/myPosition';
import { buildOptions, alternativesOf, durationLabel, RouteOption } from '../../utils/routeOptions';
import { hazardsNearPath, pairsToPoints } from '../../utils/routeGeo';
import { shortPlace } from '../../utils/rides';
import { formatDistance } from '../../utils/units';
import StepHeader from './parts/StepHeader';
import { useActiveClustersState } from './parts/useActiveClusters';

type Props = StackScreenProps<RootStackParamList, 'PlanRoute'>;

const ALL_HAZARD_TYPES = ['pothole', 'oil_spill', 'accident', 'debris', 'other'];
/** Clusters of the rider's most recent rides inform the plan (hazards are stored per ride). */
const MAX_HAZARD_RIDES = 8;
const ICON: Record<string, IconName> = { Fastest: 'clock', Safest: 'shield' };

export default function PlanRouteScreen({ navigation }: Props) {
  const { colors, type } = useTheme();
  const styles = useStyles(({ colors: c, type: t }) => ({
    mapBox: { marginTop: 16, borderRadius: 24, overflow: 'hidden', borderWidth: 1.5, borderColor: c.line },
    mapPill: { position: 'absolute', left: 12, top: 12 },
    cards: { marginTop: 16, gap: 12 },
    card: { borderRadius: 22, backgroundColor: c.card, borderWidth: 1.5, borderColor: c.line, padding: 18 },
    cardOn: { borderWidth: 3, borderColor: c.ink, padding: 16.5 },
    head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    mid: { flex: 1, minWidth: 0 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    note: { ...t.sm, marginTop: 8 },
    right: { alignItems: 'flex-end', flexShrink: 0 },
    dur: { ...t.num, fontSize: 22, lineHeight: 24, letterSpacing: -0.44 },
    dist: { ...t.sm, fontFamily: t.num.fontFamily },
    safetyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
    bar: { flex: 1, height: 8, borderRadius: 4, backgroundColor: c.line, overflow: 'hidden' },
    safetyNum: { ...t.num, fontFamily: t.statValue.fontFamily, fontSize: 15 },
    err: { ...t.body, marginTop: 24 },
  }));
  const units = usePrefsStore((s) => s.prefs.units);
  const uid = useSessionStore((s) => s.uid);
  const rides = useRidesStore((s) => s.rides);
  const start = usePlanDraftStore((s) => s.start);
  const destination = usePlanDraftStore((s) => s.destination);
  const options = usePlanDraftStore((s) => s.options);
  const chosen = usePlanDraftStore((s) => s.chosenOption);
  const setStart = usePlanDraftStore((s) => s.setStart);
  const setOptions = usePlanDraftStore((s) => s.setOptions);
  const chooseOption = usePlanDraftStore((s) => s.chooseOption);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'nostart'>(options.length > 0 ? 'ready' : 'loading');
  const [nonce, setNonce] = useState(0);
  const requestId = useRef(0);

  const hazardRideIds = useMemo(() => rides.slice(0, MAX_HAZARD_RIDES).map((r) => r.id), [rides]);
  const { clusters, ready: clustersReady } = useActiveClustersState(hazardRideIds);
  const clustersRef = useRef<HazardCluster[]>(clusters);
  clustersRef.current = clusters;

  // No start chosen: use where the rider is.
  useEffect(() => {
    if (start || !destination) return;
    let alive = true;
    (async () => {
      const pos = await getMyPosition();
      if (!alive) return;
      if (!pos) {
        setStatus('nostart');
        return;
      }
      const label = (await reverseGeocode(pos.lat, pos.lng)) ?? MY_LOCATION_FALLBACK;
      if (alive) setStart({ label, lat: pos.lat, lng: pos.lng });
    })().catch(() => alive && setStatus('nostart'));
    return () => {
      alive = false;
    };
  }, [start, destination, setStart]);

  const load = useCallback(
    async () => {
      const s = usePlanDraftStore.getState();
      if (!s.start || !s.destination) return;
      const id = ++requestId.current;
      setStatus('loading');
      try {
        const client = new RoutingClient({ baseUrl: ROUTING_BASE_URL });
        const route = await client.requestRoute({
          group_id: `plan-${uid ?? 'rider'}`,
          origin: { lat: s.start.lat, lng: s.start.lng },
          destination: { lat: s.destination.lat, lng: s.destination.lng },
          avoid_hazard_types: ALL_HAZARD_TYPES,
          active_hazards: clustersRef.current.map((c) => ({
            centroid_lat: c.centroid_lat,
            centroid_lng: c.centroid_lng,
            hazard_type: c.hazard_type,
            hazard_score: c.hazard_score,
          })),
        });
        if (id !== requestId.current) return;
        setOptions(alternativesOf(route), 0);
        setStatus('ready');
      } catch {
        if (id !== requestId.current) return;
        setStatus('error');
      }
    },
    [uid, setOptions],
  );

  // Ask the server once there is a start and a destination and the hazard clusters have arrived (so the
  // routes are scored with them); again on "Try again".
  useEffect(() => {
    if (!start || !destination) return;
    if (usePlanDraftStore.getState().options.length > 0 && nonce === 0) {
      setStatus('ready');
      return;
    }
    if (!clustersReady) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-request only when the endpoints change, the clusters are ready, or on retry
  }, [start, destination, nonce, clustersReady]);

  const opts: RouteOption[] = useMemo(() => (options.length > 0 ? buildOptions(options) : []), [options]);
  const current: RouteAlternative | undefined = options[chosen] ?? options[0];
  const path = useMemo(() => (current ? pairsToPoints(current.path_points) : []), [current]);
  const nearby = useMemo(() => hazardsNearPath(path, clusters), [path, clusters]);
  const markers: SketchMarker[] = useMemo(() => nearby.map((c) => ({ lat: c.centroid_lat, lng: c.centroid_lng, kind: 'hazard' as const })), [nearby]);

  const from = shortPlace(start?.label) ?? 'Start';
  const to = shortPlace(destination?.label) ?? 'Destination';
  const loading = status === 'loading' || (status === 'ready' && !current);

  return (
    <Screen
      testID="screen-PlanRoute"
      cta={<Button label="Use this route" disabled={!current || status !== 'ready'} onPress={() => navigation.navigate('PlanWhen')} testID="use-route" />}
    >
      <StepHeader step={2} title={`${from} → ${to}`} onBack={() => navigation.goBack()} />

      {!destination ? (
        <Text style={styles.err}>Pick a destination first.</Text>
      ) : status === 'nostart' ? (
        <View testID="route-nostart">
          <Text style={styles.err} accessibilityLiveRegion="polite">We couldn’t find your location to start the route from. Go back and choose a starting point.</Text>
          <Button label="Choose a start" variant="soft" onPress={() => navigation.goBack()} style={{ marginTop: 16 }} />
        </View>
      ) : status === 'error' ? (
        <View testID="route-error">
          <Text style={styles.err} accessibilityLiveRegion="polite">We couldn’t get routes right now. Check your connection and try again.</Text>
          <Button label="Try again" variant="soft" onPress={() => setNonce((n) => n + 1)} style={{ marginTop: 16 }} />
        </View>
      ) : loading ? (
        <View style={styles.cards} testID="route-loading" accessibilityLiveRegion="polite" accessibilityLabel="Finding routes">
          <Skeleton height={210} radius={24} />
          <Skeleton height={120} radius={22} />
          <Skeleton height={120} radius={22} />
        </View>
      ) : (
        <>
          <View style={styles.mapBox}>
            <MapSketch points={path} markers={markers} height={210} pad={46} testID="route-map" />
            <View style={styles.mapPill}>
              <Pill label={nearby.length > 0 ? `${nearby.length} ${nearby.length === 1 ? 'hazard' : 'hazards'} on route` : 'No hazards on route'} tone="ink" />
            </View>
          </View>
          <View style={styles.cards}>
            {opts.map((o) => {
              const on = o.index === chosen;
              return (
                <PressableScale
                  key={o.alt.route_id}
                  onPress={() => chooseOption(o.index)}
                  haptic="select"
                  scaleTo={0.99}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${o.title}. ${durationLabel(o.durationMin)}, ${formatDistance(o.distanceKm, units)}. Safety ${o.safety}. ${o.note}`}
                  style={[styles.card, on && styles.cardOn]}
                  testID={`route-option-${o.index}`}
                >
                  <View style={styles.head}>
                    <IconWell icon={ICON[o.alt.label] ?? 'route'} accent={on} />
                    <View style={styles.mid}>
                      <View style={styles.titleRow}>
                        <Text style={type.h3}>{o.title}</Text>
                        {o.recommended ? <Pill label="Recommended" tone="accent" /> : null}
                      </View>
                      <Text style={styles.note}>{o.note}</Text>
                    </View>
                    <View style={styles.right}>
                      <Text style={styles.dur}>{durationLabel(o.durationMin)}</Text>
                      <Text style={styles.dist}>{formatDistance(o.distanceKm, units)}</Text>
                    </View>
                  </View>
                  <View style={styles.safetyRow}>
                    <Text style={type.label}>SAFETY</Text>
                    <View style={styles.bar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                      <View style={{ height: '100%', width: `${o.safety}%`, backgroundColor: o.safety >= 85 ? colors.ok : colors.pri }} />
                    </View>
                    <Text style={[styles.safetyNum, { color: colors.ink }]}>{o.safety}</Text>
                  </View>
                </PressableScale>
              );
            })}
          </View>
          <Text style={[type.sm, { marginTop: 12 }]}>
            Scores use the hazards riders have reported recently. Hazards show on the map when they are on the route.
          </Text>
        </>
      )}
    </Screen>
  );
}
