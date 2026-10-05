/**
 * RideMapPreview — the route thumbnail at the top of a ride card.
 *
 * Layer 1 (always, offline-safe): an on-device sketch of the PLANNED waypoints —
 * accent line with a dark casing, start dot, destination square (demo ride pass),
 * stop dots. Colours come from the active theme.
 * Layer 2: the real Mapbox static map of the same waypoints, fading in over the
 * sketch once it has loaded; if it fails (offline, no token, bad URL) the sketch
 * simply stays. Both are straight segments between planned points — not the road
 * route — which is why this is a "plan" preview.
 */
import React, { useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { MAPBOX_TOKEN } from '@env';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from '../ui';
import { LatLng } from '../utils/mapFit';
import { projectSketch } from '../utils/routeSketch';
import { buildStaticMapUrl } from '../utils/staticMap';

const OUTLINE = '#14140F'; // demo: the route casing is near-black on every map
const DEFAULT_WIDTH = 335;
const GRID_X = [18, 41, 63, 86];
const GRID_Y = [30, 62];

interface Props {
  points: LatLng[];
  height?: number;
  /** Mapbox public token; defaults to the app's MAPBOX_TOKEN (overridable for tests). */
  token?: string | null;
}

export default function RideMapPreview({ points, height = 150, token = MAPBOX_TOKEN }: Props) {
  const { colors, scheme } = useTheme();
  const styles = useStyles(({ colors: c }) => ({
    box: { backgroundColor: c.bg2, overflow: 'hidden' },
    gridV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: c.line },
    gridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: c.line },
    casing: { position: 'absolute', height: 9, borderRadius: 4.5, backgroundColor: OUTLINE },
    seg: { position: 'absolute', height: 5, borderRadius: 2.5, backgroundColor: c.pri },
    start: {
      position: 'absolute', width: 16, height: 16, borderRadius: 8,
      backgroundColor: c.pri, borderWidth: 3, borderColor: OUTLINE,
    },
    end: {
      position: 'absolute', width: 18, height: 18, borderRadius: 4,
      backgroundColor: c.pri, borderWidth: 3, borderColor: OUTLINE,
    },
    stop: {
      position: 'absolute', width: 12, height: 12, borderRadius: 6,
      backgroundColor: c.card, borderWidth: 3, borderColor: OUTLINE,
    },
  }));
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [failed, setFailed] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && Math.abs(w - width) > 8) setWidth(w);
  };

  const sketch = useMemo(() => projectSketch(points, width, height), [points, width, height]);
  const hex = (c: string) => c.replace('#', '');
  // Round the request size so tiny layout changes don't refetch the image.
  const url = useMemo(
    () =>
      failed
        ? null
        : buildStaticMapUrl({
            points,
            width: Math.ceil(width / 10) * 10,
            height,
            token,
            style: scheme === 'light' ? 'light-v11' : 'dark-v11',
            routeHex: hex(colors.pri),
            startHex: hex(colors.ok),
            outlineHex: hex(OUTLINE),
          }),
    [points, width, height, failed, token, scheme, colors.pri, colors.ok],
  );

  const place = (s: { x1: number; y1: number; length: number; angle: number }, h: number) => ({
    left: s.x1,
    top: s.y1 - h / 2,
    width: s.length,
    transform: [{ translateX: -s.length / 2 }, { rotate: `${s.angle}deg` }, { translateX: s.length / 2 }],
  });

  return (
    <View
      style={[styles.box, { height }]}
      onLayout={onLayout}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Faint street-grid texture so the sketch never sits on a bare block. */}
      {GRID_X.map((f) => (
        <View key={`gx${f}`} style={[styles.gridV, { left: `${f}%` }]} />
      ))}
      {GRID_Y.map((f) => (
        <View key={`gy${f}`} style={[styles.gridH, { top: `${f}%` }]} />
      ))}
      {sketch?.segs.map((s, i) => (
        <View key={`cs-${i}`} style={[styles.casing, place(s, 9)]} />
      ))}
      {sketch?.segs.map((s, i) => (
        <View key={`seg-${i}`} style={[styles.seg, place(s, 5)]} />
      ))}
      {sketch?.dots.map((d, i) => {
        const r = d.kind === 'end' ? 9 : d.kind === 'start' ? 8 : 6;
        return (
          <View
            key={`dot-${i}`}
            style={[
              d.kind === 'start' ? styles.start : d.kind === 'end' ? styles.end : styles.stop,
              { left: d.x - r, top: d.y - r },
            ]}
          />
        );
      })}
      {url ? (
        <Animated.Image
          source={{ uri: url }}
          style={[StyleSheet.absoluteFill, { opacity: fade }]}
          resizeMode="cover"
          onLoad={() => {
            if (reduced) fade.setValue(1);
            else Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }).start();
          }}
          onError={() => setFailed(true)}
        />
      ) : null}
    </View>
  );
}
