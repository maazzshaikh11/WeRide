/**
 * RouteSheet — route details, opened from the live screen's speed/ETA cluster or
 * its ROUTE side button (spec §3.3.8, §4.6). Replaces the always-on bottom panel so
 * the Road screen stays clear.
 * Shows ETA, distance, next stop, who is live, the safety score, the
 * avoid-hazards switch and the Google Maps hand-off. With no route it shows a real
 * empty state (waiting for a fix / no destination) instead of placeholder numbers.
 * Guidance is destination-level (route line, distance, ETA); turn-by-turn is handed
 * off to Google Maps — no turn list is ever invented.
 * Data: useRouteStore() (Person C), useRidersStore() (Person A).
 */
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { safetyScoreColor } from '@app/theme/theme';
import { useRouteStore } from '@routing/client/routeStore';
import { useRidersStore } from '@app/store/ridersStore';
import { useAppStore } from '@app/store/appStore';
import { useRidePlanStore } from '@app/store/ridePlanStore';
import { useStopsStore } from '@app/store/stopsStore';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import { Button, Icon, Sheet, Skeleton, Toggle } from '../ui';
import AvatarStack from './AvatarStack';
import { EMPTY_STATE_COPY, routePanelMode } from './routePanelState';

interface Props {
  visible: boolean;
  onClose: () => void;
  avoidHazards?: boolean;
  onToggleAvoidHazards?: () => void;
  onOpenInGoogleMaps?: () => void;
}

export default function RouteSheet({ visible, onClose, avoidHazards = false, onToggleAvoidHazards, onOpenInGoogleMaps }: Props) {
  const { colors, type } = useTheme();
  const s = useStyles(({ colors: c }) => ({
    stats: { flexDirection: 'row', marginTop: 4 },
    stat: { flex: 1 },
    divider: { width: 1.5, alignSelf: 'stretch', backgroundColor: c.line, marginRight: 16 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
    track: { height: 8, borderRadius: 4, backgroundColor: c.card2, overflow: 'hidden', borderWidth: 1, borderColor: c.line },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 20, padding: 16, borderRadius: 22, backgroundColor: c.card, borderWidth: 1.5, borderColor: c.line },
  }));
  const route = useRouteStore((st) => st.route);
  const isLoading = useRouteStore((st) => st.isLoading);
  const lastValidLocation = useRouteStore((st) => st.lastValidLocation);
  const riders = useRidersStore((st) => st.riders);
  const rideStartedAt = useAppStore((st) => st.rideStartedAt);
  const planStart = useRidePlanStore((st) => st.start);
  const planDestination = useRidePlanStore((st) => st.destination);
  const stops = useStopsStore((st) => st.stops);

  const riderNames = Array.from(riders.keys());
  // Riders actually reporting (not stale/grey) plus this device. Seeded
  // last-known positions of offline members must not inflate the count.
  const liveRiders = Array.from(riders.values()).filter((r) => r.markerState !== 'GREY').length + 1;
  const eta = route ? Math.round(route.eta_minutes) : null;
  const distance = route ? route.distance_km.toFixed(1) : null;
  const safety = route?.safety_score ?? null;

  const mode = routePanelMode({
    hasRoute: route != null,
    isLoading,
    hasFix: lastValidLocation != null,
    hasDestination: planDestination != null,
  });

  // Meta: "Pune → Lonavala ∙ started 38 min ago" (spec §3.3.8), only real parts.
  const shortLabel = (label?: string | null) => label?.split(',')[0] ?? null;
  const originLabel = shortLabel(planStart?.label);
  const destLabel = shortLabel(planDestination?.label);
  const routeLabel = originLabel && destLabel ? `${originLabel} → ${destLabel}` : destLabel ? `→ ${destLabel}` : null;
  const startedAgo = rideStartedAt != null ? `started ${Math.max(1, Math.round((Date.now() - rideStartedAt) / 60000))} min ago` : null;
  const metaText = [routeLabel, startedAgo].filter(Boolean).join(' ∙ ');

  const currentStop = stops.find((x) => x.status === 'current') ?? stops.find((x) => x.status === 'upcoming');
  const empty = mode === 'ready' || mode === 'loading' ? null : EMPTY_STATE_COPY[mode];
  const recalculating = mode === 'loading';
  const showStats = mode === 'ready' || recalculating;
  const placeholderStats = recalculating && route == null;

  return (
    <Sheet visible={visible} onClose={onClose} testID="route-sheet" accessibilityLabel="Route details">
      {recalculating ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ActivityIndicator color={colors.pri} size="small" />
          <Text style={[type.sm, { color: colors.ink }]} numberOfLines={1}>Recalculating route…</Text>
        </View>
      ) : (
        <Text style={type.label} numberOfLines={1}>{(metaText || 'ROUTE').toUpperCase()}</Text>
      )}

      {showStats ? (
        <>
          <View style={[s.stats, { marginTop: 14 }]}>
            <View style={s.stat}>
              {placeholderStats ? <Skeleton width={64} height={28} /> : (
                <Text style={[type.statValue, { fontSize: 34, lineHeight: 34 }, recalculating && { opacity: 0.55 }]} testID="route-eta">{eta != null ? String(eta) : ''}</Text>
              )}
              <Text style={[type.statKey, { marginTop: 6 }]}>MIN LEFT</Text>
            </View>
            <View style={s.divider} />
            <View style={s.stat}>
              {placeholderStats ? <Skeleton width={64} height={28} /> : (
                <Text style={[type.statValue, { fontSize: 34, lineHeight: 34 }, recalculating && { opacity: 0.55 }]} testID="route-km">{distance ?? ''}</Text>
              )}
              <Text style={[type.statKey, { marginTop: 6 }]}>KM LEFT</Text>
            </View>
          </View>
          {currentStop ? (
            <View style={s.row}>
              <Text style={type.statKey}>NEXT STOP</Text>
              <Text style={[type.bodyStrong, { flex: 1 }]} numberOfLines={1}>{`${currentStop.icon} ${currentStop.name}`}</Text>
            </View>
          ) : null}
        </>
      ) : empty ? (
        <View style={{ minHeight: 44, justifyContent: 'center', marginTop: 12 }}>
          <Text style={type.h3}>{empty.title}</Text>
          <Text style={[type.sm, { marginTop: 4 }]}>{empty.detail}</Text>
        </View>
      ) : null}

      <View style={s.row}>
        <AvatarStack names={riderNames} max={4} />
        <Text style={type.smStrong}>{liveRiders} rider{liveRiders !== 1 ? 's' : ''} live</Text>
      </View>

      <View style={{ marginTop: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <Text style={type.label}>SAFETY SCORE</Text>
          <Text style={type.smStrong}>{safety != null ? `${Math.round(safety * 100)}%` : 'Not rated'}</Text>
        </View>
        <View style={s.track}>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: safety != null ? safetyScoreColor(safety) : colors.line2, width: `${Math.max(0, Math.min(1, safety ?? 0)) * 100}%` }} />
        </View>
      </View>

      <View style={s.toggleRow}>
        <Icon name="haz" size={22} color={avoidHazards ? colors.ok : colors.ink3} />
        <View style={{ flex: 1 }}>
          <Text style={type.listTitle}>{avoidHazards ? 'Avoiding hazards' : 'Hazards ignored'}</Text>
          <Text style={[type.listSub, { marginTop: 3 }]}>Route around confirmed hazards when it can</Text>
        </View>
        <Toggle
          value={avoidHazards}
          onChange={() => onToggleAvoidHazards?.()}
          accessibilityLabel={avoidHazards ? 'Avoiding hazards: on. Tap to disable' : 'Avoiding hazards: off. Tap to enable'}
        />
      </View>

      <Button
        label="Open in Google Maps"
        accessibilityLabel="Open route in Google Maps"
        haptic="tap"
        variant="primary"
        onPress={onOpenInGoogleMaps}
        style={{ marginTop: 16 }}
      />
      <Text style={[type.sm, { textAlign: 'center', marginTop: 16 }]}>
        Turn-by-turn isn't built in. Open the route in Google Maps for step-by-step directions.
      </Text>
    </Sheet>
  );
}
