/**
 * Recap (demo `recap`): one logged ride. Hero = sketch of the recorded track with a real replay (play/pause, a draggable
 * scrubber, elapsed time; the head follows the recorded points), cohesion ring and longest gap, stats card, timeline from
 * the recorded events, "Rate the route" and "Share card".
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RideLog, RouteRating } from '../../models/domain';
import type { RootStackParamList } from '../../navigation/types';
import { getRideLog } from '../../services/rideLogService';
import RateRouteSheet from '../../sheets/RateRouteSheet';
import ShareCardSheet from '../../sheets/ShareCardSheet';
import { usePrefsStore } from '../../store/prefsStore';
import { useRideLogsStore } from '../../store/rideLogsStore';
import { useSessionStore } from '../../store/sessionStore';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import { Button, Card, CenterLine, Icon, KV, MapSketch, PressableScale, Rail, Ring, Screen, SectionLabel, Skeleton, TopBar, pointsFromFlat } from '../../ui';
import { eventTone, formatClock, formatElapsed, formatRideDate, hasTogetherData } from '../../utils/logStats';
import { distanceUnit, formatDistance, formatDuration, formatShortDistance, formatSpeed, gapLabel } from '../../utils/units';
import ReplayScrubber from './parts/ReplayScrubber';

type Props = StackScreenProps<RootStackParamList, 'Recap'>;

/** The replay always takes this long on screen, whatever the ride length (as in the demo). */
export const REPLAY_SECONDS = 14;
const FRESH_MS = 15 * 60 * 1000;
const RATING_LABEL: Record<RouteRating, string> = { smooth: 'Smooth', mixed: 'Mixed', rough: 'Rough' };

function useReplay(enabled: boolean) {
  const [p, setP] = useState(0);
  const [playing, setPlaying] = useState(false);
  const pRef = useRef(0);
  const set = useCallback((v: number) => {
    pRef.current = v;
    setP(v);
  }, []);

  useEffect(() => {
    if (!playing) return;
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const next = Math.min(1, pRef.current + (now - last) / 1000 / REPLAY_SECONDS);
      last = now;
      set(next);
      if (next >= 1) setPlaying(false);
    }, 50);
    return () => clearInterval(id);
  }, [playing, set]);

  const toggle = useCallback(() => {
    if (!enabled) return;
    if (!playing && pRef.current >= 1) set(0);
    setPlaying((v) => !v);
  }, [enabled, playing, set]);
  const seek = useCallback((v: number) => set(Math.max(0, Math.min(1, v))), [set]);
  const pause = useCallback(() => setPlaying(false), []);
  return { p, playing, toggle, seek, pause };
}

function RecapSkeleton() {
  return (
    <View testID="recap-loading" accessibilityLabel="Loading the ride" accessibilityLiveRegion="polite">
      <Skeleton width={90} height={11} style={{ marginTop: 16 }} />
      <Skeleton width="70%" height={32} style={{ marginTop: 10 }} />
      <Skeleton height={230} radius={24} style={{ marginTop: 16 }} />
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 24 }}>
        <Skeleton width={104} height={104} radius={52} />
        <View style={{ flex: 1 }}>
          <Skeleton width="50%" height={18} />
          <Skeleton height={13} style={{ marginTop: 10 }} />
          <Skeleton width="80%" height={13} style={{ marginTop: 6 }} />
        </View>
      </View>
    </View>
  );
}

function RecapBody({ log, onRate, onShare, rating }: { log: RideLog; onRate: () => void; onShare: () => void; rating: RouteRating | null }) {
  const { colors, type } = useTheme();
  const units = usePrefsStore((s) => s.prefs.units);
  const points = useMemo(() => pointsFromFlat(log.track), [log.track]);
  const canReplay = points.length >= 2;
  const replay = useReplay(canReplay);
  const s = useStyles(({ colors: c }) => ({
    hero: { height: 230, marginTop: 16, borderRadius: 24, overflow: 'hidden', backgroundColor: c.bg2 },
    heroRim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 24, borderWidth: 1.5, borderColor: c.line },
    replay: { position: 'absolute', left: 12, right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.card, borderRadius: 16, paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1.5, borderColor: c.line },
    play: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card, borderWidth: 1.5, borderColor: c.line },
  }));

  const together = hasTogetherData(log);
  const pct = Math.round(log.together_pct);
  const tight = together && pct >= 90;
  const fresh = Date.now() - log.ended_ms < FRESH_MS && Date.now() >= log.ended_ms;
  const date = formatRideDate(log.started_ms).toUpperCase();
  const elapsed = formatElapsed(replay.p * log.duration_s);
  const speedLabel = units === 'mi' ? 'mph' : 'km/h';

  const timeline = log.events.map((e) => ({ title: e.text || e.kind, sub: formatClock(e.t_ms), tone: eventTone(e.kind) }));

  return (
    <>
      <Text style={[type.label, { marginTop: 16 }]}>{`${date}${fresh ? ' ∙ JUST NOW' : ''}`}</Text>
      <Text style={[type.h1, { marginTop: 8 }]} accessibilityRole="header">{log.name}</Text>

      <View style={s.hero} testID="recap-hero">
        <MapSketch points={points} height={230} pad={40} progress={canReplay ? replay.p : undefined} testID="recap-map" />
        <View pointerEvents="none" style={s.heroRim} />
        {canReplay ? (
          <View style={s.replay} testID="recap-replay">
            <PressableScale
              onPress={replay.toggle}
              haptic="tap"
              style={s.play}
              accessibilityRole="button"
              accessibilityLabel={replay.playing ? 'Pause replay' : 'Play replay'}
              testID="replay-toggle"
            >
              <Icon name={replay.playing ? 'pause' : 'play'} size={18} color={colors.ink} />
            </PressableScale>
            <ReplayScrubber value={replay.p} onChange={replay.seek} onScrubStart={replay.pause} style={{ flex: 1 }} testID="replay-scrubber" />
            <Text style={[type.num, { fontSize: 13.5, minWidth: 52, textAlign: 'right' }]} testID="replay-time" accessibilityLabel={`Elapsed ${elapsed}`}>{elapsed}</Text>
          </View>
        ) : (
          <View style={s.replay} testID="recap-no-track">
            <Text style={[type.sm, { flex: 1, paddingVertical: 10 }]} accessibilityLiveRegion="polite">No track was recorded for this ride, so there is nothing to replay.</Text>
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 24 }}>
        <Ring value={together ? pct / 100 : 0} size={104} color={tight ? colors.ok : colors.ink}>
          <Text style={[type.statValue, { fontSize: 30, lineHeight: 30, letterSpacing: -0.9 }]} testID="recap-together">{together ? String(pct) : '—'}</Text>
          <Text style={[type.label, { marginTop: 3, fontSize: 9.5 }]}>% TOGETHER</Text>
        </Ring>
        <View style={{ flex: 1, minWidth: 0 }}>
          {together ? (
            <>
              <Text style={type.h3} testID="recap-verdict">{tight ? 'A tight ride.' : 'Spread out in places.'}</Text>
              <Text style={[type.sm, { marginTop: 8 }]} testID="recap-cohesion-copy">
                {`You stayed within ${formatShortDistance(500, units)} of the group ${pct}% of the time. Longest gap: `}
                <Text style={type.smStrong}>{gapLabel(log.longest_gap_m, units)}</Text>
                {'.'}
              </Text>
            </>
          ) : (
            <>
              <Text style={type.h3} testID="recap-verdict">No group data.</Text>
              <Text style={[type.sm, { marginTop: 8 }]} testID="recap-cohesion-copy">No other rider's location was seen on this ride, so there is no togetherness to report.</Text>
            </>
          )}
        </View>
      </View>

      <Card style={{ marginTop: 24 }} testID="recap-stats">
        <KV
          items={[
            { value: formatDistance(log.km, units, false), label: distanceUnit(units) },
            { value: formatDuration(log.duration_s).replace(' min', 'm'), label: 'time' },
            { value: formatSpeed(log.avg_kmh, units), label: `avg ${speedLabel}` },
          ]}
        />
        <CenterLine dim style={{ marginTop: 16 }} />
        <KV
          style={{ marginTop: 16 }}
          keyLines={2}
          items={[
            { value: String(log.riders), label: 'riders' },
            { value: String(log.hazards_shared), label: 'hazards shared' },
            { value: String(log.signals_sent), label: 'signals' },
          ]}
        />
      </Card>

      <SectionLabel>Timeline</SectionLabel>
      {timeline.length > 0 ? (
        <Rail items={timeline} />
      ) : (
        <Text style={type.sm} testID="recap-no-events">No moments were recorded for this ride.</Text>
      )}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
        <Button
          label={rating ? `Rated ${RATING_LABEL[rating]}` : 'Rate the route'}
          variant="soft"
          style={{ flex: 1 }}
          leading={<Icon name="star" size={20} color={colors.ink} />}
          onPress={onRate}
          accessibilityLabel={rating ? `Route rated ${RATING_LABEL[rating]}. Change rating` : 'Rate the route'}
          testID="recap-rate"
        />
        <Button
          label="Share card"
          style={{ flex: 1 }}
          leading={<Icon name="share" size={20} color={colors.priInk} />}
          onPress={onShare}
          testID="recap-share"
        />
      </View>
    </>
  );
}

export default function RecapScreen({ navigation, route }: Props) {
  const { colors, type } = useTheme();
  const rideId = route.params?.rideId;
  const uid = useSessionStore((s) => s.uid);
  const storeLog = useRideLogsStore((s) => s.logs.find((l) => l.ride_id === rideId) ?? null);
  const loaded = useRideLogsStore((s) => s.loaded);
  const watch = useRideLogsStore((s) => s.watch);
  const [fetched, setFetched] = useState<RideLog | null | undefined>(undefined);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [rated, setRated] = useState<RouteRating | null>(null);
  const [rateOpen, setRateOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => (uid ? watch(uid) : undefined), [uid, watch]);

  // a ride just saved may not be in the live list yet (or the list failed): read it directly once
  useEffect(() => {
    if (!uid || !rideId || !loaded || storeLog || fetched !== undefined) return;
    let alive = true;
    getRideLog(uid, rideId)
      .then((l) => alive && setFetched(l))
      .catch(() => {
        if (alive) {
          setFetched(null);
          setFetchFailed(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [uid, rideId, loaded, storeLog, fetched]);

  const log = storeLog ?? fetched ?? null;
  const loading = !log && (Boolean(uid) && (!loaded || fetched === undefined));
  const rating = rated ?? log?.rating ?? null;

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.reset({ index: 0, routes: [{ name: 'GarageTabs' }] });
  };

  const shareBtn = (
    <PressableScale
      onPress={() => log && setShareOpen(true)}
      disabled={!log}
      haptic="tap"
      accessibilityRole="button"
      accessibilityLabel="Share this ride"
      style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.line, opacity: log ? 1 : 0.4 }}
      testID="recap-share-icon"
    >
      <Icon name="share" size={22} color={colors.ink} />
    </PressableScale>
  );

  return (
    <View style={{ flex: 1 }}>
      <Screen testID="screen-Recap">
        <TopBar onBack={goBack} right={shareBtn} style={{ marginBottom: 0 }} />
        {log ? (
          <RecapBody log={log} rating={rating} onRate={() => setRateOpen(true)} onShare={() => setShareOpen(true)} />
        ) : loading ? (
          <RecapSkeleton />
        ) : (
          <Card style={{ marginTop: 24 }} testID="recap-missing">
            <Text style={type.h3} accessibilityLiveRegion="polite">{fetchFailed ? "Can't load this ride" : "We can't find this ride"}</Text>
            <Text style={[type.sm, { marginTop: 6 }]}>
              {fetchFailed
                ? "Check your connection and try again. Your rides are saved to your account."
                : "It isn't in your log. It may have been recorded on another account, or it didn't save."}
            </Text>
            <Button label="Back to my log" variant="soft" style={{ marginTop: 16 }} onPress={goBack} testID="recap-missing-back" />
          </Card>
        )}
      </Screen>
      <RateRouteSheet visible={rateOpen} onClose={() => setRateOpen(false)} rideId={rideId} current={rating} onRated={setRated} />
      <ShareCardSheet visible={shareOpen} onClose={() => setShareOpen(false)} log={log} />
    </View>
  );
}
