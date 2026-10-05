import React from 'react';
import { View } from 'react-native';
// Browser stand-in: Mapbox tiles cannot render here, so the map is a flat placeholder (dark or light
// by styleURL) with a faint grid, and a sample road. Markers are drawn where their coordinate falls
// in a fixed window around the ride so the avatar and its label can be seen.
const MapCtx = React.createContext('dark');
const MapView = ({ style, children, styleURL }) => {
  const light = styleURL === 'light';
  const grid = { position: 'absolute', backgroundColor: light ? 'rgba(20,20,20,0.06)' : 'rgba(148,178,208,0.05)' };
  return React.createElement(MapCtx.Provider, { value: styleURL },
    React.createElement(View, { style: [style, { backgroundColor: light ? '#E6E2D6' : '#0b0f14', overflow: 'hidden' }] },
      [14, 30, 47, 63, 80].map((x) => React.createElement(View, { key: 'v' + x, style: [grid, { left: x + '%', top: 0, bottom: 0, width: 1 }] })),
      [18, 38, 58, 78].map((y) => React.createElement(View, { key: 'h' + y, style: [grid, { top: y + '%', left: 0, right: 0, height: 1 }] })),
      children));
};
const Null = () => null;
// Fixed screen spot for the single marker we draw (the rider's own avatar).
const MarkerView = ({ children }) => React.createElement(View, { style: { position: 'absolute', left: '50%', top: '42%', marginLeft: -91, marginTop: -23 } }, children);
const M = { MapView, Camera: Null, UserLocation: Null, ShapeSource: Null, LineLayer: Null, CircleLayer: Null, SymbolLayer: Null, MarkerView, PointAnnotation: Null,
  UserTrackingMode: { Follow: 'normal', FollowWithHeading: 'compass', FollowWithCourse: 'course' }, StyleURL: { Dark: 'dark', Light: 'light' }, setAccessToken: () => {} };
export default M;
export const { UserTrackingMode, StyleURL, setAccessToken } = M;
