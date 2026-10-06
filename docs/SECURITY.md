# WeRide security report

Consolidated report of the mobile / application security review of the WeRide repo (React Native app, the four
feature modules, Firebase infra). Companion reports from the other workstreams:

- Realtime / routing server: [docs/security/server.md](security/server.md)
- Firestore rules, join codes, crew/group services: [docs/security/firestore.md](security/firestore.md)

Quick gate: `scripts/security-check.sh` (static checks + jest security suites + `npm audit` summary).
Regression tests: `app/__tests__/security.test.ts`, `app/__tests__/secureStorage.test.ts`,
`app/__tests__/secureRoot.test.tsx`, `modules/hazard-sos/test/storageOpener.test.ts`.

## 1. Scope and method

| Area | What was done |
|---|---|
| Dependencies | `npm audit` (prod and full) in `app`, `modules/{tracking,hazard-sos,routing-eta,fl-voice}`, `infra/firebase/{functions,seed,rules-test}`, `app/scripts/screenshots`. Non-breaking `npm audit fix` applied; every remaining advisory triaged for reachability (section 4). `modules/routing-eta/server` was audited read-only (owned by the server workstream). |
| Secrets | Working tree and all 91 revisions (`git log --all -p`, about 7.5 MB of diff, lockfiles and images excluded). Regexes: Mapbox `pk.`/`sk.`, `AIza...`, `"private_key"`, `-----BEGIN`, AWS/Slack/GitHub tokens, JWTs, `password/secret/api_key = "..."`, hosted-service URLs, plus a file-name sweep of every file ever added (`.env`, `google-services.json`, `GoogleService-Info.plist`, `*.jks`, `*.keystore`, `*.p12`, service-account JSON, keystore.properties). |
| Android | Manifest, Gradle, ProGuard/R8, network security, backup, exported components, permissions, library-merged manifests (read from `node_modules` and the `tslocationmanager` AAR). |
| iOS | `Info.plist`, ATS, usage strings, background modes, entitlements, privacy manifest, Podfile. |
| Data at rest | Inventory of every MMKV instance in `app/src` and `modules/*/src`; encryption via the platform keystore. |
| Code review | `Linking.openURL`, `eval`/`new Function`/WebView/`dangerouslySetInnerHTML`, randomness for codes, logging of tokens/PII, deep links, clipboard, push payloads, QR, phone auth. |
| Regression tests | See the list above. |

Not changed on purpose: the Node server and its clients, Firestore rules/join codes/`crewService`/`groupService`/seed,
orientation settings, and the Road/SOS screens being polished by other workers (issues in those are reported only).

## 2. Findings

Severity is the risk if the finding were left as is, in a shipped build. Status: **fixed** (in the tree and covered by a
test or a script check), **mitigated** (risk reduced, residual noted), **open** (needs a decision or a human).

| ID | Sev | Area | Description | Status | Where |
|---|---|---|---|---|---|
| S-01 | High | Android signing | Release build was signed with the public debug keystore (`signingConfigs.debug`): anyone could ship a "valid" update. | **fixed** | `app/android/app/build.gradle` (release signing config from untracked `android/keystore.properties`, Gradle properties `WERIDE_RELEASE_*` or env; any build that schedules a `:app:*Release*` task FAILS with a message if it is missing), `app/android/keystore.properties.example` |
| S-02 | Medium | Android hardening | No code shrinking/obfuscation, release was debuggable-by-default config. | **mitigated** (needs device verification, section 5) | `build.gradle` (`minifyEnabled`/`shrinkResources` true, `debuggable false`), `proguard-rules.pro` (keep rules for firebase, mapbox, webrtc, mmkv, keychain, background-geolocation, svg, sensors, geolocation, ML Kit, RN community libs) |
| S-03 | Medium | Android network | No network security config; debug manifest allowed cleartext to every host. | **fixed** | `res/xml/network_security_config.xml` (main: HTTPS only, system CAs only, user CAs not trusted), `src/debug/res/xml/network_security_config.xml` (cleartext only for `localhost`, `127.0.0.1`, `10.0.2.2`), `src/debug/AndroidManifest.xml` (no blanket flag), main manifest has no `usesCleartextTraffic` |
| S-04 | Medium | Android backup | `allowBackup=false` already, but no `fullBackupContent` / `dataExtractionRules`; if backup is ever enabled MMKV, auth state and the location DB would leave the device. | **fixed** | `AndroidManifest.xml`, `res/xml/backup_rules.xml`, `res/xml/data_extraction_rules.xml` (exclude root/file/database/sharedpref/external, cloud backup and device transfer) |
| S-05 | Medium | Data at rest | Emergency contacts + phone (`prefsStore`), last known position (`theme.lastfix`), in-progress GPS recording (`rideRecorder`), pending ride logs (`pendingLogs`), crew mute list, FL data and the app SOS/hazard queues were in plaintext MMKV. | **fixed** | `app/src/services/secureStorage.ts` (random MMKV key in Android Keystore / iOS Keychain via `react-native-keychain`, AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY, cached in memory; `<id>.enc` instances; verified copy-then-wipe migration; plain fallback with one warning, never throws), `app/src/SecureRoot.tsx` + `app/index.js` (key loaded before the app and its stores load), all stores migrated. Details in section 3. |
| S-06 | Medium | SOS queue | `modules/hazard-sos` offline queue (`offline_queue`) and per-group SOS OR-Set (`sos_orset_<group>`) held rider positions in plaintext MMKV. | **fixed** (small, tested) | `modules/hazard-sos/src/crdt/storageOpener.ts`, `localQueue.ts`, `orSet.ts`; the app registers its encrypted opener in `SecureRoot.tsx`. Falls back to plain MMKV if the opener throws (an SOS must never fail to persist). |
| S-07 | Low | Data at rest | `modules/tracking` (`ekfStore`, id `tracking`: last filtered position) and the shared HLC clock (`hlc`, not sensitive) are plaintext MMKV. | **open** | `modules/tracking/src/ekfStore.ts`. Fix recipe: same opener hook as S-06. The HLC id is shared between tracking and hazard-sos and must be changed in both together (or left plain: it is only a clock). |
| S-08 | Medium | Randomness | Ride join codes used `Math.random` (predictable, a code lets a stranger into a ride). | **fixed** in the app generator; **open** in three others | Fixed: `app/src/utils/joinCode.ts` (`crypto.getRandomValues` via the already-installed `react-native-get-random-values`, rejection sampling, throws rather than degrading). Still `Math.random`: `app/src/services/crewService.ts:33` `generateCrewCode`, `modules/routing-eta/src/group/groupService.ts:41` `generateJoinCode`, `infra/firebase/seed/seed-teamdsy.js` (random fallback code). Owned by the Firestore/join-code workstream; one-line change each, reuse `secureIndex` from `joinCode.ts`. |
| S-09 | Low | Logging / PII | `ridersStore` logged the whole rejected `location:update` payload (rider id, lat/lng). | **fixed** | `app/src/store/ridersStore.ts` now logs only the key names. A regression test fails on any `console.*`/`warn`/`logError` call whose arguments name token, password, otp, secret, phone, email, lat, lng, payload, contacts, number. Other logging reviewed: only error objects and static messages. `modules/tracking/src/demo.ts` prints coordinates but is a demo script, not in the bundle. |
| S-10 | Low | Injection | `smsLink(number, ...)` put the contact's number into `sms:` unvalidated (contacts sync through Firestore). | **fixed** | `app/src/services/sosFormat.ts` `smsRecipient()` keeps digits and one leading `+`; body was already `encodeURIComponent`-ed. `tel:` uses a constant (112). Maps URLs interpolate numeric lat/lng only. `SosSentOverlay.tsx` reviewed read-only: it passes the contact number to `smsLink`, so it is covered by the fix. |
| S-11 | Medium | Repo hygiene | `.gitignore` lacked `keystore.properties`, `*.p12`/`*.p8`/`*.pem`, `*.mobileprovision`, service-account JSON variants, `GoogleService-Info*.plist` variants, `.env.production` etc. | **fixed** | `.gitignore`, enforced by `scripts/security-check.sh` and `security.test.ts` |
| S-12 | Info | Secrets | **No real secret was ever committed** (tree and all 91 revisions). Hits were placeholders only (see below). | n/a | - |
| S-13 | Medium | Demo credentials | The seed script hard-codes a login: `teamdsy@weride.app` / `teamDSY@123` (`infra/firebase/seed/teamdsy-data.js`, `seed-teamdsy.js` header, `README.md`, test; present in history since the seed was added). Not an API secret, but a known password. | **open** | If this account ever existed in a production Firebase project: delete it or reset its password and rotate. Seed should read the password from an env var. (Seed is owned by the Firestore workstream.) |
| S-14 | Medium | iOS config | Info.plist had no `NSLocationAlways*` strings and no `UIBackgroundModes` although the app tracks in the background and receives SOS pushes (App Store rejection or silently no background tracking). | **fixed** | `Info.plist`: honest usage strings for location when-in-use / always, motion (crash detection), background modes limited to `location` + `remote-notification`. ATS: `NSAllowsArbitraryLoads=false`, no exception domains. |
| S-15 | Low | iOS ATS | `NSAllowsLocalNetworking=true` applies to release too (cleartext to `.local`/bare IPs). | **mitigated** (documented, flagged by the check script) | Remove or use a release-only Info.plist before App Store submission. |
| S-16 | Medium | iOS project | The Xcode project is still the RN template for release purposes: bundle id `org.reactjs.native.example.*`, no `.entitlements` (so no `aps-environment`: FCM push cannot work on iOS), no `GoogleService-Info.plist` wiring, no signing team. Data protection: default (`CompleteUntilFirstUserAuthentication`), which is the right class (see section 3) - do NOT set `NSFileProtectionComplete`, it breaks background tracking and SOS while the phone is locked. | **open** | Needs Xcode and an Apple developer account. |
| S-17 | Low | Android components | Library-provided exported components in the merged manifest: `TSLocationManagerActivity` (`exported=true`, background-geolocation, no intent filters) and the RNFirebase `ReactNativeFirebaseMessagingReceiver` (`exported=true`, protected by `com.google.android.c2dm.permission.SEND`, correct). The app itself exports only `MainActivity` (launcher, no data/VIEW filters, no deep links). | **open** (recommend override) | Candidate hardening: `<activity android:name="com.transistorsoft.locationmanager.activity.TSLocationManagerActivity" android:exported="false" tools:node="merge"/>` - only after testing the notification/launch flows on a device. |
| S-18 | Low | Android permissions | The app now declares exactly: INTERNET, FINE/COARSE/BACKGROUND location, RECORD_AUDIO, POST_NOTIFICATIONS, FOREGROUND_SERVICE(+_LOCATION), WAKE_LOCK, VIBRATE, HIGH_SAMPLING_RATE_SENSORS (crash detector). `USE_BIOMETRIC`/`USE_FINGERPRINT` merged by react-native-keychain are removed. Libraries still merge: `ACTIVITY_RECOGNITION`, `RECEIVE_BOOT_COMPLETED`, `SCHEDULE_EXACT_ALARM`, `ACCESS_WIFI/NETWORK_STATE`, vendor permissions (oppo/huawei) from `tslocationmanager`. | **mitigated** | Inspect the merged manifest (`app/build/intermediates/merged_manifests/release/AndroidManifest.xml`); remove with `tools:node="remove"` the ones the product does not use (`SCHEDULE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED` if "start on boot" and the scheduler are not used). Not removed blind: the library may require them. |
| S-19 | Info | Android foreground service | Voice (WebRTC) while backgrounded would need `FOREGROUND_SERVICE_MICROPHONE`; not declared (voice is foreground-only today). `react-native-webrtc` merges a `mediaProjection` service (screen-share, unused). | **open** (note) | Remove with `tools:node="remove"` if screen share is not a feature. |
| S-20 | Medium | Dependencies | See section 4. Non-breaking fixes applied. Remaining advisories are overwhelmingly dev tooling (Metro, RN CLI, jest); none is critical. | **mitigated** | lockfiles |
| S-21 | High | Server deps | `modules/routing-eta/server`: 1 critical (`proxy-addr` IP spoofing via IPv4-mapped IPv6 trust subnet) and 1 high (`engine.io` protocol DoS) production advisories; `npm audit fix` (non-breaking) resolves them, plus `qs`/`express`/`body-parser`. | **open** (owner: server workstream) | `cd modules/routing-eta/server && npm audit fix`; matters if `trust proxy` is set (per-IP rate limiting). `scripts/security-check.sh` fails on it until fixed. |
| S-22 | Medium | Cloud Function | `infra/firebase/functions/index.js` (`onSosCreate`): trusts `group_id`/`rider_id` of the new `sos_events` doc (safe only if the rules force `rider_id == auth.uid` and membership - verify in the Firestore report); puts exact coordinates in the notification text (visible on a locked screen; intended, but state it in the privacy notice); uses `sendMulticast` (removed in firebase-admin 13+); N+1 Firestore reads per member; no `package-lock.json` (versions floated) - one was generated and added. | **open** | Review with the Firestore workstream; move to `sendEachForMulticast`, restrict who may create `sos_events`. |
| S-23 | Info | Mapbox token | The public `pk.` token is read from `app/.env` (`react-native-dotenv`) and is therefore inside the JS bundle (expected for a public token). The Mapbox **download** token (`sk.`) is read only from the Gradle property `MAPBOX_DOWNLOADS_TOKEN`, not in the repo. | **mitigated** | Restrict the public token (URL/bundle id/package scopes, no secret scopes) and rotate it before launch; keep the `sk.` token in CI secrets. Note `docs/SETUP_CREDENTIALS.md` calls the variable `MAPBOX_ACCESS_TOKEN` while the code reads `MAPBOX_TOKEN`. |
| S-24 | Medium | Transport | `app/src/services/endpoints.ts` falls back to `http://10.0.2.2:3000` / `http://localhost:3000` if `ROUTING_URL`/`SOCKET_URL` are unset. In a release build that fails closed (network security config and ATS block cleartext), but it is a misconfiguration trap. | **mitigated** | Set both to `https://` URLs for release; consider a build-time assertion. |
| S-25 | Info | Deep links / push / QR / clipboard | No deep-link surface: no `linking` config, no `getInitialURL`/URL listeners, no custom scheme, no `VIEW`/`BROWSABLE` filters, no `CFBundleURLTypes`. No JS push handler (`onMessage`, `setBackgroundMessageHandler`): the FCM `data` payload (`group_id`, `sos_id`) is not consumed by the app, so there is no payload-trust issue today. QR is generate-only (`qrcode-generator`); there is no scanner, so no QR ingestion. Clipboard is write-only (join codes). No WebView, `eval`, `new Function`, `dangerouslySetInnerHTML`. | n/a (asserted by tests) | If deep links / push handling / a QR scanner are added: validate every field (id charset and length), never navigate or write on an unauthenticated payload, and re-run `security.test.ts` (it will fail until the new surface is reviewed). |
| S-26 | Info | Phone auth | OTP abuse (SMS pumping, enumeration) is throttled by Firebase only. | **open** | Enable Firebase App Check (Play Integrity / DeviceCheck), tighten the Authentication SMS region policy and quotas, add reCAPTCHA/App Check enforcement on Auth and Firestore. |
| S-27 | Low | Build | `debug.keystore` is referenced by `build.gradle` but is not tracked (`*.keystore` is gitignored), so a fresh clone cannot build debug until one is created. | **open** (doc) | `keytool -genkey -v -keystore app/android/app/debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"` (the debug key is public by convention; keep it out of git). |
| S-28 | Low | Screen privacy | SOS/ride screens show position and phone numbers and are captured in the app switcher; no `FLAG_SECURE`. | **open** (accepted risk, decision) | Optional; `MainActivity.kt` is being edited by another workstream. |
| S-29 | Low | Monorepo resolution | `modules/hazard-sos/package.json` pins `react-native-mmkv ^4` and its own `node_modules` has v4, while the app ships v2.12. Metro is restricted to the app's `node_modules` (`nodeModulesPaths`) but hierarchical lookup is not disabled, so verify the bundle resolves the app's copy (a v4 import would not match the native module). | **open** (verify) | `metro.config.js`: `resolver.disableHierarchicalLookup = true`, or align the versions. Not a vulnerability; a correctness/data-at-rest risk if wrong. |

### Secret scan hits (all benign)

| Path / commit context | Match | Verdict |
|---|---|---|
| `app/android/build.gradle` (history: android bootstrap commit) | comment `MAPBOX_DOWNLOADS_TOKEN=sk.eyJ1...` | placeholder in a comment |
| `app/jest.setup.js`, tests | `pk.test-mapbox-token-placeholder`, `pk.test-token` | test placeholders |
| `app/.env.example` | `your_mapbox_access_token_here`, `10.0.2.2` URLs | template, tracked on purpose |
| `infra/firebase/seed/*` | `teamdsy@weride.app` / `teamDSY@123` | **S-13** demo login |
| mock/test auth objects | `rider@weride.app`, `+919876543210` | fake data |

No `google-services.json`, `GoogleService-Info.plist`, keystore, service-account JSON, `.env` or `.firebaserc` was ever added.
**Nothing needs rotating because of the git history.** Rotate before launch anyway: the Mapbox public token (restrict it) and
any Firebase API key restrictions, once the real `google-services.json` exists (section 6).

## 3. Data at rest (how it works, what to verify)

- `react-native-keychain@^9.2.3` was added (none was installed). Run `cd app/ios && pod install` for iOS; Android autolinks.
- `secureStorage.ts`: the key is 16 random characters (MMKV encrypts with AES-128 and **caps `encryptionKey` at 16 bytes**,
  so a 32-byte key is not possible; 96 bits from `crypto.getRandomValues`, never `Math.random`). It is stored with
  `ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` so SOS and the ride recorder still work with the phone locked and the key is not
  restored on another device. A freshly generated key is only used if it can be read back from the keystore (otherwise data
  encrypted with it would be unreadable after a restart).
- `SecureRoot` awaits `initSecureStorage()` and only then requires `App`, because the stores read their cache while their
  module loads (prefs, theme). Key access stays synchronous afterwards.
- Migration per instance id, once per process: old unencrypted `<id>` is read, each value copied into `<id>.enc` and verified,
  then the old instance is wiped with `clearAll()`. If anything fails the old data stays and the copy is retried next launch;
  data still present in the old instance wins (it can only be there because a previous launch fell back to plain storage).
  Supported value types: strings (all current callers), with best-effort buffer/number/boolean.
- Fallback (keystore throws, key cannot be persisted, key not loaded, encrypted open fails): one warning, plain instance, the app
  keeps working and a ride recording or SOS is never dropped. The next launch with a working keystore migrates what was written.
- MMKV's AES-CFB gives confidentiality, not integrity; it protects against file extraction (backup, rooted/forensic copy, other
  apps on a compromised device), not against code running inside the app.
- Known limit: if the keystore key is lost while `*.enc` files remain, MMKV discards what it cannot decrypt (every store is a
  cache of server data or a short-lived buffer).

## 4. Dependency advisories

`npm audit` counts as critical/high/moderate/low, after `npm audit fix` (non-breaking).

| Project | Production (`--omit=dev`) | All | Notes |
|---|---|---|---|
| `app` | 0/18/19/0 (was 0/20/20/0) | 0/44/21/0 (was 0/46/22/0) | fixed: brace-expansion, compression, image-size, joi, others |
| `modules/tracking` | 0/0/0/0 | 0/36/5/0 | dev only |
| `modules/hazard-sos` | 0/24/11/0 | 0/47/13/0 | |
| `modules/routing-eta` (src) | 0/9/1/0 | 0/36/6/0 | |
| `modules/fl-voice` | 0/18/11/0 | 0/48/13/0 | |
| `infra/firebase/functions` | 0/2/8/0 | same | no lock existed; one was generated and added |
| `infra/firebase/seed` | 0/0/8/0 | same | admin SDK chain |
| `infra/firebase/rules-test` | 0/0/0/0 | 0/6/6/0 | emulator tests only (undici) |
| `app/scripts/screenshots` | 0/0/0/0 | 0/0/0/0 | |
| `modules/routing-eta/server` | 1/1/11/0 | not touched | **S-21**, owner server workstream |

Reachability of what remains:

| Advisory group | Where it runs | Reachable in the shipped app / functions? | Action |
|---|---|---|---|
| `braces`, `micromatch`, `metro*`, `@react-native/*` (codegen, babel-preset, community-cli-plugin), `@react-native-community/cli*`, `jscodeshift`, `jest-*`, `@jest/*`, `cosmiconfig`, `js-yaml`, `argparse`, `sprintf-js`, `fast-xml-parser` (CLI), `image-size` (Metro asset server), `compression` | developer machine / CI (bundler, CLI, test runner) | **No.** They process the developer's own source and config, not attacker input, and are not in the APK/IPA. DoS-type issues only. | Fixed upstream only by React Native 0.87 (major). Take with the next planned RN upgrade; do not bump blindly. |
| `react-native` itself | listed because of the tooling above | Runtime is the RN 0.73.x line | RN upgrade planned separately |
| `@react-navigation/*` -> `query-string` -> `decode-uri-component` (DoS on malformed percent-encoding) | **in the app bundle** (URL/state parsing) | Only reachable through deep-link/state-from-path parsing. The app has no linking config, so it is effectively **unreachable** today. | Fix needs react-navigation 7 (major). Revisit if deep links are added. |
| `uuid` (v3/v5/v6 with a caller-supplied buffer) | app bundle | **No.** Code uses `v4()` only, never with `buf`. | Major bump to v14 not needed |
| `firebase`, `@firebase/firestore*`, `@grpc/grpc-js` (module hazard-sos) | `modules/hazard-sos` dev install pulls the web `firebase` SDK via `@react-native-firebase/app@26`; the shipped app uses the native SDKs of `@react-native-firebase/app@19` | **No.** The module's `node_modules` are for its own jest run; the advisory (server-side mTLS `getAuthContext`) is not a client path. The "fix" npm proposes is a downgrade. | Align module and app versions (S-29) |
| `firebase-admin` chain (`@google-cloud/*`, `google-gax`, `uuid`, `gaxios`, `teeny-request`, `retry-request`) in `functions` and `seed` | Cloud Functions runtime / developer seed script | `uuid` buffer issue: not used with `buf`. `node-forge` (high, RSA PKCS#1 v1.5 signature verification) in `functions`: part of `firebase-admin`; the function never verifies third-party signatures. Low practical exposure. | Move to `firebase-admin@14` / `firebase-functions@7` after testing (breaking: v1 API, `sendMulticast`) |
| `undici` (rules-test) | emulator tests | No | - |

## 5. What could NOT be tested here

- **Gradle / Android build**: no Android SDK or Gradle was available. `build.gradle`, ProGuard rules, manifests and XML resources
  were checked for well-formedness (XML parsed) and by the static assertions in `security.test.ts`, never compiled. Verify:
  1. `./gradlew assembleRelease` with no credentials FAILS with the "Release signing is not configured" message; with
     `android/keystore.properties` filled in it succeeds; `apksigner verify --print-certs app-release.apk` shows your key, not
     `CN=Android Debug`. `./gradlew assembleDebug` still works (needs the debug keystore, S-27).
  2. R8: install the release APK and exercise: phone sign-in, Firestore listeners, FCM token, Mapbox map and route, start/stop a
     ride (background geolocation), voice join (WebRTC), SOS (hold), crash detector (sensors), QR render (svg), relaunch (MMKV +
     Keychain). On `ClassNotFoundException`/`NoSuchMethodError`/`UnsatisfiedLinkError`, map it with `mapping.txt` and add a keep
     rule. The rules are deliberately broad; narrow them one library at a time afterwards. Upload `mapping.txt` to Play Console.
  3. `react-native-keychain@9.2.3` compiles with Kotlin 1.8.0 / AGP 8.x here (it needs Java 17 and `datastore-preferences`); if it
     does not, pin `8.2.0`.
  4. Debug: Metro over a LAN IP is now blocked (cleartext limited to localhost/10.0.2.2); use `adb reverse tcp:8081 tcp:8081`
     (and `tcp:3000` for the server) on physical devices.
  5. Merged manifest: confirm the permission list and exported components (S-17, S-18).
- **iOS / Xcode**: no Xcode. `Info.plist` was only parsed as a plist. Run `pod install`, archive, check the privacy report, and
  confirm Apple accepts the background modes. Not checked: `NSCameraUsageDescription` (react-native-webrtc references camera APIs; add
  the string if App Store Connect flags it), entitlements, signing.
- **Device-only behaviour**: that Keychain/Keystore really persists the key across reboot, upgrade and "locked after first unlock"
  background starts; AES-encrypted MMKV files on disk (`strings` on `files/mmkv/*.enc` of a debug build should show no readable
  JSON); background tracking and SOS with the screen off; push delivery.
- **Real Firebase**: phone auth abuse limits, App Check, Cloud Function behaviour, rules against the real project. Rules are tested in
  the emulator by the Firestore workstream.
- **Deployed server**: no live pen-test (see the server report).

Evidence that was possible: `tsc --noEmit` clean; eslint clean on all touched source files; jest for `app` (suites touched and new),
`modules/hazard-sos` (141 tests), `modules/tracking` (114), `modules/routing-eta` (46), `modules/fl-voice` (6) after dependency
fixes; `scripts/security-check.sh`.

## 6. Residual risk

1. Plain-fallback path: if the keystore is broken on a device, the caches stay unencrypted on that device (logged once).
2. Third-party native SDKs (background-geolocation, WebRTC, Mapbox, Firebase) are trusted; their exported components and
   permissions are only as tight as their manifests (S-17/S-18).
3. No certificate pinning: TLS relies on the system trust store (user CAs are rejected on Android). A device with a malicious
   system CA could intercept. Decision recorded in the checklist.
4. No App Check yet: anyone can call Firebase Auth / Firestore with the public API key (rules still apply).
5. No root/jailbreak or tamper detection; spoofed GPS is handled by the tracking module's anti-spoofing, not by platform attestation.
6. A join code is a bearer secret; its entropy depends on the generator in use (S-08 open items) and on server-side expiry/rate limits.
7. Exact positions are delivered in the SOS push text and by SMS to the rider's own contacts by design.
8. Dev-tooling advisories remain until React Native is upgraded.
9. Screen capture / app switcher can show positions (S-28).

## 7. Pre-release checklist

- [ ] Generate the upload keystore, store it and its passwords in a secret manager, enrol in Play App Signing; fill
      `android/keystore.properties` (or CI env `WERIDE_RELEASE_*`). Build with `assembleRelease`/`bundleRelease` and verify the signer.
- [ ] Rotate before launch: Mapbox public token (restrict by bundle id/package, remove unneeded scopes), Mapbox download (`sk.`) token held only in CI;
      restrict the Firebase/Google API keys (Android package + SHA-256, iOS bundle id) once `google-services.json` /
      `GoogleService-Info.plist` exist. Delete or reset the `teamdsy@weride.app` demo account in the production project (S-13).
- [ ] Enable Firebase **App Check** (Play Integrity on Android, DeviceCheck/App Attest on iOS), enforce it on Auth, Firestore, and Functions; enable Play
      Integrity API in Play Console; set Authentication SMS region policy and quotas.
- [ ] Deploy Firestore rules **after** the data backfill described in [docs/security/firestore.md](security/firestore.md); run the rules tests in the emulator first.
- [ ] `cd modules/routing-eta/server && npm audit fix`, then re-run `scripts/security-check.sh` (S-21); pen-test the deployed server
      (auth bypass, cross-group access, rate limits, CORS) using [docs/security/server.md](security/server.md); set `ROUTING_URL`/`SOCKET_URL` to `https://`.
- [ ] Decide on certificate pinning. Recommended: pin the SPKI of the intermediate CA (not the leaf) for the backend host with at least
      one backup pin and an expiry, via the Android `<pin-set>` in `network_security_config.xml` and TrustKit/`NSPinnedDomains` on iOS, only once the
      production hostname is fixed. Do not pin Google/Mapbox/Firebase hosts.
- [ ] iOS: real bundle id and team, `aps-environment` entitlement, `GoogleService-Info.plist`, remove `NSAllowsLocalNetworking` for the store build,
      keep default data protection, run `pod install`, check the privacy manifest.
- [ ] Android: decide on `TSLocationManagerActivity` `exported=false` (S-17), remove unused merged permissions (S-18), confirm R8 build on
      real devices (section 5), keep `mapping.txt`.
- [ ] Replace the remaining `Math.random` join/crew code generators (S-08), review the SOS Cloud Function (S-22), move tracking EKF state to encrypted storage (S-07).
- [ ] Run `scripts/security-check.sh` and the full `npx jest` in CI on every release branch.
