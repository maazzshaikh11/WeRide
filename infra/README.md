# Infra

Firebase project config, CI workflows, Cloud Functions.

## CI

GitHub Actions workflow is at `ci/ci.yml`. Copy or symlink it to `.github/workflows/ci.yml`:

```bash
mkdir -p .github/workflows
cp infra/ci/ci.yml .github/workflows/ci.yml
```

CI runs per-module (lint + unit tests on push). Broken CI blocks merge (per spec §10).

## Firebase

- `firebase/firestore.rules` — security rules for all collections
- `firebase/functions/index.js` — Cloud Function for SOS FCM push
- `firebase/firebase.json` — emulator config

## Local dev with Firebase Emulator

```bash
cd infra/firebase
firebase emulators:start --only firestore,auth
```

Use the emulator for local dev to avoid hitting free-tier limits (per spec §13 risk mitigation).