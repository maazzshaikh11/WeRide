/**
 * GarageTabs — the four Garage tabs (Ride ∙ Crews ∙ Log ∙ Me) with the custom tab bar (GarageTabBar.tsx).
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import RideHomeScreen from '../screens/garage/RideHomeScreen';
import CrewsScreen from '../screens/garage/CrewsScreen';
import LogScreen from '../screens/garage/LogScreen';
import MeScreen from '../screens/garage/MeScreen';
import { GARAGE_TAB_META, GarageTabBar } from './GarageTabBar';
import type { GarageTabParamList } from './types';

export { GarageTabBar, TAB_BAR_HEIGHT } from './GarageTabBar';

const Tab = createBottomTabNavigator<GarageTabParamList>();

const COMPONENTS: Record<keyof GarageTabParamList, React.ComponentType<any>> = { Ride: RideHomeScreen, Crews: CrewsScreen, Log: LogScreen, Me: MeScreen };

export const GARAGE_TABS = GARAGE_TAB_META.map((m) => ({ ...m, component: COMPONENTS[m.name] }));

export default function GarageTabs() {
  return (
    <Tab.Navigator tabBar={(props) => <GarageTabBar {...props} />} screenOptions={{ headerShown: false }}>
      {GARAGE_TABS.map((tab) => (
        <Tab.Screen key={tab.name} name={tab.name} component={tab.component as React.ComponentType<any>} options={{ tabBarAccessibilityLabel: `${tab.label} tab` }} />
      ))}
    </Tab.Navigator>
  );
}
