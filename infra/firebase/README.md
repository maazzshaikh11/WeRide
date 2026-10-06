# Firebase config

Copy your Firebase project config here (DO NOT commit to git — these are in .gitignore):

- `google-services.json` — Android config (place in `app/android/app/`)
- `GoogleService-Info.plist` — iOS config (place in `app/ios/Runner/`)
- `firebase-adminsdk-*.json` — service account key (for Cloud Functions / FCM send)

## Firestore security rules

Deploy with: `firebase deploy --only firestore:rules` — but run `migrations/backfill-join-codes.js` FIRST (join codes
moved to `join_codes/{CODE}` documents; see `docs/security/firestore.md` for the model, the migration and the deploy steps).

See `firestore.rules` for the rules file. Tests (Firestore emulator, Java 17, firebase-tools 13):

```
cd infra/firebase
npx --yes firebase-tools@13.35.1 emulators:exec --only firestore --project demo-weride "npm --prefix rules-test test"
# the same attack suite against the pre-hardening rules (shows what used to be allowed):
npx --yes firebase-tools@13.35.1 emulators:exec --only firestore --project demo-weride "npm --prefix rules-test run test:old"
```

## Cloud Functions

SOS FCM trigger: a Cloud Function on `sos_events/{sosId}` write → sends FCM push to group members.
TODO: implement in `functions/index.js` (Person B coordinates with infra).

## Firebase Emulator (for local dev)

Use the Firebase emulator suite for local development to avoid hitting free-tier limits:
```
firebase emulators:start --only firestore,auth
```

## Demo account

`seed/` creates the `teamdsy@weride.app` demo login with a joined group and past rides — see `seed/README.md`.
