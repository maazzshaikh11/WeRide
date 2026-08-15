# Firebase config

Copy your Firebase project config here (DO NOT commit to git — these are in .gitignore):

- `google-services.json` — Android config (place in `app/android/app/`)
- `GoogleService-Info.plist` — iOS config (place in `app/ios/Runner/`)
- `firebase-adminsdk-*.json` — service account key (for Cloud Functions / FCM send)

## Firestore security rules

Deploy with: `firebase deploy --only firestore:rules`

See `firestore.rules` for the rules file.

## Cloud Functions

SOS FCM trigger: a Cloud Function on `sos_events/{sosId}` write → sends FCM push to group members.
TODO: implement in `functions/index.js` (Person B coordinates with infra).

## Firebase Emulator (for local dev)

Use the Firebase emulator suite for local development to avoid hitting free-tier limits:
```
firebase emulators:start --only firestore,auth
```