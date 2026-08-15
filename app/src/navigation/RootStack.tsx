import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import LoginScreen from '../screens/LoginScreen';
import GroupListScreen from '../screens/GroupListScreen';
import MapScreen from '../screens/map/MapScreen';

export type RootStackParamList = {
  Login: undefined;
  Groups: undefined;
  Map: { groupId: string };
};

const Stack = createStackNavigator<RootStackParamList>();

export function RootStack() {
  return (
    <Stack.Navigator initialRouteName="Login" screenOptions={{ headerTitleAlign: 'center' }}>
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'WeRide' }} />
      <Stack.Screen name="Groups" component={GroupListScreen} options={{ title: 'Your Groups' }} />
      <Stack.Screen
        name="Map"
        component={MapScreen}
        options={({ route }) => ({ title: `Ride: ${route.params.groupId.slice(0, 8)}` })}
      />
    </Stack.Navigator>
  );
}