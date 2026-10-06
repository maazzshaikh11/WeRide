import React from 'react';
import { View } from 'react-native';
// Insets of a notched iPhone (what the demo renders), unless a scene overrides globalThis.__INSETS__.
const QS = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const FROM_URL = QS.has('top') || QS.has('bottom') ? { top: Number(QS.get('top') || 0), right: Number(QS.get('right') || 0), bottom: Number(QS.get('bottom') || 0), left: Number(QS.get('left') || 0) } : null;
const ins = () => FROM_URL || globalThis.__INSETS__ || { top: 47, right: 0, bottom: 34, left: 0 };
export const useSafeAreaInsets = () => ins();
export const SafeAreaView = (p) => React.createElement(View, p);
export const SafeAreaProvider = ({ children }) => children;
export const SafeAreaInsetsContext = React.createContext(ins());
export const initialWindowMetrics = { insets: ins(), frame: { x: 0, y: 0, width: Number(QS.get('w')) || 390, height: Number(QS.get('h')) || 844 } };
