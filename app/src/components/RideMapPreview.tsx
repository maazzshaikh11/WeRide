/**
 * RideMapPreview — the route thumbnail at the top of a ride card.
 *
 * Layer 1 (always, offline-safe): an on-device sketch of the PLANNED waypoints —
 * ember line, green start dot, ember destination square, numbered-less stop dots.
 * Layer 2: the real Mapbox static map of the same waypoints, fading in over the
 * sketch once it has loaded; if it fails (offline, no token, bad URL) the sketch
 * simply stays. Both are straight segments between planned points — not the road
 * route — which is why this is a "plan" preview.
 */
import React, { useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { MAPBOX_TOKEN } from '@env';
import { WeRideColors } from '../theme/theme';
import { useReducedMotion } from '../ui';
import { LatLng } from '../utils/mapFit';
import { projectSketch } from '../utils/routeSketch';
import { buildStaticMapUrl } from '../utils/staticMap';

const ROUTE = '#FF4D00';
const START = '#2FD180';
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
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [failed, setFailed] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && Math.abs(w - width) > 8) setWidth(w);
  };

  const sketch = useMemo(() => projectSketch(points, width, height), [points, width, height]);
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
          }),
    [points, width, height, failed, token],
  );

  return (
    <View
      style={[styles.box, { height }]}
      onLayout={onLayout}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Faint street-grid texture so the sketch never sits on a bare black block. */}
      {GRID_X.map((f) => (
        <View key={`gx${f}`} style={[styles.gridV, { left: `${f}%` }]} />
      ))}
      {GRID_Y.map((f) => (
        <View key={`gy${f}`} style={[styles.gridH, { top: `${f}%` }]} />
      ))}
      {sketch?.segs.map((s, i) => (
        <View
          key={`seg-${i}`}
          style={[
            styles.seg,
            {
              left: s.x1,
              top: s.y1 - 2,
              width: s.length,
              transform: [{ translateX: -s.length / 2 }, { rotate: `${s.angle}deg` }, { translateX: s.length / 2 }],
            },
          ]}
        />
      ))}
      {sketch?.dots.map((d, i) => (
        <View
          key={`dot-${i}`}
          style={[
            d.kind === 'start' ? styles.start : d.kind === 'end' ? styles.end : styles.stop,
            { left: d.x - (d.kind === 'end' ? 8 : d.kind === 'start' ? 7 : 5), top: d.y - (d.kind === 'end' ? 8 : d.kind === 'start' ? 7 : 5) },
          ]}
        />
      ))}
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


const styles = StyleSheet.create({
  box: { backgroundColor: WeRideColors.dark, overflow: 'hidden' },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(148,178,208,0.06)' },
  gridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(148,178,208,0.06)' },
  seg: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: ROUTE },
  start: {
    position: 'absolute', width: 14, height: 14, borderRadius: 7,
    backgroundColor: START, borderWidth: 2, borderColor: WeRideColors.dark,
  },
  end: { position: 'absolute', width: 16, height: 16, borderRadius: 4, backgroundColor: ROUTE },
  stop: {
    position: 'absolute', width: 10, height: 10, borderRadius: 5,
    backgroundColor: WeRideColors.dark, borderWidth: 2, borderColor: ROUTE,
  },
});
