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
- **6 groups** (`groups/seed-teamdsy-*`, a group *is* a ride in this app), all with a real route plan,
  ride type, start time and join code:
  - **Sunday Ghat Run**, the next ride (tomorrow 06:30), created by teamDSY, 6 riders;
  - **Ghat Ghosts Weekend**, a group created by someone else that teamDSY **joined**;
  - four **past rides**: Lonavala Sunrise Loop (8 days ago), Marine Drive Night Ride (15),
    Pune Expressway Blast (29), Alibaug Coastal Run (44). They appear under "Earlier".
- **3 hazard clusters** on the next ride's route (2 active, 1 resolved) for the Alerts tab.

Crew members are plain ids like `seed-meera`. They are **not** accounts, they cannot log in, and the
app shows them as "Rider <last 4 of the id>" (it has no profile names). Everything uses fixed
document ids, so running the script again updates in place and never duplicates.

Not seeded on purpose: rider locations (they would show as stale dots) and ride *history* stats
(the app doesn't store completed-ride stats yet, so there's nothing for them to fill).

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
