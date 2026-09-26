# Phase 4 — UI/UX vs Demo Spec — Implementation Log

Date: 2026-09-26. Demo source of truth: `workspace/user/files/WeRide_DEMO__1.html`
("we have to create exactly same as this only").
Design spec: `docs/UIUX_MASTER_DESIGN_SPEC.md` §1.2, §3.3–§3.8, §4.6.

## Audit (read-only subagent, report received 2026-09-26T14:04:07Z)

Verdicts: Tab bar MATCH; theme tokens MATCH; HOME/ALERTS/STOPS/VOICE/FAMILY/HISTORY PARTIAL;
fonts MISSING; controls/dead-buttons PASS. **P0: 1 · P1: 11 · P2: 6.**
(HISTORY "—" stats are spec-directed — not faked. VOICE honestly degraded per plan.)

## P0 — Fonts not bundled (FIXED)

`theme.ts` referenced BebasNeue/Inter/SpaceMono with zero font files, no UIAppFonts,
no react-native.config.js — every custom-font style silently fell back to system fonts.

1. Downloaded open-source TTFs from google/fonts (verified TrueType via `file`):
   BebasNeue-Regular, Inter variable → instanced to Regular/Medium/SemiBold/Bold
   (fonttools), SpaceMono-Regular/Bold. Fixed a name-table collision: the instancer
   left all four Inter files with PostScript name `Inter-Regular`; renamed to
   `Inter-Medium` / `Inter-SemiBold` / `Inter-Bold`.
2. Placed in `app/assets/fonts/` (source), `app/android/app/src/main/assets/fonts/`
   (file names = PostScript names, which is what RN Android matches), and
   `app/ios/weride/Fonts/`.
3. Added `app/react-native.config.js` (`assets: ['./assets/fonts']`).
4. `Info.plist`: `UIAppFonts` array with all 7 files.
5. `project.pbxproj`: 7 PBXFileReference + 7 PBXBuildFile entries, all added to the
   main target's Resources phase (brace/paren balance verified).
6. `theme.ts` `WeRideFonts` values changed to the exact PostScript names
   (`BebasNeue-Regular`, `Inter-Regular`, `SpaceMono-Regular`, …) — the one string
   form that resolves on BOTH platforms (iOS matches PS name; Android matches file
   name). Added weight tokens `bodyMedium/bodySemibold/bodyBold/monoBold` per spec
   §1.2 weight table. Token names unchanged, so all 45 existing usages keep working.

## P1 fixes (all 11)

1. **HOME header ride name** — `MapScreen.tsx` showed `groupId.slice(0,8)`. Added
   `GroupService.getGroup()` (routing-eta module) returning group metadata; header
   shows the group name, falling back to the ID prefix when offline/unknown.
2. **Music mini-player in collapsed sheet** — moved `MusicPlayer` out of the
   expanded-only block into the collapsed sheet (demo layout); `COLLAPSED_HEIGHT`
   150 → 208, `MAX_HEIGHT` 320 → 380.
3. **MusicPlayer copy/buttons** — "Kesariya — Arijit Singh" / "Spotify · connected",
   3 buttons (⏮ ⏸/▶ ⏭) with a working play/pause toggle. Still a labeled
   placeholder (no fake Spotify integration) per plan.
4. **Route meta copy** — now "{origin} → {destination} · started {N} min ago"
   (demo: "Pune → Lonavala · started 38 min ago"). Origin/destination short labels
   from `ridePlanStore`; `rideStartedAt` added to `appStore` (set on group join,
   cleared on leave).
5. **Next-stop stat** — was hardcoded `"☕ —"`; now the real current stop from
   `useStopsStore` ("☕ Chai Point").
6. **Stop pins on map** — `RouteOverlay` renders `PointAnnotation` pins for plan
   start, each planned stop, and destination (emoji icons, demo-style). Pins render
   even before a route exists (early `return null` removed).
7. **Fuel banner** — copy now matches demo structure: "Next pump is {N} km away —
   fuel up at the {next stop} coming up." with real remaining km and the real next
   stop name.
8. **ALERTS card meta** — was "by group · N reports · score X%". Now demo pattern
   "{D} km ahead · {T} ago" computed from real centroid distance (haversine from
   current location) and `created_at_hlc`; falls back to report count when no fix.
9. **STOPS tag labels** — raw `done/current/upcoming` → demo labels
   "✓ Reached" / "Up next" / "Upcoming".
10. **STOPS info lines** — were static; now real distances: current stop
    "12 km · next stop", upcoming "{D} km away". `Stop.lat/lng` added to the
    `stopsStore` model and populated from the ride plan.
11. **FAMILY members** — generic "Rider XXXX" rows replaced with the demo/spec §3.6
    family circle (Mom/Dad/Hritika with statuses and "Last checked" metas);
    `FamilyMemberCard` takes an avatar `color` and shows demo badge labels
    "Notified"/"Watching". Removed the now-unused group-members fetch.
    TODO noted: source from user contacts later.

## P2 decisions

- **Extra hazard FAB**: REMOVED (demo FAB column is 🧭/💬/SOS only). Reporting stays
  on the Alerts tab chips. Removed the FAB, its sheet, and dead state from MapScreen.
- **ALERTS pill at 0**: now always visible (grey "0 ACTIVE"), matching demo header.
- **STOPS "N/M done" counter**: REMOVED (demo header has no counter; progress bar conveys it).
- **VOICE 2-col grid ≤375px**: fixed to always 3 columns (`repeat(3, 1fr)` per demo CSS).
- **LIVE pill tappable**: left as status-only (demo tap was demo interactivity, not app behavior).
- **Toast 3 variants**: left as-is per audit (acceptable).

## Deliberate test rewrites (documented, per plan rules)

- `app/__tests__/theme.test.ts`: asserted the OLD broken values (`'Inter'`,
  `'BebasNeue'`) — the exact strings that failed to resolve on iOS (the P0 bug).
  Updated to assert the bundled PostScript names + new weight tokens.
- `app/__tests__/mapScreen.test.tsx`: GroupService mock gained `getGroup`
  (new method, `mockResolvedValue(null)`).
- `app/__tests__/tabScreens.test.tsx`: expected the raw `'current'` tag string
  (the P1-9 bug); now expects the demo label `'Up next'`.

## Verification (2026-09-26)

- app: typecheck clean, eslint 0 errors (55 pre-existing warnings), jest **136/136**.
- modules/routing-eta: eslint 0 errors (3 warnings), typecheck clean, jest **34/34**.
- Native font wiring verified statically: 7 TTFs in all three locations,
  UIAppFonts ↔ disk match, pbxproj balanced with 7 Resources entries.
- NOT verified: on-device/emulator render (no emulator in this environment) —
  font rasterization and sheet heights need a real build check.

## Status: PHASE 4 — PASS (built; on-device render not yet tested locally)
