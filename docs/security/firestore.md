# Firestore security rules: findings, fixes and model

Scope: `infra/firebase/firestore.rules`, the emulator tests in `infra/firebase/rules-test`, and the app / module code that had
to change with them. Status: **fixed and covered by tests**; see "Deployment" before shipping (a data migration must run first).

## 1. Evidence

`infra/firebase/rules-test/attack.test.js` holds 110 tests named `attack: ...`. Each asserts that a hostile read or write is
**denied**, and each is the smallest variant of something a legitimate flow does (`rules.test.js`, 27 tests, proves the
legitimate flow works). The same suite was run against the previous rules (`git show HEAD:infra/firebase/firestore.rules`, kept
as `rules-test/old-rules.fixture.rules`):

| Rules | Attack tests denied (good) | Attacks that SUCCEEDED | Legitimate-flow tests |
|---|---|---|---|
| Old (HEAD) | 37 | **73 of 110** | 20 of 27 pass (the 7 that fail need `join_codes`) |
| New | **110 of 110** | 0 | **27 of 27** |

Of the 37 attacks the old rules already denied, 10 involve `join_codes` (a collection that did not exist, so default-deny) and
27 were genuinely protected (private settings and ride logs, rsvp / roll call / presence of other riders, SOS `rider_id` forging, report
`rider_id` forging on create, deletes, `routes` / `fl_rounds` writes).

Reproduce:

```
cd infra/firebase
# new rules (137 tests)
npx --yes firebase-tools@13.35.1 emulators:exec --only firestore --project demo-weride "npm --prefix rules-test test"
# old rules: shows the 73 attacks that used to work (the run is expected to FAIL)
npx --yes firebase-tools@13.35.1 emulators:exec --only firestore --project demo-weride "npm --prefix rules-test run test:old"
# seed + a real-rules integration test through the REST API (8 tests)
npx --yes firebase-tools@13.35.1 emulators:exec --only auth,firestore --project demo-weride "node --test seed/test/seed.emulator.test.js"
# the join-code backfill (6 tests)
npx --yes firebase-tools@13.35.1 emulators:exec --only firestore --project demo-weride "node --test migrations/test/backfill.emulator.test.js"
```

## 2. Findings (old behaviour, impact, severity)

| # | Old behaviour | Impact | Severity |
|---|---|---|---|
| 1 | `crews` and `groups`: `allow read` for **every** signed-in user | Any account could list every crew and ride (names, plans, meetup points, member uids) and read every `join_code`. Because codes were also the only secret guarding joins, anyone could join any crew or ride, then read its live locations. | **High** |
| 2 | `crews` / `groups` update: the "join" clause only required the new `member_ids` to contain the old ones plus the caller | A non-member could change **any field** in the same write as adding themselves: `name`, `created_by`, `roles` (make themselves lead), `join_code`, `ride_plan`, `status`. A member could rewrite `created_by`, `roles`, `join_code`, `ride_plan`, `status` and could drop other members. No schema, so a crew or ride could be given arbitrary fields. | **Critical** |
| 3 | `groups/*/locations`, `sos_events` (+ `responders`), `hazards`, `hazard_reports`: readable by every signed-in user | Live rider positions and SOS coordinates of every ride were visible to any account (stalking / safety). | **High** |
| 3b | `sos_events` update: any signed-in user with `resolved != null`; `hazards` create / update: any signed-in user with a string `group_id`; `groups/*/reports` update: any member; `locations` write had no membership check | Anyone could **silence anyone's SOS** (set `resolved`), rewrite its position, plant or edit hazard clusters in any ride, vote "gone" in another rider's name, rewrite another rider's hazard report, or put a ghost rider marker in any ride. | **High** (SOS tampering is safety-critical) |
| 4 | `users/{uid}`: the owner could write any field of any size | Unbounded strings on a profile every rider can read; stat inflation. | Low / Medium |
| 5 | `crews` / `groups` create: no schema; `groups` create only required the caller to be *in* `member_ids` | Huge arrays / strings (cost, document-size abuse); a ride could be created with **other people already in it** (forced membership: it shows in their list and they become members). | Medium |
| 6 | `hazard_reports` (legacy top-level): any signed-in user could create arbitrary documents and everyone could read them; no client uses it | Free write sink, data leak. | Medium |
| 7 | `routes` readable by every signed-in user | No client reads it; the comment said "group members". | Low |

## 3. The fix: how the rules work now

### Join codes are not enumerable
`join_codes/{CODE} = { kind: 'crew' | 'ride', target_id }`.

* `allow get` for any signed-in user (a code is only usable if you already know it: 31^6, about 887M combinations),
  `allow list: if false`.
* **create**: only the *creator* of the target, only when the target's `join_code` equals the code, and only with exactly the
  two fields. The check uses `getAfter()` on the target, so the app writes the crew / ride and its code document in **one
  batch**. A code document can never be overwritten (create on an existing doc is an update, which is creator-only and cannot
  change `kind` / `target_id`), so a code cannot be hijacked or pre-claimed for somebody else's target.
* **delete**: the target's creator only.

### Crews (`crews/{id}`)
* **read / list**: members only (`uid in member_ids`; the app's `where member_ids array-contains uid` query is accepted).
* **create**: `created_by == uid`, `member_ids == [uid]`, `roles` only `{uid: 'lead'}`, schema below.
* **join** (non-member): the write changes only `member_ids` (adds exactly the caller; at most 100 members) and `join_proof`,
  and `join_proof == resource.join_code + ':' + uid`.
* **leave** (member): removes exactly the caller (and the caller's own role); nothing else changes.
* **creator edit**: `name`, `roles` (keys must be members, values `lead` / `sweep`), `join_code`. `created_by` and
  `member_ids` never change through an edit (no ownership transfer, no kicking).
* never deleted.

### Rides (`groups/{id}`)
* **read / list**: members, plus the members of the ride's crew (so a crew can show its next ride; see deviations).
* **create**: `created_by == uid`, `status` absent or `planned`, no `join_proof` / `started_ms` / `finished_ms`, schema below.
  The member list is only the creator, or (for a crew ride) the creator plus people who are members of **that crew**; the
  creator must be in the crew.
* **join / leave**: as for crews.
* **status**: any member may advance the ride one step along `planned -> meetup -> live -> finished` (a missing status counts
  as `planned`), changing only `status` and, for the steps that carry one, `started_ms` (to `live`) / `finished_ms`
  (to `finished`). No skipping, no going back, no extra fields, a stranger cannot.
* **creator edit**: `name`, `join_code`, `ride_plan`, `ride_type`, `pace`, `start_time_ms`, `meetup`, `invited_ids`,
  `active_ride_id`. `created_by`, `crew_id`, `member_ids` never change through an edit.
* Subcollections, all membership-checked with `get()` on the ride:

  | Path | Read | Write |
  |---|---|---|
  | `rsvp/{rider}`, `roll_call/{rider}`, `presence/{rider}` | members | the rider's **own** doc, fixed keys and enum values |
  | `locations/{rider}` | members | the rider's own doc, `rider_id == uid`, `group_id` is the path's group, valid lat / lng |
  | `reports/{id}` | members | create: `rider_id == uid`, `group_id` is the path's group, valid type / coordinates. Update: only by the same rider (the offline sync worker re-sends with `.set()`). No delete. |

### Hazards, SOS, server-owned
* `hazards/{id}`: read / create / update need membership of the document's `group_id` (the app's queries
  `where group_id == X [and status == 'active']` are accepted). `group_id` cannot be changed, the schema is enforced, and a
  `gone_votes` write may only **add the caller's own uid** (a re-cluster may reset the list). No delete.
* `sos_events/{id}`: read needs membership of the event's `group_id` (query `where group_id == X` accepted). Create: as
  yourself (`rider_id == uid`), `resolved == false`, member of `group_id`, valid coordinates. Update: **the sender only**, only
  `resolved` / `resolved_at_hlc`. No delete. `responders/{rider}`: ride members read, a rider writes only their own doc
  (`going` / `arrived`).
* `routes`: server-written; readable only by members of the ride in its `group_id` (no client reads it today). `fl_rounds`:
  aggregate model metadata, readable by signed-in users, server-written. `hazard_reports` (legacy): closed, nothing uses it.

### Schema guards
Enforced on create and on creator edits:
crew / ride `name` 1..60 chars, `member_ids` 1..100, `join_code` six characters of the code alphabet, `roles` only
`lead` / `sweep` for members, ride `status` enum, `pace` enum, `ride_type` <= 20, `ride_plan` keys fixed with `stops` <= 30,
`route.path` <= 400, start / destination / meetup labels <= 120, `invited_ids` <= 100, no unknown top-level fields.
`users/{uid}`: only `name` (1..24), `bike` (<= 40), `style` (Relaxed / Steady / Spirited), `created_ms`, `stats`
(`km` / `rides` / `together_sum`: numbers, 0 to a sane maximum). Hazard clusters, SOS events, reports, locations and
presence documents have fixed key sets with enum / range checks. `users/{uid}/private/*` is owner-only (<= 30 keys).
The app clips ride names (60) and place labels (120) before writing so it never trips these limits.

## 4. Deviations from the brief (and why)

1. **`join_proof` is `"<CODE>:<uid>"`, not the bare code.** The proof field stays in the document after the first join. With
   a bare code, a second stranger could send *no proof* and the rule would compare the **stored** proof from the first joiner
   to the code and pass. Binding the proof to the caller's uid closes that (tests: "re-uses the proof an earlier joiner left").
2. **`join_codes` create is creator-only and requires `target.join_code == code`** (the brief said "a member of the target").
   A member could otherwise register an alias code the join rule would never accept, and "creator + matching code" is what
   prevents squatting a code on someone else's target.
3. **Members of a crew can read the crew's rides** even if they have not joined the ride. The Join / Crew screens query
   `groups where crew_id == X` to show the next ride; strictly member-only reads would silently break that. Subcollections
   (locations, SOS, ...) stay ride-member-only. A rider outside the crew still sees nothing.
4. **Ride invitees at creation** are allowed when they are members of the ride's crew (`createRide` adds `invitedIds` to
   `member_ids` today). Everyone else must join with the code.
5. **`created_by` and `crew_id` are immutable** for everybody, including the creator (no ownership transfer feature exists).
6. **Same-status writes are refused** (`finished -> finished`). `ArriveScreen` now skips the write when the ride is already
   `finished`, so a second rider arriving does not produce a denied write.
7. **Raw-group-id joins are removed.** `GroupService.joinGroup` accepts a six-character code only; an id alone is useless
   under the new rules and the legacy path is gone (and with it the `isJoinCode`-else-raw-id branch).

## 5. App, module and seed changes

| File | Change |
|---|---|
| `app/src/services/joinCodes.ts` (new) | `lookupJoinCode`, `joinProof`, `createWithJoinCode` (target + code doc in one batch, retries on a lost race for a code) |
| `app/src/services/crewService.ts` | `createCrew` writes the code doc in the same batch; `joinCrewByCode` resolves `join_codes/{CODE}`, then updates with `arrayUnion(uid)` + `join_proof`; `findRideByCode` resolves via `join_codes` (a stranger only learns the id, a member sees the ride) |
| `app/src/services/rideService.ts` | `createRide` writes the code doc in the same batch; clips name (60) and labels (120) |
| `app/src/screens/garage/JoinScreen.tsx` | after joining a ride, re-reads it (now a member) for the success card |
| `app/src/screens/road/ArriveScreen.tsx` | does not write `finished` twice |
| `modules/routing-eta/src/group/groupService.ts` | `createGroup` batch + code doc; `joinGroup` by code with proof; raw-id join removed; name clipped |
| `infra/firebase/seed/*` | writes a `join_codes` doc per crew / ride; `--remove` deletes them; emulator test checks codes, the stranger's view and rules-conformance of the seeded data |
| `infra/firebase/migrations/backfill-join-codes.js` (new) | the one-off migration below |
| Tests | `rules-test/{helpers,attack,rules}.test.js`, `app/__tests__/{crewService,rideService,joinCodes,crewScreens}.test.*`, `modules/routing-eta/test/groupService.test.ts` (+ its Firestore mock now plays the join / read rules) |

The Cloud Function (`onSosCreate`) and the Node server use the Admin SDK, which bypasses rules: no change needed.

## 6. Deployment

The rules and the app must go out together, and the data migration must run **before** the rules:

1. **Backfill** (existing crews / rides have no `join_codes` docs; without them their codes stop working the moment the rules
   go live):
   ```
   cd infra/firebase/migrations && npm install
   GOOGLE_APPLICATION_CREDENTIALS=./key.json node backfill-join-codes.js --project <project-id> --dry-run   # read the plan
   GOOGLE_APPLICATION_CREDENTIALS=./key.json node backfill-join-codes.js --project <project-id>
   ```
   It is idempotent and never overwrites a code doc. It re-codes a ride whose code was shared with a crew (the crew keeps it;
   report the new ride code to its creator), gives codes to legacy rides that have none, upper-cases codes, and lists
   documents that exceed the new schema limits (name > 60, > 100 members, ...; not changed: they only matter if their creator
   edits them). Run it again right before step 3 to catch anything created in between.
2. **Release the app build** that writes `join_codes` and joins with `join_proof`.
3. `firebase deploy --only firestore:rules` (from `infra/firebase`).

Order matters in both directions: the new app **fails** to create crews / rides on the old rules (no `join_codes` match), and
the old app **fails** to join or create on the new rules. If old builds are in the field, deploy in two phases instead: first
the old rules plus only the `match /join_codes/{code}` block (purely additive, old behaviour unchanged), release the app, wait
for adoption (or force-update), then deploy the hardened rules. Roll back by redeploying the previous rules file
(`git show HEAD:infra/firebase/firestore.rules`); the `join_codes` docs are harmless to leave in place.

## 7. Residual risks

* **Join-code guessing (the main one).** A code is 6 of 31 characters (887M). Rules cannot rate-limit reads, and every signed-in
  account may `get` any `join_codes/{CODE}`. With *N* live codes an attacker needs about 887M / *N* probes per hit: 1,000 live
  codes is about 887k probes, 100,000 live codes about 8.9k (minutes at a few dozen reads per second, and probes are billed
  reads). A hit lets them join that crew or ride. Mitigations, in order of value: (1) **enable App Check** (Play Integrity /
  App Attest) with enforcement on Firestore so scripted clients cannot probe; (2) move lookups behind a callable Cloud Function
  that applies **per-uid and per-IP rate limits** with lock-out after repeated misses, and make `join_codes` server-only;
  (3) **expire codes**: delete a ride's code doc when it finishes (a Cloud Function on `status == 'finished'`), let creators
  rotate crew codes; (4) lengthen new codes to 8 characters (about 8.5e11); (5) alert on a spike in `join_codes` reads.
* **`users/{uid}` is readable by every signed-in rider** (name, bike, style, ride totals). It is intentionally public inside
  the app (profiles are fetched for crew members by id), but it is enumerable by uid-guessing or by `list`. If that matters,
  move the profile into the crew documents or a callable.
* **Trust inside a ride.** A ride member can advance the status early (`planned -> ... -> finished`, one step at a time),
  re-cluster / resolve a hazard without two votes (the "two riders say it is gone" rule is client-side), edit any hazard
  cluster of their ride, and raise spurious SOS events for the ride. Membership is the trust boundary. Tightening
  (lead-only `live`, server-side clustering and vote counting) needs server logic.
* **Per-element size.** Rules cannot loop, so labels inside `ride_plan.stops[]` and the contents of `route.path` are bounded
  by count (30 and 400) and the 1 MiB document limit, not per element.
* **Orphans and stale codes.** When the last member leaves, the crew / ride and its `join_codes` doc remain, unreadable.
  A creator who has left can no longer edit (the edit rules require membership).
* **Self-reported stats and locations.** `stats` are bounded but self-written; location documents are validated for shape
  and range only (spoofing is handled by the on-device NIS check, not the rules).
* **Pre-existing documents** that break the new schema (see the backfill warnings) keep working for reads, joins, leaves and
  status steps; creator edits of them are refused until fixed.
