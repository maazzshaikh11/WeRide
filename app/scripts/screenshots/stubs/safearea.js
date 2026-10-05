import React from 'react';
import { View } from 'react-native';
export const useSafeAreaInsets = () => ({ top: 0, right: 0, bottom: 0, left: 0 });
export const SafeAreaView = (p) => React.createElement(View, p);
export const SafeAreaProvider = ({ children }) => children;
export const SafeAreaInsetsContext = React.createContext({ top: 0, right: 0, bottom: 0, left: 0 });
