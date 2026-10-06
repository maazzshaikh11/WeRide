# Realtime / routing server: security

Scope: `modules/routing-eta/server` (Express REST + Socket.io default namespace + `/vox`) and the app plumbing
that talks to it (`app/src/services/socketService.ts`, `app/src/services/idToken.ts`,
`modules/routing-eta/src/client/routingClient.ts`, `modules/fl-voice/src/fl/flClient.ts`,
`modules/fl-voice/src/vox/voxClient.ts`).

## 1. Threat model

| Asset | Attacker | Goal |
|---|---|---|
| Live rider positions (`location:update`) | Anyone who can reach the port (no account needed) | Track riders of any group, stalk a specific rider |
| Group integrity (positions, quick signals) | A legitimate rider of group A, or an anonymous client | Inject fake positions / "Need fuel" / "Pull over" into group B, impersonate another rider |
| Voice channel (`/vox`) | Any connected socket | Eavesdrop on, or inject SDP/ICE into, another group's voice room |
| Mapbox token budget (`POST /route`) | Anonymous bots | Burn paid Mapbox + CPU through the open endpoint |
| FL aggregation (`/fl/*`) | Anonymous or malicious rider | Poison the global model, flood the aggregator |
| Server availability | Anyone | 10 MB bodies, event floods, socket exhaustion, garbage-token floods |
| Rider privacy | Browser page on another origin | Cross-origin calls to the API (`cors()` was `*`) |

Trust boundaries: the network (hostile), the client (the app is not trusted: `rider_id`, `group_id` and every
payload field are claims, not facts), Firebase Auth (trusted to say who a uid is) and Firestore
`groups/{id}.member_ids` (trusted to say who belongs to a group).

Out of scope here: Firestore rules (`firestore.rules`), mobile build config, app screens.

## 2. What was found (original behaviour)

All verified against the pre-fix code and reproduced with a script that runs the old server:

```
OLD: unauthenticated eavesdropper received 2 location updates
OLD: victim received 2 injected/spoofed update(s) from a socket that never joined, rider_id= carol
OLD: unauthenticated POST /route -> 200 ; ACAO = * ; x-powered-by = Express
```

| # | Finding | Original behaviour |
|---|---|---|
| F1 | No authentication anywhere | `io.on('connection')` accepted every socket; no middleware; REST had none |
| F2 | Anyone can join any group | `join-group` did `socket.join('group:'+id)` for any string, no membership check; the joiner then received every rider's `location:update` |
| F3 | Cross-group injection | `location:update` was emitted to the room named by the **payload's** `group_id` (`socket.to(room(payload.group_id))`) even if the sender had never joined that room |
| F4 | Identity spoofing | `rider_id` in `location:update` and `signal:send` was whatever the client claimed and was relayed verbatim |
| F5 | `/vox` open, and addressable by socket id | `join(groupId)` with no check, `socket.join(groupId)` used the raw string as a room name (so `join(<victim socket id>)` joined the victim's private room); `sdp`/`ice` relayed to `payload.targetId` with no check that the target is in your group; no validation, no size caps |
| F6 | Open CORS + 10 MB bodies | `app.use(cors())` (`Access-Control-Allow-Origin: *`), Socket.io `cors:{origin:'*'}`, `express.json({limit:'10mb'})` |
| F7 | No rate limiting | `/route` (Mapbox cost), `/fl/submit`, socket events: unlimited |
| F8 | Weak payload validation | `lat`/`lng` only checked to be finite numbers (no range); no caps on string lengths; extra fields forwarded to the group verbatim; no speed/heading/accuracy checks |
| F9 | Error and header leaks | `handleRoute` returned `e.message` on 500; `X-Powered-By: Express`; no security headers |
| F10 | FL identity | `/fl/submit` trusted `client_id` in the body |

## 3. What was fixed

| Finding | Fix | Where |
|---|---|---|
| F1 | Every connection and request is authenticated with the rider's **Firebase ID token**: Socket.io handshake `auth.token` (default namespace and `/vox`), `Authorization: Bearer <idToken>` on REST. Socket middleware refuses with `unauthorized`; REST answers 401. Verified with firebase-admin `verifyIdToken`. Fail-closed: with no verifier installed every attempt fails and the server refuses to start. | `security/auth.js`, `security/sockets.js`, `security/http.js`, `security/firebase.js` |
| F2 | `join-group` only if the verified uid is in `groups/{id}.member_ids` (Firestore, cached `MEMBERSHIP_TTL_MS`, invalidated on failure, fail-closed on errors). Group ids are validated (`[A-Za-z0-9_-]{1,128}`) so a hostile id can never become a Firestore path. At most 10 groups per socket. | `security/auth.js` (`MembershipCache`), `app.js` |
| F3 | The room a payload is forwarded to must be a room **this socket joined**; membership is re-checked (cached) on each event so a removed member is dropped from the room within the TTL. | `app.js` (`authorise`) |
| F4 | `payload.rider_id` must equal the verified uid, otherwise the event is rejected and counted (`stats.spoof_rejected`). Relayed signals carry the server-attested uid. | `app.js` |
| F5 | `/vox`: same token check; `join` requires group membership; rooms are namespaced (`vox:<group>`) so socket ids can no longer be joined as rooms; `sdp`/`ice` only to a target that is in the sender's own vox room (not self); 16 KB cap on signalling payloads; `voice_active` must be a boolean; rate limited. | `vox_signaling.js` |
| F6 | CORS allow-list from `ALLOWED_ORIGINS` (default: none, `*` is ignored), same allow-list for Socket.io; native apps need no CORS. JSON body limit 64 kb (`/fl/submit`: 256 kb), oversize answers 413 and happens **after** authentication so anonymous callers cannot make the server read or parse bodies. Socket.io `maxHttpBufferSize` 64 KB. | `security/http.js`, `security/config.js`, `app.js` |
| F7 | In-memory token buckets: per connection **and** per uid for socket events (`location:update` 5/s burst 10, `signal:send` 1/s burst 10, `join-group` 10/min, `/vox` events 20/s); per uid on REST (`/route` 30/min, `/fl/submit` 10/min, `/fl/global` 30/min), 429 + `Retry-After`; failed authentications are charged per IP (valid riders behind the same NAT are never throttled); at most `MAX_SOCKETS_PER_UID` (10) sockets per uid; events from one socket are processed serially with a bounded queue. | `security/token_bucket.js`, `security/sockets.js`, `security/http.js` |
| F8 | Strict validation + whitelisting: finite `lat` in [-90,90], `lng` in [-180,180]; id/hlc length caps (128 / 64); `speed_mps` within +-200, `heading_deg` bounded then normalised to [0,360) (the EKF heading is unwrapped), `accuracy_m` 0..100000, `nis_score` 0..1e9, `spoof_flag` boolean; only whitelisted fields are forwarded. `/route`: coordinate ranges, <= 200 active hazards, <= 32 avoid types. | `security/validation.js`, `astar.js` |
| F9 | Generic error bodies (`{"error":"internal error"}`, no stack, no message echo), `X-Powered-By` removed, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cache-Control: no-store`, CSP `default-src 'none'`, HSTS. Auth failures are logged as `[auth] rejected ...` with the reason only: never the token, never the uid. | `security/http.js`, `astar.js` |
| F10 | `/fl/*` require a verified rider; `client_id` is overwritten with the verified uid. | `app.js` |
| Never open | `startServer()` refuses to start (exit 1) when no verifier is configured, in **every** environment. In production `FIREBASE_PROJECT_ID` plus credentials are mandatory. `ALLOW_INSECURE_DEV_AUTH=1` (accepts `dev:<uid>`, prints a loud warning) is **refused when `NODE_ENV=production`**, both at config load and by rejecting an insecure verifier at startup. | `security/config.js`, `security/auth.js`, `index.js` |

Client plumbing (public APIs unchanged; new optional `getToken` constructor params for tests):

* `app/src/services/idToken.ts`: `getIdToken(forceRefresh?)` from `auth().currentUser.getIdToken()`, and
  `authedFetch()` which adds `Authorization: Bearer <token>` and, on a 401, force-refreshes the token and retries once.
* `socketService.ts`: both sockets (default and `/vox`) use `createAuthedSocket()`: `auth` is a **function**, so
  every connect and reconnect fetches a fresh token; after an `unauthorized` handshake the next attempt force-refreshes;
  a server-initiated disconnect (token expired mid-session; socket.io does not auto-reconnect these) reconnects with a
  fresh token. `voxClient` receives its socket from `getVoxSocket()`.
* `routingClient.ts` and `flClient.ts` use `authedFetch()`.
* Sockets whose ID token has expired are disconnected by the server (`exp` claim), which is what triggers the refresh above.

The app's solo route-planning request uses the pseudo group `plan-<uid>`; the server accepts that only for that uid.

## 4. Configuration

| Variable | Default | Meaning |
|---|---|---|
| `NODE_ENV` | unset | `production` enables the production checks. `test` is used by the test suite (no listener). |
| `FIREBASE_PROJECT_ID` (or `GOOGLE_CLOUD_PROJECT`) | none | Firebase project whose ID tokens are accepted. Required in production. |
| `GOOGLE_APPLICATION_CREDENTIALS` | none | Path to a service-account JSON (Firestore membership lookup). |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | none | Alternative: the service-account JSON inline (secret manager). |
| `FIREBASE_USE_ADC` | none | `1` to use Application Default Credentials (Cloud Run / GCE attached service account). One of the three credential options is required in production. |
| `ALLOW_INSECURE_DEV_AUTH` | unset | `1` = accept `dev:<uid>` tokens, any dev user may join any group (or set `DEV_GROUP_MEMBERS='{"g1":["alice"]}'`). Local development only. **Refused under `NODE_ENV=production`.** To exercise the real app against a dev server, set `FIREBASE_PROJECT_ID` + credentials instead (the app sends real Firebase tokens). |
| `ALLOWED_ORIGINS` | none | Comma-separated browser origins allowed by CORS and Socket.io. `*` is ignored. Native apps do not need this. |
| `TRUST_PROXY` | unset | `1` when behind a reverse proxy: per-IP failure limits use `X-Forwarded-For`. Only set it when the proxy overwrites that header. |
| `BODY_LIMIT` / `FL_BODY_LIMIT` | `64kb` / `256kb` | JSON body limits (oversize = 413). |
| `MEMBERSHIP_TTL_MS` | `30000` | Group-membership cache lifetime. Also the delay before a removed member loses the room. |
| `MAX_SOCKETS_PER_UID` | `10` | Concurrent sockets per uid (both namespaces). |
| `RL_LOCATION_BURST` / `RL_LOCATION_PER_SEC` | `10` / `5` | `location:update`, per connection and per uid. |
| `RL_SIGNAL_BURST` / `RL_SIGNAL_PER_SEC` | `10` / `1` | `signal:send`. |
| `RL_JOIN_BURST` / `RL_JOIN_PER_MIN` | `10` / `10` | `join-group` and vox `join`. |
| `RL_VOX_BURST` / `RL_VOX_PER_SEC` | `50` / `20` | vox `sdp` / `ice` / `voice_active`. |
| `RL_ROUTE_PER_MIN` | `30` | `POST /route` per uid. |
| `RL_FL_SUBMIT_PER_MIN` / `RL_FL_GLOBAL_PER_MIN` | `10` / `30` | `/fl/submit`, `/fl/global` per uid. |
| `RL_AUTH_FAIL_PER_MIN` | `20` | Failed authentications per client IP before 429. |

## 5. Deployment checklist

- [ ] Terminate TLS in front of the server (load balancer / reverse proxy). Tokens travel in headers and the
      handshake: plain `http://`/`ws://` is for local development only. The app must use `https://`/`wss://` URLs.
- [ ] Run behind a reverse proxy / managed ingress that also enforces connection and request limits; set `TRUST_PROXY=1`
      only if that proxy sets `X-Forwarded-For`.
- [ ] `NODE_ENV=production` (the Dockerfile sets it). Confirm startup fails without credentials.
- [ ] `FIREBASE_PROJECT_ID` plus `GOOGLE_APPLICATION_CREDENTIALS` / `FIREBASE_SERVICE_ACCOUNT_JSON` / `FIREBASE_USE_ADC=1`.
      The service account needs read access to `groups/*` in Firestore (`roles/datastore.viewer`) and nothing else.
- [ ] Never set `ALLOW_INSECURE_DEV_AUTH` outside a developer machine.
- [ ] Leave `ALLOWED_ORIGINS` empty unless a web client exists; list exact origins, never `*`.
- [ ] Keep `MAPBOX_ACCESS_TOKEN` in the secret store and restrict it by URL/scope in Mapbox.
- [ ] Enable **Firebase App Check** for the app (Play Integrity / App Attest) and enforce it for Auth/Firestore. The
      next step for this server is verifying the App Check token (`X-Firebase-AppCheck` / handshake) with
      `getAppCheck().verifyToken`, so a stolen-but-valid ID token cannot be replayed from a script.
- [ ] Single instance or sticky sessions: rate limits, membership cache and rooms are per process. For multiple
      replicas add the Socket.io Redis adapter and a shared limiter before scaling out.
- [ ] Alert on `stats.auth_rejected`, `spoof_rejected`, `join_denied`, `rate_limited` (exposed on the exported `ctx.stats`).

## 6. Tests

`cd modules/routing-eta/server && npm test` (163 tests). Attack-style suites, each asserting the attack is refused:

* `test/security_sockets.test.js`: unauthenticated / garbage / forged / oversize token connect (both namespaces), join a
  group you are not in (with and without ack, hostile ids), membership outage fails closed, location spoof, cross-group
  injection, injection without joining, removed member loses the room, absurd payloads, field smuggling, signal spoof,
  cross-group signal, arbitrary label, token expiry disconnect, `/vox` non-member join, SDP/ICE to a socket outside the
  group, joining a socket id as a room, oversize SDP, location/signal floods, per-uid limit across reconnects,
  join brute force, per-uid socket cap, garbage-token flood.
* `test/security_rest.test.js`: `/route` and `/fl/*` without / with bad tokens, non-member group, `plan-<uid>` scoping,
  hostile group id, membership outage (503, no leak), 64 kb / 10 MB / anonymous oversize bodies, malformed JSON,
  absurd coordinates, CORS from an arbitrary origin, wildcard ignored, headers, per-uid 429, `/fl/submit` flood,
  garbage-token flood, token never in logs.
* `test/startup.test.js`: the real `node index.js` refuses to start in production without a verifier, in production with
  `ALLOW_INSECURE_DEV_AUTH=1`, without credentials, and with no opt-in at all; the dev opt-in starts with a warning.
* `test/auth.test.js`, `test/token_bucket.test.js`, `test/validation.test.js`: units (verifier, membership cache TTL /
  negative refresh / failure invalidation, bucket maths with a fake clock, memory bound under key rotation).
* App/modules: `app/__tests__/idTokenAuth.test.ts` (token attached, refreshed on 401, fresh per reconnect, refresh after
  `unauthorized`, server-initiated reconnect, `/vox`), `modules/routing-eta/test/routingClientAuth.test.ts`,
  `modules/fl-voice/test/flClientAuth.test.ts`.

## 7. Residual risks

* A valid ID token for a real member can still be replayed from a script until App Check is enforced. Server-side
  limits bound the damage (rate limits, validation, membership).
* ID tokens are verified without revocation checks (`checkRevoked`) to avoid an Auth round trip per connection. A
  revoked/disabled user keeps access until the token expires (<= 1 h); the server drops sockets at token expiry.
* Membership changes take up to `MEMBERSHIP_TTL_MS` (30 s) to apply to live sockets.
* Rate limits and rooms are in-memory and per process (see the checklist for scaling out). A distributed attacker with
  many valid accounts is limited per account, not globally.
* Socket.io does not enforce `Origin` on WebSocket upgrades. That is intentional: React Native sends a synthetic
  `Origin` header, so rejecting on Origin would break the app. Cross-site WebSocket hijacking is not possible because
  authentication is a token in the handshake `auth` payload (no cookies).
* Group location is still visible to every member of the group (by design). A member can share it out of band.
* `/vox` relays signalling only; media is peer-to-peer with the public Google STUN server (rider IPs are visible to
  group peers by design of WebRTC).
* `/fl/submit` is a stub; once real aggregation exists it needs its own schema validation, per-round quotas and
  outlier/poisoning defences beyond authentication.
* The server does not verify that a reported position is physically plausible (teleport detection); `spoof_flag` is
  client-reported.
