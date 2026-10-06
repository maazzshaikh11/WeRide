import React from 'react';
// Browser stand-in for react-native-svg: its props are SVG attributes, so plain DOM <svg> elements do.
const strip = ({ testID, accessibilityElementsHidden, importantForAccessibility, accessibilityLabel, accessibilityRole, accessible, pointerEvents, onPress, onLayout, ...rest }) =>
  ({ ...rest, ...(onPress ? { onClick: onPress } : {}), ...(accessibilityLabel ? { 'aria-label': accessibilityLabel } : {}) });
const el = (tag) => (props) => React.createElement(tag, strip(props));
const Svg = ({ style, children, ...p }) => React.createElement('svg', { ...strip(p), style: { ...(Array.isArray(style) ? Object.assign({}, ...style.flat(9).filter(Boolean)) : style) } }, children);
export default Svg;
export const Path = el('path'), Circle = el('circle'), Ellipse = el('ellipse'), Rect = el('rect'), Line = el('line'),
  Polyline = el('polyline'), Polygon = el('polygon'), G = el('g'), Defs = el('defs'), ClipPath = el('clipPath'), Mask = el('mask'),
  Pattern = el('pattern'), Use = el('use'), Image = el('image'), Symbol = el('symbol'),
  LinearGradient = el('linearGradient'), RadialGradient = el('radialGradient'), Stop = el('stop'),
  Text = el('text'), TSpan = el('tspan'), TextPath = el('textPath');
export const Svg_ = Svg;
