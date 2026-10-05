import React from 'react';
// Browser stand-in for react-native-svg: its props are SVG attributes, so plain DOM <svg> elements do.
const strip = ({ testID, accessibilityElementsHidden, importantForAccessibility, accessibilityLabel, ...rest }) => rest;
const el = (tag) => (props) => React.createElement(tag, strip(props));
const Svg = ({ style, ...p }) => React.createElement('svg', { ...strip(p), style });
export default Svg;
export const Path = el('path'), Circle = el('circle'), Ellipse = el('ellipse'), Rect = el('rect'), Line = el('line'),
  Defs = el('defs'), LinearGradient = el('linearGradient'), Stop = el('stop');
