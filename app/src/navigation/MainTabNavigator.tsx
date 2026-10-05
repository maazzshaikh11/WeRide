/**
 * MainTabNavigator — 6-tab bottom navigator (spec §2.2).
 * Home / Stops / Voice / Family / Alerts / History.
 *
 * Text-first tab bar: 11px label, active = accent label + a 2px accent bar
 * above it that slides between tabs (one indicator, native-driver translateX),
 * inactive = muted label. Each tab is a PressableScale. Solid background, 1px top border, height
 * 56 + bottom safe-area inset (the inset is padding, not extra tab height).
 */
import React, { useEffect, useRef, useState } from 'react';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { CommonActions } from '@react-navigation/native';
import { View, Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MapScreen from '../screens/map/MapScreen';
import StopsScreen from '../screens/StopsScreen';
import VoiceScreen from '../screens/VoiceScreen';
import FamilyScreen from '../screens/FamilyScreen';
import AlertsScreen from '../screens/AlertsScreen';
import HistoryScreen from '../screens/HistoryScreen';
import { WeRideColors, WeRideRadius } from '../theme/theme';
import { type } from '../theme/typography';
import { PressableScale, Motion, useReducedMotion, haptic } from '../ui';

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

/** Horizontal offset of the sliding indicator for the tab at `index`. */
export function indicatorOffset(index: number, tabWidth: number): number {
  return index * tabWidth;
}

/**
 * The single accent bar that slides under the selected tab. Position is a
 * native-driver translateX (never animated on the JS thread); until the bar
 * has been measured it stays hidden so it never flashes at the wrong spot.
 */
export function TabIndicator({ index, tabWidth }: { index: number; tabWidth: number }) {
  const x = useRef(new Animated.Value(indicatorOffset(index, tabWidth))).current;
  const measured = useRef(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const target = indicatorOffset(index, tabWidth);
    if (tabWidth <= 0) return;
    if (!measured.current || reduced) {
      // First measurement (or reduced motion): jump, don't slide in from 0.
      measured.current = true;
      x.setValue(target);
      return;
    }
    const anim = Animated.spring(x, { toValue: target, friction: 9, tension: 170, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [index, tabWidth, reduced, x]);

  return (
    <Animated.View
      pointerEvents="none"
      testID="tab-indicator"
      style={[
        styles.indicatorTrack,
        { width: tabWidth, opacity: tabWidth > 0 ? 1 : 0, transform: [{ translateX: x }] },
      ]}
    >
      <View style={styles.indicator} />
    </Animated.View>
  );
}

/** Label whose colour cross-fades (opacity overlay, native driver) with selection. */
function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  const t = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const anim = Animated.timing(t, { toValue: focused ? 1 : 0, duration: Motion.focus.durationMs, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [focused, t]);

  return (
    // Fills the tab slot so the (wider) bold active label is never clipped.
    <View style={styles.labelWrap}>
      <Animated.Text
        style={[type.label, styles.label, { color: WeRideColors.textSub, opacity: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
        numberOfLines={1}
      >
        {label}
      </Animated.Text>
      <Animated.Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[type.labelStrong, styles.label, styles.labelActive, { color: WeRideColors.primary, opacity: t }]}
        numberOfLines={1}
      >
        {label}
      </Animated.Text>
    </View>
  );
}

export function MainTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);
  const tabWidth = state.routes.length > 0 ? barWidth / state.routes.length : 0;

  return (
    <View
      testID="main-tab-bar"
      style={[styles.bar, { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom }]}
      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label = TABS.find((t) => t.name === route.name)?.label ?? route.name;

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
            {/* Keeps the indicator's slot so label position is unchanged. */}
            <View style={styles.indicatorSlot} />
            <TabLabel label={label} focused={focused} />
          </PressableScale>
        );
      })}
      <TabIndicator index={state.index} tabWidth={tabWidth} />
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
  indicatorSlot: { height: 2 },
  indicatorTrack: {
    position: 'absolute',
    top: (TAB_BAR_HEIGHT - 22) / 2,
    left: 0,
    alignItems: 'center',
  },
  indicator: {
    width: 24,
    height: 2,
    borderRadius: WeRideRadius.sm,
    backgroundColor: WeRideColors.primary,
  },
  labelWrap: { alignSelf: 'stretch' },
  labelActive: { position: 'absolute', left: 0, right: 0, textAlign: 'center' },
  label: { letterSpacing: 0, textAlign: 'center' },
});
