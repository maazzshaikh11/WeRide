# teamDSY demo account

Creates one real login in a Firebase project, already inside a group and with past rides, like the
account in `demo.html`:

| | |
|---|---|
| **Login** | `teamdsy@weride.app` |
| **Password** | `teamDSY@123` |
| **Display name** | `teamDSY` |

The app signs in with an **email**, not a username, so type the email above (Firebase would reject
a bare `teamDSY`).

## What it writes

- **Auth user** with the email/password above (re-running resets the password and re-enables it).
- **Profile + settings**: public profile (name teamDSY, Himalayan 450, Steady, lifetime stats = the sum of the logs below)
  and private settings with `onboarded: true`, so the app opens straight in the Garage. **No emergency contacts are
  invented** — add your own in Me → SOS & emergency (Meetup will show a "No SOS contact" warning until you do).
- **3 crews**: Ghat Ghosts (6 riders, Meera lead, Kabir sweep), Sunday Slow Rollers (5), Office Bikers (4), each with a join code.
- **6 rides** (`groups/seed-teamdsy-*`, a ride is a group doc) linked to their crew, with route plans, ride type, pace,
  join code and status:
  - **Sunday Ghat Run** (Ghat Ghosts) — the next ride, tomorrow 06:30, `planned`, with RSVPs from the crew;
  - **Ghat Ghosts Weekend** — created by someone else, teamDSY joined, `planned`, with RSVPs;
  - four **finished** rides (Lonavala Sunrise Loop, Marine Drive Night Ride, Pune Expressway Blast, Alibaug Coastal Run),
    8–44 days ago, with everyone's `arrived` presence.
- **4 recorded ride logs** for the finished rides (km, time, avg/max speed, together %, longest gap, hazards, signals, a
  240-point track and a timeline of events). **These are synthetic**: the tracks are interpolated along each ride's
  planned route so the Log and Recap screens have something to show — they are not rides anyone recorded.
- **9 `join_codes/{CODE}` docs** (3 crews + 6 rides): crews and rides are readable by members only, so the app resolves a
  code through `join_codes/{CODE} = { kind, target_id }` (see `docs/security/firestore.md`).
- **3 hazard clusters** on the next ride's route (2 active, 1 resolved).

Crew members are plain ids like `seed-meera` with a public profile (name, bike, style, stats) so the app shows names;
they are **not** accounts and cannot log in. Everything uses fixed document ids, so running the script again updates in
place and never duplicates.

Not seeded on purpose: rider locations (they would show as stale dots) and roll-call state.

## Run it

You need a **service-account key** for the project (Firebase console → Project settings → Service
accounts → Generate new private key) and **Email/Password** enabled under Authentication → Sign-in
method. The key is a secret; don't commit it.

```
cd infra/firebase/seed
npm install
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json node seed-teamdsy.js --project <your-project-id>
node seed-teamdsy.js --remove          # (same env) delete the user and everything it created
```

The Firestore rules in `../firestore.rules` must be deployed (members read their groups).

### Local emulators (nothing touches a real project)

```
cd infra/firebase
npx firebase-tools@13 emulators:start --only auth,firestore --project demo-weride
# in another shell
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
  node seed/seed-teamdsy.js --project demo-weride
```

(`firebase-tools@13` runs on Java 17; newer versions need Java 21.) The app has to be built to talk
to the emulators to see this data; by default it uses the real project from `google-services.json`.

## Tests

```
npm test                                  # data checks (no emulator needed)
cd .. && npx firebase-tools@13 emulators:exec --only auth,firestore --project demo-weride \
  "node --test seed/test/seed.emulator.test.js"   # signs in as teamDSY and runs the Rides query under the real rules
```
