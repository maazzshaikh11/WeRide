/**
 * RootStack — auth flow + main app (spec §2.1, §2.2).
 * Login → Groups → MainApp (6-tab navigator). Auth/group flow preserved
 * exactly; Map screen replaced by the tab navigator per master spec.
 */
import React from 'react';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';

import LoginScreen from '../screens/LoginScreen';
import GroupListScreen from '../screens/GroupListScreen';
import MainTabNavigator from './MainTabNavigator';

export type RootStackParamList = {
  Login: undefined;
  Groups: undefined;
  MainApp: { groupId: string };
};

const Stack = createStackNavigator<RootStackParamList>();

export function RootStack() {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        // Same horizontal slide on both platforms (Android's default is a
        // different, abrupt fade-up), with the swipe-back gesture enabled.
        ...TransitionPresets.SlideFromRightIOS,
        gestureEnabled: true,
        headerTitleAlign: 'center',
        headerStyle: { backgroundColor: '#0A0A0A' },
        headerTintColor: '#F0F0F0',
      }}
    >
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ title: '', headerShown: false }}
      />
      <Stack.Screen
        name="Groups"
        component={GroupListScreen}
        options={{
          title: '',
          headerShown: false,
          // Arrived via replace() from Login: slide forward, not back.
          animationTypeForReplace: 'push',
          // No swipe-back to the login form once signed in.
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="MainApp"
        component={MainTabNavigator}
        options={{ title: '', headerShown: false }}
      />
    </Stack.Navigator>
  );
}