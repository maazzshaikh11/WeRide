---
### Byte 2: The app shell — navigation and shared state
*Builds on:* Byte 1 (the app is the glue between modules)

*In plain terms:*
The app is a small stack of screens (sign in → pick a ride → the ride itself) and a handful of **Zustand stores** (tiny global state containers). Screens stay thin: they read from stores, and the stores are fed by the modules.

*The code:*
```tsx
// app/src/navigation/RootStack.tsx
export type RootStackParamList = {
  Login: undefined;
  Groups: undefined;                 // "My rides" list, join, create
  MainApp: { groupId: string };      // the 6-tab ride experience
};
```
The six tabs inside `MainApp` are **Home (live map), Stops, Voice, Family, Alerts, History**.

*How it fits together:*
- **Auth → group → ride.** `LoginScreen` restores or creates a Firebase session, `GroupListScreen` lists/joins/creates rides, and opening one sets `groupId` and navigates to `MainApp`.
- **One store per concern**, all under `app/src/store/` (the route store lives in the routing module because Person C owns it):

| Store | Holds |
|---|---|
| `appStore` | `userId`, `groupId`, `groupName`, `rideStartedAt` |
| `ridePlanStore` | start / destination / stops chosen for the ride |
| `stopsStore` | the stop timeline and which stop is "current" |
| `ridersStore` | other riders' latest verified locations + connection state |
| `routeStore` (`@routing`) | the current route, the rider's own fix, active hazard clusters |
| `toastStore` | transient messages |

- **Ride-scoped state must be reset.** These stores are module-level, so they outlive screens. Without a reset, opening a second ride would show the first ride's route and destination:

```ts
// app/src/store/rideSession.ts
export function resetRideSession(): void {
  useRouteStore.setState({ route: null, currentLocation: null, lastValidLocation: null, /* … */ });
  useRidePlanStore.getState().clearPlan();
  useStopsStore.getState().reset();
  useRidersStore.getState().clear();
}
```
It is called before a ride is opened and before the Create Ride form starts.

*Why it is designed this way:* Zustand keeps state outside React, so non-UI code (the tracking publisher, socket handlers) can write to stores directly, and any screen re-renders only for the slice it selects.

*Gotcha:* `MapScreen` is the heaviest screen — it starts tracking, subscribes to riders, loads the ride plan and hosts the camera. It must stay unmounted-safe: its effect cleanup stops tracking and unsubscribes.
