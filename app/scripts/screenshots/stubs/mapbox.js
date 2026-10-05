import React from 'react';
import { View } from 'react-native';
// Browser stand-in: Mapbox tiles cannot render here, so the map is a dark placeholder with a faint grid.
const grid = { position: 'absolute', backgroundColor: 'rgba(148,178,208,0.05)' };
const MapView = ({ style, children }) => React.createElement(View, { style: [style, { backgroundColor: '#0b0f14', overflow: 'hidden' }] },
  [14, 30, 47, 63, 80].map((x) => React.createElement(View, { key: 'v' + x, style: [grid, { left: x + '%', top: 0, bottom: 0, width: 1 }] })),
  [18, 38, 58, 78].map((y) => React.createElement(View, { key: 'h' + y, style: [grid, { top: y + '%', left: 0, right: 0, height: 1 }] })),
  children);
const Null = () => null;
const M = { MapView, Camera: Null, UserLocation: Null, ShapeSource: Null, LineLayer: Null, CircleLayer: Null, SymbolLayer: Null, MarkerView: Null, PointAnnotation: Null,
  UserTrackingMode: { Follow: 'normal', FollowWithHeading: 'compass', FollowWithCourse: 'course' }, StyleURL: { Dark: 'dark' }, setAccessToken: () => {} };
export default M;
export const { UserTrackingMode, StyleURL, setAccessToken } = M;
