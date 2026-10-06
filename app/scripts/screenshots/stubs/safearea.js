import React from 'react';
import { View } from 'react-native';
// Insets of a notched iPhone (what the demo renders), unless a scene overrides globalThis.__INSETS__.
const ins = () => globalThis.__INSETS__ || { top: 47, right: 0, bottom: 34, left: 0 };
export const useSafeAreaInsets = () => ins();
export const SafeAreaView = (p) => React.createElement(View, p);
export const SafeAreaProvider = ({ children }) => children;
export const SafeAreaInsetsContext = React.createContext(ins());
export const initialWindowMetrics = { insets: ins(), frame: { x: 0, y: 0, width: 390, height: 844 } };
