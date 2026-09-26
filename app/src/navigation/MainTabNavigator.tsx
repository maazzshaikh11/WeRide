/**
 * MainTabNavigator — 6-tab bottom navigator (spec §2.2).
 * Home / Stops / Voice / Family / Alerts / History.
 * Tab bar: dark #0d0d0dee, orange active, grey inactive, Space Mono 9px labels.
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MapScreen from '../screens/map/MapScreen';
import StopsScreen from '../screens/StopsScreen';
import VoiceScreen from '../screens/VoiceScreen';
import FamilyScreen from '../screens/FamilyScreen';
import AlertsScreen from '../screens/AlertsScreen';
import HistoryScreen from '../screens/HistoryScreen';
import { WeRideColors, WeRideFonts } from '../theme/theme';

export type MainTabParamList = {
  Home: { groupId: string };
  Stops: undefined;
  Voice: undefined;
  Family: undefined;
  Alerts: undefined;
  History: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const TABS = [
  { name: 'Home', label: 'HOME', icon: '🏠', component: MapScreen },
  { name: 'Stops', label: 'STOPS', icon: '📍', component: StopsScreen },
  { name: 'Voice', label: 'VOICE', icon: '🎙️', component: VoiceScreen },
  { name: 'Family', label: 'FAMILY', icon: '👪', component: FamilyScreen },
  { name: 'Alerts', label: 'ALERTS', icon: '⚠️', component: AlertsScreen },
  { name: 'History', label: 'HISTORY', icon: '🏆', component: HistoryScreen },
] as const;

export default function MainTabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: '#0d0d0dee',
          borderTopWidth: 1,
          borderTopColor: WeRideColors.border,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom / 2,
        },
        tabBarActiveTintColor: WeRideColors.primary,
        tabBarInactiveTintColor: WeRideColors.textSub,
        tabBarLabel: ({ color }) => {
          const tab = TABS.find((t) => t.name === route.name);
          return (
            <Text style={[styles.label, { color }]}>{tab?.label ?? route.name}</Text>
          );
        },
        tabBarIcon: ({ color, focused }) => {
          const tab = TABS.find((t) => t.name === route.name);
          return (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Text style={styles.icon}>{tab?.icon ?? ''}</Text>
            </View>
          );
        },
      })}
    >
      {TABS.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
        />
      ))}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: 'center', paddingTop: 6 },
  iconWrapActive: { transform: [{ translateY: -2 }] },
  icon: { fontSize: 18 },
  label: { fontFamily: WeRideFonts.mono, fontSize: 9, fontWeight: '700' },
});