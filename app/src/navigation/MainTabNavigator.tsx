/**
 * MainTabNavigator — 6-tab bottom navigator (spec §2.2).
 * Home / Stops / Voice / Family / Alerts / History.
 *
 * Text-first tab bar: 11px label, active = accent label + 2px accent bar above
 * it, inactive = muted label. Solid background, 1px top border, height
 * 56 + bottom safe-area inset (the inset is padding, not extra tab height).
 */
import React from 'react';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { CommonActions } from '@react-navigation/native';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MapScreen from '../screens/map/MapScreen';
import StopsScreen from '../screens/StopsScreen';
import VoiceScreen from '../screens/VoiceScreen';
import FamilyScreen from '../screens/FamilyScreen';
import AlertsScreen from '../screens/AlertsScreen';
import HistoryScreen from '../screens/HistoryScreen';
import { WeRideColors, WeRideRadius } from '../theme/theme';
import { type } from '../theme/typography';

export type MainTabParamList = {
  Home: { groupId: string };
  Stops: undefined;
  Voice: undefined;
  Family: undefined;
  Alerts: undefined;
  History: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export const TAB_BAR_HEIGHT = 56;

export const TABS = [
  { name: 'Home', label: 'Home', component: MapScreen },
  { name: 'Stops', label: 'Stops', component: StopsScreen },
  { name: 'Voice', label: 'Voice', component: VoiceScreen },
  { name: 'Family', label: 'Family', component: FamilyScreen },
  { name: 'Alerts', label: 'Alerts', component: AlertsScreen },
  { name: 'History', label: 'History', component: HistoryScreen },
] as const;

export function MainTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label = TABS.find((t) => t.name === route.name)?.label ?? route.name;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.dispatch({ ...CommonActions.navigate({ name: route.name, merge: true }), target: state.key });
          }
        };
        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityRole="tab"
            accessibilityLabel={options.tabBarAccessibilityLabel ?? `${label} tab`}
            accessibilityState={{ selected: focused }}
            style={styles.tab}
          >
            <View style={[styles.indicator, focused && styles.indicatorActive]} />
            <Text
              style={[focused ? type.labelStrong : type.label, styles.label, { color: focused ? WeRideColors.primary : WeRideColors.textSub }]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <MainTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {TABS.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{ tabBarAccessibilityLabel: `${tab.label} tab` }}
        />
      ))}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: WeRideColors.dark,
    borderTopWidth: 1,
    borderTopColor: WeRideColors.border,
  },
  tab: {
    flex: 1,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  indicator: {
    width: 24,
    height: 2,
    borderRadius: WeRideRadius.sm,
    backgroundColor: 'transparent',
  },
  indicatorActive: { backgroundColor: WeRideColors.primary },
  label: { letterSpacing: 0 },
});
