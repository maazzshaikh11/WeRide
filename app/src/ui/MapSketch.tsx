/**
 * MapSketch — an on-device drawing of a route or a recorded track (no map tiles needed): paper background,
 * faint grid, a dark casing under an accent line, start dot and destination square (demo `thumb`).
 * `progress` (0..1) draws the part already ridden in `ink` and puts a marker at that point (the replay).
 * `markers` are extra labelled points (hazards, riders), drawn as the demo's diamonds / dots.
 */
import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { LatLng, isUsableCoord } from '../utils/mapFit';

export interface SketchMarker {
  lat: number;
  lng: number;
  kind: 'hazard' | 'rider' | 'stop';
  color?: string;
  label?: string;
}

/** flat [lat,lng,lat,lng,…] → points */
export function pointsFromFlat(flat: number[]): LatLng[] {
  const out: LatLng[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push({ lat: flat[i], lng: flat[i + 1] });
  return out;
}

const OUTLINE = '#14140F';

export function MapSketch({ points, height = 150, pad = 28, progress, markers, style, testID }: {
  points: LatLng[]; height?: number; pad?: number; progress?: number; markers?: SketchMarker[]; style?: StyleProp<ViewStyle>; testID?: string;
}) {
  const { colors } = useTheme();
  const [w, setW] = useState(335);
  const onLayout = (e: LayoutChangeEvent) => {
    const nw = Math.round(e.nativeEvent.layout.width);
    if (nw > 0 && Math.abs(nw - w) > 2) setW(nw);
  };
  const geo = useMemo(() => {
    const all = [...points, ...(markers ?? [])].filter((p) => isUsableCoord(p.lat, p.lng));
    if (all.length === 0) return null;
    const midLat = all.reduce((s, p) => s + p.lat, 0) / all.length;
    const kx = Math.cos((midLat * Math.PI) / 180);
    const xs = all.map((p) => p.lng * kx);
    const ys = all.map((p) => -p.lat);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = maxX - minX, spanY = maxY - minY;
    const availW = Math.max(1, w - pad * 2), availH = Math.max(1, height - pad * 2);
    const scale = spanX === 0 && spanY === 0 ? 0 : Math.min(spanX ? availW / spanX : Infinity, spanY ? availH / spanY : Infinity);
    const offX = (w - spanX * scale) / 2, offY = (height - spanY * scale) / 2;
    const proj = (p: LatLng) => ({ x: offX + (p.lng * kx - minX) * scale, y: offY + (-p.lat - minY) * scale });
    return { proj };
  }, [points, markers, w, height, pad]);

  const line = useMemo(() => {
    if (!geo) return { all: '', done: '', xy: [] as { x: number; y: number }[] };
    const xy = points.filter((p) => isUsableCoord(p.lat, p.lng)).map(geo.proj);
    const d = (arr: { x: number; y: number }[]) => arr.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
    let done = '';
    if (progress != null && xy.length > 1) {
      const n = Math.max(1, Math.round(progress * (xy.length - 1)));
      done = d(xy.slice(0, n + 1));
    }
    return { all: d(xy), done, xy };
  }, [geo, points, progress]);

  const head = progress != null && line.xy.length > 0 ? line.xy[Math.min(line.xy.length - 1, Math.round(progress * (line.xy.length - 1)))] : null;
  const start = line.xy[0];
  const end = line.xy[line.xy.length - 1];

  return (
    <View onLayout={onLayout} style={[{ height, backgroundColor: colors.bg2, overflow: 'hidden' }, style]} testID={testID} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={w} height={height}>
        {[0.18, 0.41, 0.63, 0.86].map((f) => <Line key={`v${f}`} x1={w * f} y1={0} x2={w * f} y2={height} stroke={colors.line} strokeWidth={1} />)}
        {[0.3, 0.62].map((f) => <Line key={`h${f}`} x1={0} y1={height * f} x2={w} y2={height * f} stroke={colors.line} strokeWidth={1} />)}
        {line.all ? <Path d={line.all} stroke={OUTLINE} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
        {line.all ? <Path d={line.all} stroke={colors.pri} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
        {line.done ? <Path d={line.done} stroke={colors.ink} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
        {geo && markers?.map((m, i) => {
          if (!isUsableCoord(m.lat, m.lng)) return null;
          const p = geo.proj(m);
          return m.kind === 'hazard' ? (
            <Rect key={i} x={p.x - 8} y={p.y - 8} width={16} height={16} rx={3} fill="#FFC20E" stroke={OUTLINE} strokeWidth={2.5} transform={`rotate(45 ${p.x} ${p.y})`} />
          ) : (
            <Circle key={i} cx={p.x} cy={p.y} r={m.kind === 'stop' ? 6 : 9} fill={m.color ?? colors.pri} stroke={OUTLINE} strokeWidth={m.kind === 'stop' ? 2.5 : 3} />
          );
        })}
        {start ? <Circle cx={start.x} cy={start.y} r={8} fill={colors.pri} stroke={OUTLINE} strokeWidth={3} /> : null}
        {end && line.xy.length > 1 ? <Rect x={end.x - 9} y={end.y - 9} width={18} height={18} rx={4} fill={colors.pri} stroke={OUTLINE} strokeWidth={3} /> : null}
        {head ? <Circle cx={head.x} cy={head.y} r={10} fill={colors.pri} stroke={OUTLINE} strokeWidth={3.5} /> : null}
      </Svg>
    </View>
  );
}
