import React from 'react';
import { View } from 'react-native';
// Browser stand-in for Mapbox: no tiles, so the map is a flat placeholder (dark or light by styleURL) with a faint
// grid. Shapes (route line, hazards, rider circles) and markers are drawn from their coordinates, relative to
// globalThis.__MAP__ = { lat, lng, mpp } (centre of the screen's map area and metres per pixel; default zoom ~16).
const Ctx = React.createContext({ dark: true });
const SrcCtx = React.createContext(null);
const centre = () => globalThis.__MAP__ || { lat: 19.0, lng: 72.9, mpp: 2.3 };
const proj = ([lng, lat]) => {
  const c = centre();
  const mx = (lng - c.lng) * 111320 * Math.cos((c.lat * Math.PI) / 180);
  const my = (lat - c.lat) * 110574;
  const x = mx / c.mpp, y = -my / c.mpp, t = ((c.heading || 0) * Math.PI) / 180;
  return { x: x * Math.cos(t) + y * Math.sin(t), y: -x * Math.sin(t) + y * Math.cos(t) };
};
const feats = (shape) => {
  if (!shape) return [];
  if (shape.type === 'FeatureCollection') return shape.features || [];
  if (shape.type === 'Feature') return [shape];
  return [{ type: 'Feature', geometry: shape, properties: {} }];
};
const MapView = ({ style, children, styleURL }) => {
  const dark = styleURL !== 'light';
  const grid = { position: 'absolute', backgroundColor: dark ? 'rgba(148,178,208,0.05)' : 'rgba(20,20,20,0.06)' };
  return React.createElement(Ctx.Provider, { value: { dark } },
    React.createElement(View, { dataSet: { map: '1' }, style: [style, { backgroundColor: dark ? '#0b0f14' : '#E6E2D6', overflow: 'hidden' }] },
      [14, 30, 47, 63, 80].map((x) => React.createElement(View, { key: 'v' + x, style: [grid, { left: x + '%', top: 0, bottom: 0, width: 1 }] })),
      [18, 38, 58, 78].map((y) => React.createElement(View, { key: 'h' + y, style: [grid, { top: y + '%', left: 0, right: 0, height: 1 }] })),
      React.createElement('div', { style: { position: 'absolute', left: '50%', top: '42%', width: 0, height: 0 } }, children)));
};
const Null = () => null;
const ShapeSource = ({ shape, children }) => React.createElement(SrcCtx.Provider, { value: shape }, children);
// minimal evaluator for the style expressions the app uses: numbers, ['interpolate',['linear'],['zoom'],z,v,...] at zoom 16
const num = (v, f) => {
  if (typeof v === 'number') return v;
  if (Array.isArray(v) && v[0] === 'interpolate') { let best = f; for (let i = 3; i + 1 < v.length; i += 2) { if (v[i] <= 16) best = v[i + 1]; } return best; }
  return f;
};
const str = (v, f) => (typeof v === 'string' ? v : f);
const LineLayer = ({ style = {}, id }) => {
  const shape = React.useContext(SrcCtx);
  const out = [];
  feats(shape).forEach((f, i) => {
    const g = f.geometry;
    if (!g || (g.type !== 'LineString' && g.type !== 'MultiLineString')) return;
    const lines = g.type === 'LineString' ? [g.coordinates] : g.coordinates;
    lines.forEach((l, j) => out.push(React.createElement('polyline', { key: `${i}-${j}`, fill: 'none', stroke: str(style.lineColor, '#FFC20E'), strokeWidth: num(style.lineWidth, 5), strokeLinecap: 'round', strokeLinejoin: 'round', points: l.map((c) => { const p = proj(c); return `${p.x},${p.y}`; }).join(' ') })));
  });
  return React.createElement('svg', { style: { position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }, width: 1, height: 1 }, out);
};
const CircleLayer = ({ style = {} }) => {
  const shape = React.useContext(SrcCtx);
  const out = [];
  feats(shape).forEach((f, i) => {
    const g = f.geometry;
    if (!g || g.type !== 'Point') return;
    const p = proj(g.coordinates);
    const col = Array.isArray(style.circleColor) ? (f.properties && f.properties.markerColor) || '#888' : str(style.circleColor, '#888');
    const r = num(style.circleRadius, 12);
    out.push(React.createElement('circle', { key: i, cx: p.x, cy: p.y, r, fill: col, stroke: str(style.circleStrokeColor, 'none'), strokeWidth: typeof style.circleStrokeWidth === 'number' ? style.circleStrokeWidth : 0 }));
  });
  return React.createElement('svg', { style: { position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }, width: 1, height: 1 }, out);
};
const SymbolLayer = ({ style = {} }) => {
  const shape = React.useContext(SrcCtx);
  const out = [];
  feats(shape).forEach((f, i) => {
    const g = f.geometry;
    if (!g || g.type !== 'Point') return;
    const p = proj(g.coordinates);
    const pr = f.properties || {};
    if (style.iconImage) {
      out.push(React.createElement('g', { key: 'i' + i, transform: `translate(${p.x},${p.y})` },
        React.createElement('circle', { r: 13, fill: '#FFC20E', stroke: '#111', strokeWidth: 2 }),
        React.createElement('text', { y: 5, textAnchor: 'middle', fontSize: 15, fontWeight: 800, fill: '#111' }, '!')));
    } else if (style.textField) {
      const t = Array.isArray(style.textField) ? pr[style.textField[1]] : style.textField;
      if (t == null) return;
      out.push(React.createElement('text', { key: 't' + i, x: p.x, y: p.y + 4, textAnchor: 'middle', fontSize: num(style.textSize, 11), fontWeight: 800, fill: Array.isArray(style.textColor) ? pr[style.textColor[1]] || '#111' : str(style.textColor, '#111') }, String(t)));
    }
  });
  return React.createElement('svg', { style: { position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }, width: 1, height: 1 }, out);
};
const MarkerView = ({ children, coordinate, anchor }) => {
  const p = coordinate ? proj(coordinate) : { x: 0, y: 0 };
  const a = anchor || { x: 0.5, y: 0.5 };
  return React.createElement('div', { style: { position: 'absolute', left: p.x, top: p.y, transform: `translate(${-a.x * 100}%, ${-a.y * 100}%)` } }, children);
};
const M = { MapView, Camera: Null, UserLocation: Null, ShapeSource, LineLayer, CircleLayer, FillLayer: Null, SymbolLayer, MarkerView, PointAnnotation: MarkerView,
  UserTrackingMode: { Follow: 'normal', FollowWithHeading: 'compass', FollowWithCourse: 'course' }, StyleURL: { Dark: 'dark', Light: 'light' }, setAccessToken: () => {} };
export default M;
export const { UserTrackingMode, StyleURL, setAccessToken } = M;
