/**
 * GarageTabBar — the demo's four-tab bar (Ride ∙ Crews ∙ Log ∙ Me), shown on the Garage screens only.
 * Icon in a 52×32 well over an uppercase label; the selected well fills with the accent. The bar spans the screen
 * and its tabs sit in a centred column of at most 560 pt on tablets. Kept apart from GarageTabs so it can be rendered
 * (screenshot harness, tests) without importing the four screens.
 */
import React, { useEffect, useRef } from 'react';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { CommonActions } from '@react-navigation/native';
import { View, Animated, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GARAGE_COLUMN } from '../theme/responsive';
import { CAP } from '../theme/textPolicy';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import { PressableScale, Motion, useReducedMotion, haptic, Icon, IconName } from '../ui';
import type { GarageTabParamList } from './types';

export const TAB_BAR_HEIGHT = 64;

/** Label + icon of each tab (the screens themselves are wired in GarageTabs). */
export const GARAGE_TAB_META = [
  { name: 'Ride', label: 'Ride', icon: 'route' },
  { name: 'Crews', label: 'Crews', icon: 'crews' },
  { name: 'Log', label: 'Log', icon: 'log' },
  { name: 'Me', label: 'Me', icon: 'me' },
] as const satisfies readonly { name: keyof GarageTabParamList; label: string; icon: IconName }[];

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
      <Text style={[type.tab, { color: focused ? colors.ink : colors.ink3 }]} numberOfLines={1} maxFontSizeMultiplier={CAP.fixed}>{label.toUpperCase()}</Text>
    </View>
  );
}

export function GarageTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const styles = useStyles(({ colors: c }) => ({
    // The bar's background and rule span the screen; its tabs sit in a centred column on tablets.
    bar: { backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 8, alignItems: 'center' },
    row: { flexDirection: 'row', width: '100%', maxWidth: GARAGE_COLUMN, paddingHorizontal: 14, gap: 6, flex: 1 },
    tab: { flex: 1, minWidth: 44, alignItems: 'center', justifyContent: 'flex-start' },
  }));
  return (
    <View testID="garage-tab-bar" style={[styles.bar, { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom }]}>
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const def = GARAGE_TAB_META.find((t) => t.name === route.name);
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
    </View>
  );
}
