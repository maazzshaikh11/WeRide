# demo.html → production app: the contract

`demo.html` (repo root) is the approved design **and the feature list**. This document says, for every
demo screen, which React Native screen implements it, what real data feeds it, and what is deliberately
not built because there is no real data/backend for it. Everything here is implemented; nothing is a mock.

Rules that never bend:

1. **Layout, type, spacing, copy and behaviour follow `demo.html`.** Only colours differ per theme
   (Demo / Ember × light / dark, already built: `app/src/theme`, `app/src/ui`).
2. **Real data only.** No fictional riders, rides, distances, scores or times. Where the demo shows a
   number we cannot compute, the element is omitted (or shows an honest empty state) and is listed in
   "Not built" below.
3. Do not rewrite the EKF, spoof detector, routing/A* or DBSCAN algorithms. Services around them may change.
4. Tap targets ≥ 44, accessibility labels on every control, reduced-motion respected (use `app/src/ui`).
5. Every screen has tests (render under the 4 palettes; behaviour; real-data branches incl. empty/error).

## 1. Information architecture (route names)

One root stack (`app/src/navigation/RootNavigator.tsx`), screens registered flat:

| Group | Route | Screen file (under `app/src/screens`) | Demo screen |
|---|---|---|---|
| boot | `Boot` | `onboarding/BootScreen` | — (decides where to go) |
| first launch | `Splash` | `onboarding/SplashScreen` | splash |
| | `Promise` | `onboarding/PromiseScreen` | promise |
| | `AuthPhone` | `onboarding/AuthPhoneScreen` | auth-phone |
| | `AuthOtp` | `onboarding/AuthOtpScreen` | auth-otp |
| | `AuthEmail` | `onboarding/AuthEmailScreen` | (production addition: email sign-in) |
| | `Profile` | `onboarding/ProfileScreen` | profile |
| | `Perms` | `onboarding/PermsScreen` | perms |
| | `Contact` | `onboarding/ContactScreen` | contact |
| | `Drill` | `onboarding/DrillScreen` | drill |
| | `CrewStart` | `onboarding/CrewStartScreen` | crew-start |
| | `Join` | `garage/JoinScreen` | join (also reachable from Crews) |
| garage tabs | `GarageTabs` → `Ride` `Crews` `Log` `Me` | `navigation/GarageTabs` | the 4-tab bar |
| Ride | `Ride` tab | `garage/RideHomeScreen` | home |
| | `PlanWhere` / `PlanRoute` / `PlanWhen` / `PlanDone` | `garage/Plan*Screen` | plan-where / plan-route / plan-when / plan-done |
| Crews | `Crews` tab | `garage/CrewsScreen` | crews |
| | `Crew` `{crewId}` | `garage/CrewScreen` | crew |
| Log | `Log` tab | `garage/LogScreen` | log |
| | `Recap` `{rideId}` | `garage/RecapScreen` | recap |
| Me | `Me` tab | `garage/MeScreen` | me |
| | `Safety` / `Display` / `Privacy` | `garage/{Safety,Display,Privacy}Screen` | safety / display / privacy |
| road | `Meetup` `{groupId}` | `road/MeetupScreen` | meetup (roll call) |
| | `Live` `{groupId}` | `map/MapScreen` (existing, extended) | live |
| | `Stop` `{groupId}` | `road/StopScreen` | stop |
| | `Arrive` `{groupId}` | `road/ArriveScreen` | arrive |

Sheets (components in `app/src/sheets`, opened with the `Sheet` primitive): `IntelSheet`, `RideInfoSheet`,
`NewCrewSheet`, `CrewMenuSheet`, `InviteSheet`, `MemberSheet`, `ShareCardSheet`, `RateRouteSheet`,
`FamilySheet`, `VoicePrefsSheet`, `PermsSheet`, `AddContactSheet`, plus on Live: `SignalSheet`, `HazardSheet`, `RouteSheet`.

Full-screen overlays (components in `app/src/overlays`, mounted ONCE at the root by `OverlayHost`, driven by
`store/overlayStore`, so they work from every Road screen): `SosSentOverlay` (sent / queued / drill / auto),
`SosIncomingOverlay`, `CrashCountdownOverlay`, `Call112Overlay`, `RollOutOverlay`, `ArrivedBreakOverlay` (break over).

The old six-tab shell (Home/Stops/Voice/Family/Alerts/History) and `GroupListScreen`/`CreateRideModal` are
retired once their replacements exist; their services/components are reused.

## 2. Data model (Firestore) — the single source of truth

Types live in `app/src/models/domain.ts`; paths in `app/src/models/paths.ts`. Rules: `infra/firebase/firestore.rules`.
**A "group" document stays the RIDE** (tracking, hazards, SOS, routing all key on `groupId` and are untouched).
A new **crew** is the persistent set of people.

```
users/{uid}                       PUBLIC profile (any signed-in user can read; only owner writes)
  name, bike, style('Relaxed'|'Steady'|'Spirited'), created_at,
  stats: { km: number, rides: number, together_sum: number }      // together_sum/rides = avg % together
users/{uid}/private/settings      OWNER ONLY
  prefs: { hold_ms:1000|1500|2000, glove:boolean, units:'km'|'mi', road:'night'|'day'|'auto',
           crash:boolean, learn:boolean, share:'crew' },
  contacts: [{ id, name, number }],                              // emergency contacts (E.164 or local)
  onboarded: boolean, phone?: string
users/{uid}/ride_logs/{rideId}    OWNER ONLY. rideId = the group (ride) id
  ride_id, crew_id?, name, started_ms, ended_ms, km, duration_s, avg_kmh, max_kmh,
  together_pct (0..100), longest_gap_m, riders, hazards_shared, signals_sent,
  track: number[]  // flat [lat,lng,lat,lng,…], ≤ 600 points (Firestore forbids nested arrays)
  events: [{ t_ms, kind:'rolled'|'hazard'|'stop'|'gap'|'arrived'|'sos', text }],
  rating?: 'smooth'|'mixed'|'rough', start:{label,lat,lng}, destination:{label,lat,lng}

crews/{crewId}
  name, created_by, member_ids: string[], roles: { [uid]: 'lead'|'sweep' }, join_code (6 chars, same
  alphabet as ride codes), created_at
groups/{rideId}                   THE RIDE (existing doc) + new optional fields:
  crew_id?, pace?:'Relaxed'|'Steady'|'Spirited', invited_ids?: string[],
  status: 'planned'|'meetup'|'live'|'finished', started_ms?, finished_ms?, meetup?:{label,lat,lng}
groups/{rideId}/rsvp/{uid}        { status:'going'|'maybe'|'no', updated_ms }                 member writes own
groups/{rideId}/roll_call/{uid}   { state:'ready'|'notready', updated_ms }                    member writes own
groups/{rideId}/presence/{uid}    { state:'riding'|'stopped'|'fuel'|'ready'|'arrived', updated_ms } member writes own
groups/{rideId}/locations/{uid}   (existing: last-known verified fix)
hazards/{id}                      (existing) + gone_votes?: string[]   ("still there"/"gone" confirmation)
sos_events/{id}                   (existing) ; sos_events/{id}/responders/{uid}: { state:'going'|'arrived', updated_ms }
```

Ride lifecycle (one writer per transition, everyone else reacts to the snapshot):
`planned` → (any member opens roll call; the lead normally does) `meetup` → (lead taps "Roll out" or everyone
is ready) `live` → (lead ends the ride on the Arrive screen) `finished`. Members' devices navigate to `Live`
automatically when the ride they are in turns `live`, and to `Recap` on `finished`.

Derived (never stored): "at meetup" = rider's last fix within 150 m of `meetup`/start; "arrived" = within 150 m of the
destination; "in N min" = distance to meetup / that rider's recent speed (hidden if speed unknown); cohesion =
share of ride time everyone with a fresh fix was within 500 m of each other (same threshold as the Live plate).

## 3. Screen-by-screen: real data and what is NOT built

### First launch
- **Splash** — brand plate + moving centre-line; 2.3 s then `Promise`. Uses the real logo component.
- **Promise** — copy as in demo. "Get started" → `AuthPhone`; "I have a crew code" → `AuthPhone` (code is entered after sign-in).
- **AuthPhone** — +91 chip + 10-digit field, real Firebase phone auth (`auth().signInWithPhoneNumber`). "Use email instead" link → `AuthEmail`. *Not built:* the demo's "Use demo number" chip (demo-only).
- **AuthOtp** — 6 boxes + the demo's custom keypad; real `confirm(code)`; real resend timer (60 s) and resend; error shake on wrong code. *Not built:* "Autofill 482913" (demo-only).
- **AuthEmail** — the existing email/password screen (sign in / create account), restyled; keeps existing accounts (e.g. the teamDSY demo login) working.
- **Profile** — name, bike chips (Himalayan 450, Duke 390, Interceptor 650, Meteor 350, Other), style segmented, live "rider plate". Saves `users/{uid}`.
- **Perms** — three cards with the demo's wording; **real** OS permission requests (Android `PermissionsAndroid`; iOS location via geolocation-service `requestAuthorization('always')`, notifications via firebase-messaging, microphone via the WebRTC permission helper). Continue is enabled once location + notifications are granted. A denial shows the demo's yellow toast.
- **Contact** — emergency contact: **add a contact by name + number** (real form; the demo's three fictional contacts are not shipped), list with toggle/remove, live "preview of the text". Saves to `private/settings.contacts`. Continue requires ≥ 1.
- **Drill** — real SOS practice with the demo's ring (hold time = `prefs.hold_ms`); nobody is alerted. Reused from `Safety`.
- **CrewStart** — "Join with a code" → `Join`; "Start a crew" → `NewCrewSheet` (creates a real crew + code). *Not built:* the demo-crew shortcut "GHOST7".
- **Join** — the demo's 6-box + on-screen letter keypad; resolves a **crew code** (or a ride code, as today) against Firestore; wrong/unknown code → shake + message; success overlay "YOU'RE IN" with the crew's real members and next ride, then `GarageTabs`.

### Ride tab (`RideHomeScreen`)
- Header: real date/time label, greeting by hour, avatar → `Me`. Weather card: **real** (Open-Meteo, no key) for the next ride's start or the rider's position: temperature, sky, wind, sunrise; hidden if the request fails.
- Hero by ride status of the rider's next ride: **Ride pass** (`planned`: map header, perforation, pill, name, route, distance/est. time/safety from the saved plan + route calc, avatars, "N of M confirmed" from `rsvp`, "IN 49 MIN" countdown, RSVP Going/Maybe/Can't, "Go to meetup"), **Meetup open** (`meetup`: "Open roll call"), **Live** (`live`: dark ticket, "Rejoin ride"), **Finished** (`finished` and a log exists: "See the recap"). No ride at all → an honest empty hero ("Nothing planned" + Plan a ride / Join a crew).
- **Route intel** card + `IntelSheet`: real active hazard clusters for that ride's group + the ride's safety score; "Hazards show up when two riders report…" copy kept.
- **Also coming up**: the rider's other upcoming rides (across crews) → `RideInfoSheet` (map, RSVP "I'm in", invite copy).
- **Where next?**: "Plan a ride" → `PlanWhere`; chips = the rider's own past rides' destinations (re-plan). Hidden when there are none.
- **Crew pulse**: real feed from `rsvp`/`roll_call`/`presence` updates ("Meera confirmed", "Dev is ready"), newest first. Hidden when empty.

### Plan (3 steps + done)
- **PlanWhere** — search via the existing Mapbox geocoder; start defaults to the rider's current position (editable); "Popular with crews near you" = destinations of rides in the rider's crews. 
- **PlanRoute** — calls the real routing server; shows **up to three real options** (server returns `alternatives`: duration, distance, safety score, hazard count; labelled Fastest / Safest / Alternative only when they genuinely differ). Hazards on the chosen route drawn as diamonds. *Not built:* "Scenic ghats / 3 chai stops" (no scenic data).
- **PlanWhen** — day chips, roll-out time stepper (±15 min), crew invitees (members of the chosen crew), pace segmented, fuel/chai toggles which **add real POI stops** found with the Mapbox geocoder near the route midpoint (toggles hidden when no token). Crew picker when the rider has several crews.
- **PlanDone** — green plate, ticket, invite code (the crew's code) with Copy/Share. *Not built:* "Calendar" button.
- Creating writes a `groups/{rideId}` doc with `crew_id`, `ride_plan`, `start_time_ms`, `ride_type`, `pace`, `status:'planned'`, `meetup`.

### Crews
- **Crews tab** — the rider's real crews (card: name, N riders, avatar stack, next ride + time, "Ride tomorrow" pill if within 24 h); "Join with code", "Start a crew" (`NewCrewSheet`).
- **Crew** — hero (name, "CREW · EST. <created month>", avatars, "N riders"); Invite riders (`InviteSheet`: code, **QR**, Copy, Share); Riders list (name, bike, Lead/Sweep pill from `roles`) → `MemberSheet`; Rides list (crew's upcoming + the rider's logged rides → `Recap`); menu (`CrewMenuSheet`: Leave crew is real; mute is local preference). *Not built:* "km together" for the crew (other riders' logs are private), the mic button on the crew card (no persistent crew channel).
- **MemberSheet** — name, bike, "Verified GPS" pill (only if they have ridden), km / rides / together % from their public `stats`. *Not built:* Call/Message (phone numbers are private).

### Log
- **Log tab** — season totals (km, rides, hours) and the 8-week bar chart from the rider's `ride_logs`; ride cards with the recorded-track sketch and "together %".
- **Recap** — hero map sketch of the **recorded track** with a real replay scrubber, cohesion ring, longest gap, km/time/avg, riders/hazards shared/signals, timeline from recorded `events`, "Rate the route", "Share card" (`ShareCardSheet` → OS share sheet with a text card). *Not built:* "Save image" (needs an image-capture library).
- Ride logs are written by the **RideRecorder** (§4) at "End ride".

### Me
- **Me** — rider plate (real profile), lists exactly as demo: Safety (SOS & emergency → `Safety`; Family sharing → `FamilySheet`), Riding (Road screen & controls → `Display`; Voice & signals → `VoicePrefsSheet`), Privacy (Privacy & learning → `Privacy`; Permissions → `PermsSheet` with real OS status + "Open system settings"), Account (Replay onboarding; Sign out).
- **Safety** — "How SOS works" card, contacts list (add/delete, real), crash-detection toggle (real accelerometer detector), hold-time segmented 1.0/1.5/2.0 s (**drives the SOS hold everywhere**), "Run an SOS drill".
- **Display** — Garage theme (Light / Dark / Auto) + **Theme (Demo / Ember)** (the theme picker the owner asked for), Road theme (Night / Day / Sunset auto), glove mode (bigger Road controls), units (km / mi, applied app-wide). *Not built:* "Spoken alerts" (no TTS engine in the app), "Preview Road screen".
- **Privacy** — diagram card, "Improve ETAs for everyone" toggle gating federated-learning participation (real FL status line if the module reports it), "Who sees my live position: Crew only" (family option disabled: not available), "How we know a dot is real" legend.
- **FamilySheet** — honest: "Share my location" snapshot (existing share), and a note that live family links are not available yet. *Not built:* watcher list/toggles (no backend/web viewer).

### Road
- **Meetup (roll call)** — real: members' tiles from `roll_call` + live fixes ("at meetup" within 150 m, "in N min", "ready"), "N of M ready" pill, ready-check chips from real state (GPS precise, always-on location, SOS contact set, voice off/on) — *battery chip not built (no battery module)*; "I'm ready"/"Ready · waiting for N" (writes `roll_call`); Navigate opens the maps app to the meetup point; the lead sees **Roll out**; when everyone is ready the lead's device starts the roll-out countdown (`RollOutOverlay`) and sets the ride `live`; every member's device follows.
- **Live** — existing screen, extended to demo parity: status plate states (all together / gap / **hazard ahead** / **signal from the crew** / **stop ahead** / **rider no signal** / SOS / finding you / solo / signal lost), the distance label beside your avatar (already built), hazard-ahead alert from real active clusters on the route within 500 m and the post-hazard **"Still there / Gone"** confirm (writes `gone_votes` / another report), signals incoming shown on the plate, **push-to-talk** key (hold) wired to the voice client (honest toast if the channel isn't live), group-view button, glove mode, units, Road theme pref. *Not built:* speed-limit sign (no limit data).
- **Stop** — auto-opens when the rider is stationary (< 5 km/h for 20 s) within 150 m of a planned stop (or tapped from the "stop ahead" plate): stop plate + break timer, crew tiles from `presence` ("ready"/"fuelling"/"pulling in"/"on a break"), "Next leg" card (real distance/time from the route, hazards on the leg), SOS key, "I'm ready to roll" → when all ready → `RollOutOverlay` → `Live`.
- **Arrive** — opens within 150 m of the destination: green "Arrived" plate, "Everyone home." with per-rider tiles from `presence` ("✓ home"), stats card (km, time, together %), **Hold 1 s to end ride** → finalises the ride log, sets `finished`, navigates to `Recap`.

### SOS (reachable from every Road screen)
- **Sent / Queued / Auto / Drill** — red full screen: "SOS SENT" / "SOS SAVED" (offline) from the **real result** of the existing offline-first SOS service; rows: crew alerted ("Sent to N crew" or "Queued on this phone"), **contacts** ("Text Mom" buttons that open the SMS composer prefilled with the message + live-location text — automatic SMS needs an SMS provider and is *not built*), live location on, **nearest responder** (real `responders` with distance; "Finding the nearest rider…" until someone taps I'm going); "Call 112" (opens the dialler); "I'm OK · hold 2 s to cancel" (resolves the real SOS). Drill variant shows the DRILL banner and alerts nobody. Offline: yellow "No signal · queued" plate; retries are the existing queue.
- **Incoming** — full screen when another rider's SOS arrives: name, distance, mini map sketch, rows of responders, "I'm going" / "I'm with <name>" (writes `responders`), Call 112.
- **Crash** — real detector (accelerometer spike + speed drop) when the toggle is on → yellow "Are you OK?" 15 s countdown → "I'm OK" or sends SOS automatically.

## 4. Shared services (one owner each; others import)

| Service / store | Owner package | Purpose |
|---|---|---|
| `models/domain.ts`, `models/paths.ts`, `firestore.rules`, seed | foundation | schema |
| `services/userService.ts`, `store/profileStore.ts`, `store/prefsStore.ts` | foundation | profile, private settings, prefs (MMKV cache + Firestore sync) |
| `services/authService.ts`, `services/permissionsService.ts` | A | phone/email auth, OS permissions |
| `services/crewService.ts`, `store/crewsStore.ts` | C1 | crews CRUD, join by code, live subscriptions |
| `services/rideService.ts`, `store/ridesStore.ts`, `store/planDraftStore.ts`, `utils/weather.ts` | B | rides across crews, RSVP, roll call, status, presence, plan draft |
| `services/rideLogService.ts`, `services/rideRecorder.ts` | C2 | log read/write, in-ride recorder (track, cohesion, events) |
| `store/overlayStore.ts`, `services/sosFlowService.ts`, `services/crashDetector.ts` | E | SOS overlays, responders, crash detection |
| `utils/units.ts` | foundation | km/mi formatting |

## 5. Not built anywhere (and why) — the honest list
Speed-limit sign; spoken alerts (no TTS engine); automatic SMS to contacts (needs an SMS provider — the app opens
the SMS composer instead); family live links and watcher list (no backend/web viewer); battery chip; "Save image";
calendar export; crew-wide "km together"; call/message other riders (numbers are private); scenic-route option;
demo-only helpers (demo number, autofill code, demo crew code, preview road, fictional contacts/riders).
