---
### Byte 7: Groups as rides — create, join with a code, and the ride list
*Builds on:* Byte 2 (screens and stores) and Byte 4 (Firestore groups and rules)

*In plain terms:*
In the backend a **group** is both the *people* and the *ride*: one Firestore document holds members, the planned route, ride type and start time. `GroupService` creates, joins and leaves groups; the **Rides screen** turns those documents into the ride cards you see.

*The code:*
```ts
// modules/routing-eta/src/group/groupService.ts
await groups.doc(groupId).set({
  name, created_by: uid, member_ids: [uid],
  join_code,                                  // 6 unambiguous chars, e.g. "K7M2QX"
  ride_type, start_time_ms,                   // optional, never invented
  ride_plan: { start, stops, destination },   // coordinates for the map + stats
});
```

*How it fits together:*
- **Create Ride modal** collects start, destination, stops, optional ride type and a start-time preset, then calls `createGroup`. A **short join code** is generated (no `0/O/1/I`, checked for uniqueness) so it can be read aloud.
- **Join** accepts either that code or a raw group id (older rides). A code is resolved by querying `join_code`; the user is added with `arrayUnion`. **Leave** uses `arrayRemove`; both are allowed by the Firestore rules because the caller is (or becomes) a member.
- **Rides screen** subscribes to `member_ids array-contains me`, then `sectionRides()` splits the list into **Up next / Your rides / Earlier** using only real fields — a ride's badge (*Upcoming / Started / Past / Planned*) comes from `start_time_ms`.
- **Ride cards** show a route thumbnail (an on-device sketch of the planned waypoints, with a Mapbox static map fading in on top), distance (straight-line along the waypoints, marked `~`), riders, type and start time. No ETA/speed/safety is shown for a plan, because none exists yet.
- **Opening a ride** calls `resetRideSession()`, sets `groupId`/`groupName`, and navigates to `MainApp`, where `MapScreen` loads the saved `ride_plan` back into `ridePlanStore`.

*Why it is designed this way:* a schemaless Firestore document lets new optional fields (ride type, start time) be added without migrations, and keeping the plan on the group means every member sees the same route and stops.

*Gotcha:* "group = one ride" is a deliberate simplification of today's code; the original schema sketched a separate `rides/` collection that is **not** used. A crew owning many rides would be a model change.
