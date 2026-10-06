/** Route names and params (docs/DEMO_PARITY_SPEC.md §1). */
import type { NavigatorScreenParams } from '@react-navigation/native';

export type GarageTabParamList = {
  Ride: undefined;
  Crews: undefined;
  Log: undefined;
  Me: undefined;
};

export type RootStackParamList = {
  Boot: undefined;
  // first launch
  Splash: undefined;
  Promise: undefined;
  AuthPhone: undefined;
  AuthOtp: undefined;
  AuthEmail: undefined;
  Profile: undefined;
  Perms: undefined;
  Contact: undefined;
  Drill: { fromSettings?: boolean } | undefined;
  CrewStart: undefined;
  Join: { code?: string } | undefined;
  // garage
  GarageTabs: NavigatorScreenParams<GarageTabParamList> | undefined;
  PlanWhere: undefined;
  PlanRoute: undefined;
  PlanWhen: undefined;
  PlanDone: { rideId: string };
  Crew: { crewId: string };
  Recap: { rideId: string };
  Safety: undefined;
  Display: undefined;
  Privacy: undefined;
  // road
  Meetup: { groupId: string };
  Live: { groupId: string };
  Stop: { groupId: string };
  Arrive: { groupId: string };
};
