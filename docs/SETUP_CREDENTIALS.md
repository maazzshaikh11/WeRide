# WeRide — Setup Credentials (manual steps)

These values are never invented, never committed, and never shared outside the
team. Every step below must be completed by a human before the app runs
end-to-end on a device.

## App (`app/.env`)

| Variable | Where it comes from | Notes |
|---|---|---|
| `MAPBOX_ACCESS_TOKEN` (server env) / `MAPBOX_TOKEN` (`app/.env`) | Mapbox account → Tokens | Needs Directions + Maps SDK scopes. Public token is fine in the client; never use a secret token. |
| `ROUTING_URL` | Base URL of the routing server (the app appends `/route`) | e.g. `https://<host>` — do NOT include `/route`. Unset: Android emulator → `http://10.0.2.2:3000`, iOS simulator → `http://localhost:3000`. Physical devices need your machine's LAN address. |
| `SOCKET_URL` | Same server (Socket.io) | Same host rules as above. |
| `ETA_SIDECAR_URL` | ETA model sidecar | If unset, the app falls back to server-side ETA. |

## Firebase

1. Create (or reuse) the Firebase project in the Firebase console.
2. Add an Android app (package name from `app/android/app/build.gradle`) and an
   iOS app (bundle id from Xcode); download `google-services.json` /
   `GoogleService-Info.plist` into the platform folders.
3. Run `firebase login` and `firebase use --add` inside `infra/firebase/` —
   this creates `.firebaserc`, which is **deliberately uncommitted**.
4. Deploy rules: `firebase deploy --only firestore:rules`.
5. Enable Email/Password (or your chosen provider) in Authentication.

## Fonts (already bundled — nothing to do)

The 7 font files ship in the repo (`app/assets/fonts/`, Android assets,
iOS Fonts + `UIAppFonts`). A fresh `react-native-asset` run is only needed if
fonts are added/renamed later.

## Permissions (requested at runtime on device)

Location (foreground + background for tracking), microphone (Voice tab).
Denying either degrades gracefully — tracking and voice show explicit empty
states rather than crashing.

## Android release signing (never committed)

Release builds are no longer signed with the debug key and fail without credentials. Copy
`app/android/keystore.properties.example` to `app/android/keystore.properties` (git-ignored), or set the Gradle
properties / environment variables `WERIDE_RELEASE_STORE_FILE`, `WERIDE_RELEASE_STORE_PASSWORD`,
`WERIDE_RELEASE_KEY_ALIAS`, `WERIDE_RELEASE_KEY_PASSWORD`. The Mapbox download token is the Gradle property
`MAPBOX_DOWNLOADS_TOKEN` (`~/.gradle/gradle.properties` or CI secret). See `docs/SECURITY.md`.
