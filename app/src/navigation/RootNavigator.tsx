/**
 * RootNavigator — every screen of the demo's information architecture (docs/DEMO_PARITY_SPEC.md §1):
 * first-launch flow, the Garage (four tabs + their sub-screens) and the Road (live ride) screens.
 */
import React from 'react';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';

import { useTheme } from '../theme/ThemeProvider';
import type { RootStackParamList } from './types';
import GarageTabs from './GarageTabs';

import BootScreen from '../screens/onboarding/BootScreen';
import SplashScreen from '../screens/onboarding/SplashScreen';
import PromiseScreen from '../screens/onboarding/PromiseScreen';
import AuthPhoneScreen from '../screens/onboarding/AuthPhoneScreen';
import AuthOtpScreen from '../screens/onboarding/AuthOtpScreen';
import AuthEmailScreen from '../screens/onboarding/AuthEmailScreen';
import ProfileScreen from '../screens/onboarding/ProfileScreen';
import PermsScreen from '../screens/onboarding/PermsScreen';
import ContactScreen from '../screens/onboarding/ContactScreen';
import DrillScreen from '../screens/onboarding/DrillScreen';
import CrewStartScreen from '../screens/onboarding/CrewStartScreen';
import JoinScreen from '../screens/garage/JoinScreen';
import PlanWhereScreen from '../screens/garage/PlanWhereScreen';
import PlanRouteScreen from '../screens/garage/PlanRouteScreen';
import PlanWhenScreen from '../screens/garage/PlanWhenScreen';
import PlanDoneScreen from '../screens/garage/PlanDoneScreen';
import CrewScreen from '../screens/garage/CrewScreen';
import RecapScreen from '../screens/garage/RecapScreen';
import SafetyScreen from '../screens/garage/SafetyScreen';
import DisplayScreen from '../screens/garage/DisplayScreen';
import PrivacyScreen from '../screens/garage/PrivacyScreen';
import MeetupScreen from '../screens/road/MeetupScreen';
import MapScreen from '../screens/map/MapScreen';
import StopScreen from '../screens/road/StopScreen';
import ArriveScreen from '../screens/road/ArriveScreen';

const Stack = createStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      initialRouteName="Boot"
      screenOptions={{
        ...TransitionPresets.SlideFromRightIOS,
        headerShown: false,
        gestureEnabled: true,
        cardStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="Boot" component={BootScreen} options={{ animationEnabled: false, gestureEnabled: false }} />
      <Stack.Screen name="Splash" component={SplashScreen} options={{ animationEnabled: false, gestureEnabled: false }} />
      <Stack.Screen name="Promise" component={PromiseScreen} options={{ ...TransitionPresets.ModalFadeTransition, gestureEnabled: false }} />
      <Stack.Screen name="AuthPhone" component={AuthPhoneScreen} />
      <Stack.Screen name="AuthOtp" component={AuthOtpScreen} />
      <Stack.Screen name="AuthEmail" component={AuthEmailScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Perms" component={PermsScreen} />
      <Stack.Screen name="Contact" component={ContactScreen} />
      <Stack.Screen name="Drill" component={DrillScreen} />
      <Stack.Screen name="CrewStart" component={CrewStartScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="Join" component={JoinScreen} />

      <Stack.Screen name="GarageTabs" component={GarageTabs} options={{ ...TransitionPresets.ModalFadeTransition, gestureEnabled: false }} />
      <Stack.Screen name="PlanWhere" component={PlanWhereScreen} />
      <Stack.Screen name="PlanRoute" component={PlanRouteScreen} />
      <Stack.Screen name="PlanWhen" component={PlanWhenScreen} />
      <Stack.Screen name="PlanDone" component={PlanDoneScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="Crew" component={CrewScreen} />
      <Stack.Screen name="Recap" component={RecapScreen} />
      <Stack.Screen name="Safety" component={SafetyScreen} />
      <Stack.Screen name="Display" component={DisplayScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />

      <Stack.Screen name="Meetup" component={MeetupScreen} />
      <Stack.Screen name="Live" component={MapScreen} options={{ ...TransitionPresets.ModalFadeTransition, gestureEnabled: false }} />
      <Stack.Screen name="Stop" component={StopScreen} options={{ ...TransitionPresets.ModalFadeTransition, gestureEnabled: false }} />
      <Stack.Screen name="Arrive" component={ArriveScreen} options={{ ...TransitionPresets.ModalFadeTransition, gestureEnabled: false }} />
    </Stack.Navigator>
  );
}
