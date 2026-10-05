/**
 * MainTabNavigator — 6-tab bottom navigator (spec §2.2).
 * Home / Stops / Voice / Family / Alerts / History.
 *
 * demo.html tab bar: an icon in a 52×32 well over an uppercase 10.5 label.
 * The selected tab's well fills with the accent (cross-fades + a small spring),
 * the label goes from `ink3` to `ink`. Each tab is a PressableScale. Solid
 * background, 1px top rule, height 64 + bottom safe-area inset (the inset is
 * padding, not extra tab height).
 */
import React, { useEffect, useRef } from 'react';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { CommonActions } from '@react-navigation/native';
import { View, Animated, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MapScreen from '../screens/map/MapScreen';
import StopsScreen from '../screens/StopsScreen';
import VoiceScreen from '../screens/VoiceScreen';
import FamilyScreen from '../screens/FamilyScreen';
import AlertsScreen from '../screens/AlertsScreen';
import HistoryScreen from '../screens/HistoryScreen';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import { PressableScale, Motion, useReducedMotion, haptic, Icon, IconName } from '../ui';

export type MainTabParamList = {
  Home: { groupId: string };
  Stops: undefined;
  Voice: undefined;
  Family: undefined;
  Alerts: undefined;
  History: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export const TAB_BAR_HEIGHT = 64;

export const TABS = [
  { name: 'Home', label: 'Home', icon: 'route', component: MapScreen },
  { name: 'Stops', label: 'Stops', icon: 'pin', component: StopsScreen },
  { name: 'Voice', label: 'Voice', icon: 'mic', component: VoiceScreen },
  { name: 'Family', label: 'Family', icon: 'eye', component: FamilyScreen },
  { name: 'Alerts', label: 'Alerts', icon: 'bell', component: AlertsScreen },
  { name: 'History', label: 'History', icon: 'log', component: HistoryScreen },
] as const satisfies readonly { name: string; label: string; icon: IconName; component: React.ComponentType<any> }[];

/** Icon well + label for one tab; selection cross-fades the accent fill. */
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
      <Text style={[type.tab, { color: focused ? colors.ink : colors.ink3 }]} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

export function MainTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const styles = useStyles(({ colors: c }) => ({
    bar: { flexDirection: 'row', backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 8, paddingHorizontal: 6 },
    tab: { flex: 1, minWidth: 44, alignItems: 'center', justifyContent: 'flex-start' },
  }));

  return (
    <View
      testID="main-tab-bar"
      style={[styles.bar, { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom }]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const def = TABS.find((t) => t.name === route.name);
        const label = def?.label ?? route.name;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            haptic('select');
            navigation.dispatch({ ...CommonActions.navigate({ name: route.name, merge: true }), target: state.key });
          }
        };
        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        return (
          <PressableScale
            key={route.key}
            onPress={onPress}
            onLongPress={onLongPress}
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
