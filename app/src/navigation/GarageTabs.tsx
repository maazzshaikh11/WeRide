/**
 * GarageTabs — the demo's four-tab bar (Ride · Crews · Log · Me), shown on the Garage screens only.
 * Icon in a 52×32 well over an uppercase label; the selected well fills with the accent.
 */
import React, { useEffect, useRef } from 'react';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { CommonActions } from '@react-navigation/native';
import { View, Animated, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import RideHomeScreen from '../screens/garage/RideHomeScreen';
import CrewsScreen from '../screens/garage/CrewsScreen';
import LogScreen from '../screens/garage/LogScreen';
import MeScreen from '../screens/garage/MeScreen';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import { PressableScale, Motion, useReducedMotion, haptic, Icon, IconName } from '../ui';
import type { GarageTabParamList } from './types';

const Tab = createBottomTabNavigator<GarageTabParamList>();

export const TAB_BAR_HEIGHT = 64;

export const GARAGE_TABS = [
  { name: 'Ride', label: 'Ride', icon: 'route', component: RideHomeScreen },
  { name: 'Crews', label: 'Crews', icon: 'crews', component: CrewsScreen },
  { name: 'Log', label: 'Log', icon: 'log', component: LogScreen },
  { name: 'Me', label: 'Me', icon: 'me', component: MeScreen },
] as const satisfies readonly { name: keyof GarageTabParamList; label: string; icon: IconName; component: React.ComponentType<any> }[];

function TabItem({ label, icon, focused }: { label: string; icon: IconName; focused: boolean }) {
  const { colors, type } = useTheme();
  const styles = useStyles(({ colors: c }) => ({
    wrap: { alignItems: 'center', gap: 3 },
    well: { width: 52, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 12, backgroundColor: c.pri },
  }));
  const t = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const first = useRef(true);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) {
      t.setValue(focused ? 1 : 0);
      return;
    }
    const anim = Animated.spring(t, { toValue: focused ? 1 : 0, ...Motion.spring, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [focused, reduced, t]);
  return (
    <View style={styles.wrap}>
      <View style={styles.well}>
        <Animated.View
          testID={focused ? 'tab-active-well' : undefined}
          style={[styles.fill, { opacity: t, transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}
        />
        <Icon name={icon} size={22} color={focused ? colors.priInk : colors.ink3} />
      </View>
      <Text style={[type.tab, { color: focused ? colors.ink : colors.ink3 }]} numberOfLines={1}>{label.toUpperCase()}</Text>
    </View>
  );
}

export function GarageTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const styles = useStyles(({ colors: c }) => ({
    bar: { flexDirection: 'row', backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 8, paddingHorizontal: 14, gap: 6 },
    tab: { flex: 1, minWidth: 44, alignItems: 'center', justifyContent: 'flex-start' },
  }));
  return (
    <View testID="garage-tab-bar" style={[styles.bar, { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const def = GARAGE_TABS.find((t) => t.name === route.name);
        const label = def?.label ?? route.name;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            haptic('select');
            navigation.dispatch({ ...CommonActions.navigate({ name: route.name, merge: true }), target: state.key });
          }
        };
        return (
          <PressableScale
            key={route.key}
            onPress={onPress}
            haptic={false}
            scaleTo={0.92}
            accessibilityRole="tab"
            accessibilityLabel={options.tabBarAccessibilityLabel ?? `${label} tab`}
            accessibilityState={{ selected: focused }}
            style={styles.tab}
          >
            <TabItem label={label} icon={def?.icon ?? 'route'} focused={focused} />
          </PressableScale>
        );
      })}
    </View>
  );
}

export default function GarageTabs() {
  return (
    <Tab.Navigator tabBar={(props) => <GarageTabBar {...props} />} screenOptions={{ headerShown: false }}>
      {GARAGE_TABS.map((tab) => (
        <Tab.Screen key={tab.name} name={tab.name} component={tab.component as React.ComponentType<any>} options={{ tabBarAccessibilityLabel: `${tab.label} tab` }} />
      ))}
    </Tab.Navigator>
  );
}
