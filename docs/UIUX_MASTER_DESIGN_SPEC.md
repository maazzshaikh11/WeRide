# WeRide UI/UX Master Design Specification

Single source of truth for the entire WeRide application UI/UX.
Reference: `WeRide_DEMO (1).html` for visual language only (not navigation flow).

---

## 1. DESIGN SYSTEM

### 1.1 Colors

| Token | Hex | Usage |
|---|---|---|
| `dark` | `#0A0A0A` | Page background |
| `dark2` | `#111111` | Screen/card inner background |
| `dark3` | `#1A1A1A` | Card, stat-box, button-fill background |
| `muted` | `#333333` | Sheet handle, muted borders |
| `border` | `#2A2A2A` | All card borders, dividers, input borders |
| `primary` | `#FF5C00` | Primary accent (orange). Active tab, route line, stat highlights, badges, buttons |
| `primaryDim` | `#FF5C0022` | Primary at 8% opacity. Badge backgrounds, button tints |
| `text` | `#F0F0F0` | Primary body text |
| `textSub` | `#888888` | Secondary/muted text |
| `white` | `#FFFFFF` | Speech bubbles, ride names, avatar borders |
| `green` | `#22C55E` | Live pills, "safe" badges, done stops, VOX ring active |
| `greenDim` | `#22C55E18` | Green at ~10% opacity. Badge backgrounds |
| `red` | `#FF3B3B` | SOS button, SOS modal, stale/SOS pulse |
| `redDim` | `#FF3B3B1F` | Red at ~12% opacity. SOS bubble backgrounds |
| `blue` | `#3B82F6` | Navigation FAB, "watching" status |
| `gold` | `#FBBF24` | Fuel banner, weak resilience |
| `pink` | `#EC4899` | Rider color (Hritika, Mom) |
| `purple` | `#A855F7` | Rider color (Maaz) |
| `teal` | `#14B8A6` | Rider color (Piyush) |

**Semantic aliases** (map to above for specific contexts):

| Semantic | Value | Notes |
|---|---|---|
| `safetyGood` | `#22C55E` | Safety score >= 0.7 (was `#2D6A4F`, now matches demo green) |
| `safetyCaution` | `#FBBF24` | Safety score 0.4–0.7 (was `#FFD60A`, now matches gold) |
| `safetyPoor` | `#FF3B3B` | Safety score < 0.4 (was `#E63946`, now matches red) |
| `riderVerified` | `#22C55E` | Fresh verified (was green `#2D6A4F`, now demo green) |
| `riderFlagged` | `#FF3B3B` | Spoofed (was `#E63946`, now demo red) |
| `riderStale` | `#9AA0A6` | Stale (>10s) — unchanged |
| `hazardPothole` | `#FB8500` | Unchanged |
| `hazardOilSpill` | `#5C4033` | Unchanged |
| `hazardAccident` | `#FF3B3B` | Unchanged (was `#E63946`, mapped to demo red) |
| `hazardDebris` | `#FBBF24` | Unchanged (was `#FFD60A`, mapped to gold) |
| `hazardOther` | `#9AA0A6` | Unchanged |
| `hazardResolved` | `#9AA0A655` | Unchanged |
| `voxActive` | `#22C55E` | Mic active (was `#40916C`) |
| `voxIdle` | `transparent` | Mic idle |
| `surface` | `#1A1A1A` | Card/panel bg (was `#FFFFFF`) |
| `background` | `#0A0A0A` | Page bg (was `#F8F9FA`) |
| `error` | `#FF3B3B` | Error/SOS (was `#E63946`) |
| `onPrimary` | `#FFFFFF` | Text on primary/accent |

**Legacy colors to remove**: `#1B4332`, `#2D6A4F`, `#40916C` (old green theme). All replaced by orange/green/dark theme above.

### 1.2 Typography

| Token | Family | Size | Weight | Letter-spacing | Usage |
|---|---|---|---|---|---|
| `display` | Bebas Neue | 38px | 400 | — | Page-level title only |
| `heading` | Bebas Neue | 24px | 400 | — | Screen titles (`.scr-title`) |
| `headingLg` | Bebas Neue | 22px | 400 | — | Modal headings |
| `statValue` | Bebas Neue | 19px | 400 | — | Stat box values |
| `statValueLg` | Bebas Neue | 22px | 400 | — | History stat values |
| `body` | Inter | 13px | 400 | — | Default body text |
| `bodySemibold` | Inter | 13px | 600 | — | Ride names, card titles |
| `bodyBold` | Inter | 13px | 700 | — | Emphasized body |
| `caption` | Inter | 10px | 400 | — | Secondary info, subtitles |
| `captionMedium` | Inter | 10px | 500 | — | Toast text |
| `captionSemibold` | Inter | 10.5px | 600 | — | Fuel/network banner text |
| `small` | Inter | 9px | 400 | — | Tab labels, hint text |
| `badge` | Space Mono | 10px | 700 | — | Live pills, rider initials, eyebrows |
| `badgeSmall` | Space Mono | 8px | 700 | — | Avatar stack initials |
| `badgeMicro` | Space Mono | 7.5px | 700 | — | Stale badge |
| `eyebrow` | Space Mono | 9px | 400 | 0.1em | Screen eyebrow labels |
| `mono` | Space Mono | 10px | 400 | — | Data values, technical labels |
| `button` | Inter | 12.5px | 700 | — | Button labels |
| `input` | Inter | 14px | 400 | — | Text input body |

**Font loading**: Bebas Neue and Inter must be bundled as custom fonts. Space Mono must be bundled. Register in `react-native.config.js` and `Info.plist` / `android/app/src/main/assets/fonts/`.

**Fallbacks**: If custom fonts fail to load — Bebas Neue → system bold sans-serif, Space Mono → system monospace, Inter → system default sans-serif (Roboto on Android, San Francisco on iOS).

### 1.3 Spacing Scale

| Token | Value | Usage |
|---|---|---|
| `xs` | 4px | Tight gaps, icon padding |
| `sm` | 8px | Card inner gaps, stat row gaps |
| `md` | 12px | Standard padding, list item vertical |
| `lg` | 16px | Screen horizontal padding, section gaps |
| `xl` | 20px | Card padding, bottom sheet padding |
| `2xl` | 24px | Screen top/bottom safe area padding |
| `3xl` | 36px | Page-level vertical margins |

### 1.4 Border Radius

| Token | Value | Usage |
|---|---|---|
| `sm` | 6px | Stale badge |
| `md` | 8px | Buttons, inputs, signal options, share button, report chips |
| `lg` | 10px | Stat boxes, icon buttons, hazard chips |
| `xl` | 12px | Cards, info popups, alert cards, modal buttons, music bar |
| `2xl` | 14px | Family cards, history cards, link rows |
| `3xl` | 18px | Modal box |
| `pill` | 99px | Live pills, toasts, status badges, toggle, progress bar, bottom sheet handle |
| `full` | 50% | Avatars, FABs, voice buttons, rider dots, stop nodes |

### 1.5 Elevation/Shadows

| Level | Shadow | Usage |
|---|---|---|
| `low` | `0 1px 3px rgba(0,0,0,0.12)` | Cards, list items |
| `medium` | `0 2px 8px rgba(0,0,0,0.18)` | Bottom sheet, FABs |
| `high` | `0 4px 16px rgba(0,0,0,0.25)` | Modals, popups |
| `sosPulse` | `0 0 9px rgba(255,59,59,0.6)` | SOS marker animation |

### 1.6 Iconography

All icons use **emoji** for the prototype reference. Production will use:
- **Tab icons**: Custom SVG or Material Community Icons (closest match)
- **In-app icons**: Emoji for rapid iteration (already in demo), optionally swap to icon font later
- **Map markers**: Custom SVG markers (rider dots, hazard pins, stop pins)

| Context | Emoji (prototype) | Production Icon Name |
|---|---|---|
| Home tab | 🏠 | `home` |
| Stops tab | 📍 | `map-marker` |
| Voice tab | 🎙️ | `microphone` |
| Family tab | 👪 | `account-group` |
| Alerts tab | ⚠️ | `alert` |
| History tab | 🏆 | `trophy` |
| Nav FAB | 🧭 | `navigation-variant` |
| Signal FAB | 💬 | `message-text` |
| SOS FAB | Text "SOS" | Custom red circle with "SOS" |
| Hazard types | 🕳️🐄👮🌧️ | Custom hazard icons |
| Stop types | ☕⛽🍽️🏁 | Custom stop icons |
| Leader crown | 👑 | `crown` |
| Music | 🎵 | `music` |
| Link | 🔗 | `link-variant` |
| Share | 📤 | `share-variant` |

---

## 2. NAVIGATION STRUCTURE

### 2.1 Auth Flow (pre-main-app, Stack Navigator)

```
LoginScreen → GroupListScreen → [MainApp Tab Navigator]
```

This flow is **preserved exactly as-is** from the current implementation. No changes to authentication or group selection.

### 2.2 Main App (Tab Navigator, after group selected)

6 tabs, bottom navigation:

| # | Tab | Icon | Label | Screen Component |
|---|---|---|---|---|
| 1 | Home | 🏠 | HOME | `MapScreen` (existing, redesigned) |
| 2 | Stops | 📍 | STOPS | `StopsScreen` (new) |
| 3 | Voice | 🎙️ | VOICE | `VoiceScreen` (new) |
| 4 | Family | 👪 | FAMILY | `FamilyScreen` (new) |
| 5 | Alerts | ⚠️ | ALERTS | `AlertsScreen` (new) |
| 6 | History | 🏆 | HISTORY | `HistoryScreen` (new) |

**Tab bar style**:
- Background: `#0d0d0dee` (dark with alpha)
- Border-top: 1px `#2A2A2A`
- Height: ~56px content + safe-area-inset-bottom
- Active tab: icon + label in `#FF5C00`, icon shifts up 2px
- Inactive tab: icon + label in `#888888`
- Label font: Space Mono 9px, uppercase

**Navigation library**: `@react-navigation/bottom-tabs` + `@react-navigation/stack` (already installed).

**Group context**: When entering the main app, `groupId` is stored in `appStore`. All 6 tabs share this context.

---

## 3. SCREEN SPECIFICATIONS

### 3.1 LoginScreen

**Preserved from current implementation. Style changes only.**

**Layout**: Full-screen, `#0A0A0A` background, centered content, horizontal padding `lg` (16px).

**Elements** (top to bottom):
1. **Logo area**: WeRide wordmark. Font: Bebas Neue 32px, `#FF5C00`. "RIDE" portion in primary orange.
2. **Subtitle**: "Group riding, safer together." Font: Inter 12px, `#888888`. Margin-top: `sm` (8px).
3. **Email input**: Height 48px, background `#1A1A1A`, border 1px `#2A2A2A`, border-radius `md` (8px), padding 12px, text color `#F0F0F0`, placeholder `#888888`. Margin-top: `3xl` (36px).
4. **Password input**: Same style as email. Secure entry. Margin-top: `md` (12px).
5. **Sign In button**: Height 48px, background `#FF5C00`, border-radius `md` (8px), text "Sign In" in Inter 14px 700 `#FFFFFF`. Margin-top: `lg` (16px). Pressed: opacity 0.85.
6. **Error text**: Inter 12px, `#FF3B3B`, centered, margin-top `md` (12px). Hidden when no error.
7. **Loading state**: Button text changes to "Signing in…", button disabled (opacity 0.6), ActivityIndicator `#FFFFFF`.

**Auth flow** (unchanged):
- On success: `setUserId(uid)`, `navigation.replace('Groups')`
- On error: display error message

**Data source**: `firebaseAuth.signInWithEmailAndPassword`, `useAppStore.setUserId`

---

### 3.2 GroupListScreen

**Preserved from current implementation. Style changes only.**

**Layout**: Full-screen, `#0A0A0A` background.

**Elements** (top to bottom):
1. **Header**: "My Rides" — Bebas Neue 28px, `#F0F0F0`, padding `lg` horizontal, `md` top.
2. **Join row**: Horizontal layout, padding `lg` horizontal. Input (flex: 1) + Join button.
   - Input: same as login but `#1A1A1A` bg
   - Join button: bg `#1A1A1A`, border 1px `#2A2A2A`, text "Join" in Inter 12px 700 `#FF5C00`. On press: bg `#FF5C0022`.
3. **Group list**: FlatList. Each item:
   - Card: `#1A1A1A` bg, border 1px `#2A2A2A`, border-radius `2xl` (14px), padding `md` (12px), margin-bottom `sm` (8px).
   - Group name: Inter 13px 700 `#F0F0F0`
   - Member count: Inter 10px `#888888`
4. **Empty state**: Vertical center. "No rides yet" Inter 16px 600 `#F0F0F0`. "Create one or join using a code" Inter 13px `#888888`.
5. **FAB**: Bottom-right, 56×56, `#FF5C00` bg, white "+" text 28px, border-radius `full`, elevation `medium`.

**Data source**: `GroupService.myGroups()` Firestore subscription, `GroupService.createGroup()`, `GroupService.joinGroup(code)`.

---

### 3.3 Home / MapScreen (Main screen, most complex)

**Layout**: Full-screen map with overlaid UI elements. No scroll. `#0A0A0A` status bar area.

**Elements** (layer order, bottom to top):

**Layer 0 — Map**: MapboxGL MapView, dark style, full-screen.

**Layer 1 — Map overlays** (inside MapView):
- `RiderMarkerOverlay` — colored circles with initials
- `HazardOverlayMapLayer` — hazard clusters (polygons + markers)
- `SosOverlayMapLayer` — pulsing red SOS markers
- `RouteOverlay` route line — `#FF5C00`, 4px width, 0.8 opacity

**Layer 2 — Floating overlays** (outside MapView, absolute positioned):

#### 3.3.1 Screen Header (top)
- Position: top 0, left 0, right 0, z-10
- Background: linear gradient `#0A0A0A` → transparent, height ~80px
- Eyebrow: Space Mono 9px `#FF5C00`, uppercase, letter-spacing 0.1em: "Ride Overview"
- Title: Bebas Neue 24px `#F0F0F0`: group name (from `appStore.groupId` first 8 chars or group name if available)
- **Live pill**: Positioned right of title. 9px `#FF5C00`, bg `#FF5C0022`, border 1px `#FF5C00`, rounded pill. States:
  - Connected: red dot + "LIVE"
  - Reconnecting: gold dot + "SYNCING"
  - Offline: grey dot + "OFFLINE"

#### 3.3.2 FL Status Badge (top-left, below header)
- Position: absolute, top 80px, left 16px
- Pill: bg `#00000099`, border-radius `pill` (99px), padding 6px 12px
- Text: Space Mono 10px `#F0F0F0`: "Your ride data stays on your device"
- FL round state: "FL round 3 done · 4 clients" (from `FlRoundLogger.latestRound()`)

#### 3.3.3 Toast Container (top, below header)
- Position: absolute, top 14px from below header, left 12px, right 12px, z-60
- Toast items: bg `#161616f5`, border 1px `#2A2A2A`, border-radius `pill`, padding 9px 14px, Inter 11.5px 500
- Variants:
  - Green toast: border `#22C55E55`, text `#b9f0ce`, icon ✅
  - Red toast: border `#FF3B3B55`, text `#ffb4b4`, icon 🆘
  - Gold toast: border `#FBBF2455`, text `#fde68a`, icon 📡
- Auto-dismiss: 2600ms, slide-in animation 0.3s cubic-bezier(0.4,1.4,0.5,1)

#### 3.3.4 Fuel Banner (top, conditional)
- Position: absolute, top 12px from below header, left 12px, right 12px
- Bg: `#1a1404f0`, border 1px `#FBBF2444`, border-radius `xl` (12px), padding 10px 12px
- Icon: ⛽ 16px
- Text: Inter 10.5px `#fde68a`, bold segments in `#FBBF24`
- Close button: ✕ 13px `#fde68a` opacity 60%, positioned right
- Shown when: nearest fuel stop > 50km away (or driver-specified threshold)
- Slide-in: translateY -120% → 0, 0.4s cubic-bezier(0.4,1.4,0.5,1)

#### 3.3.5 Network Banner (top, conditional)
- Position: below fuel banner
- Bg: `#14140bf5`, border 1px `#FBBF2455`, border-radius 13px, padding 11px 13px
- States:
  - Lost: icon 📡, text "Maaz lost connection. Showing last known location." in `#fde68a`
  - Recovered: icon ✅, text "Maaz is active again. Position resynced." in `#bbf7d0`, border `#22C55E55`
- Data source: Socket.io connect/disconnect events, ridersStore staleness

#### 3.3.6 FAB Column (bottom-right, above tab bar)
- Position: absolute, right 12px, bottom 16px (above bottom sheet), z-30
- 3 FABs stacked vertically, gap 10px:

| FAB | Bg | Icon/Text | Size | Action |
|---|---|---|---|---|
| Nav | `#3B82F6` | 🧭 19px white | 46×46 round | Open Google Maps deep link |
| Signal | `#111111` border `#2A2A2A` | 💬 | 46×46 round | Toggle signal menu |
| SOS | `#FF3B3B` | "SOS" Space Mono 10px 700 white | 46×46 round | Open SOS confirmation modal |

Pressed state: scale(0.92), 0.15s.

#### 3.3.7 Signal Menu (floating, near signal FAB)
- Position: absolute, right 12px, bottom 72px
- Bg: `#161616f5`, backdrop-filter blur 8px, border 1px `#2A2A2A`, border-radius `xl` (12px), padding 6px, min-width 160px
- 4 options (vertical list, gap 4px):

| Icon | Label | Color on hover |
|---|---|---|
| ⏳ | Wait for me | `#FF5C0022` bg |
| 🛑 | Pull over | `#FF5C0022` bg |
| ✅ | All good | `#FF5C0022` bg |
| ⛽ | Need fuel | `#FF5C0022` bg |

- Each option: Inter 13px `#F0F0F0`, padding 10px 14px, border-radius `md` (8px)
- On tap: sends signal via Socket.io, shows toast "📡 Signal sent: {label}", shows speech bubble on sender's rider marker for 2.4s
- Open/close animation: 0.18s, opacity + translateY + scale

#### 3.3.8 Bottom Sheet (bottom, always visible)
- Position: absolute, bottom 0, left 0, right 0 (above tab bar)
- Bg: `#0d0d0d`, border-top 1px `#2A2A2A`, padding 10px 16px 14px
- Handle bar: 32px wide, 3px tall, `#333333`, border-radius `pill`, centered

**Collapsed state** (default):
- Row 1: Ride name "8 riders · Convoy synced" (Inter 13px 700 `#FFFFFF`) + ride meta "Pune → Lonavala · started 38 min ago" (Inter 10px `#888888`)
- Row 2: Avatar stack (4 mini-avatars, 22×22, -7px overlap, border 2px `#0d0d0d`) — showing first 4 riders from ridersStore, Space Mono 8px initials
- Row 3: Stat row (3 boxes, flex row, gap 8px):
  - Stat box 1: value Bebas Neue 19px `#FF5C00` + label Inter 8.5px `#888888` — "14.2" / "km left" (from `route.distance_km`)
  - Stat box 2: value Bebas Neue 19px `#FF5C00` + label Inter 8.5px `#888888` — "22" / "min eta" (from `route.eta_minutes`)
  - Stat box 3: value Inter 12px 700 `#FF5C00` + label Inter 8.5px `#888888` — "☕ Chai Pt" / "next stop" (from stops data, first incomplete stop name)
- Each stat box: bg `#1A1A1A`, border-radius `lg` (10px), padding 8px 10px
- Drag handle to expand

**Expanded state** (drag up or tap):
- Shows collapsed content plus:
  - Safety score bar (60px wide, 8px tall, color from `safetyScoreColor(route.safety_score)`)
  - "Avoiding hazards" toggle button (bg `#2D6A4F` when active, `#1A1A1A` border `#2A2A2A` when inactive)
  - "Open in Google Maps" button (bg `#3B82F6`, white text)
  - Max height 300px, scrollable
  - Turn-by-turn placeholder: Inter 12px `#888888` "Turn-by-turn navigation (coming soon)"

**Data sources**: `useRouteStore()` for eta/distance/safety, `useRidersStore()` for rider count/avatars, stops store for next stop.

#### 3.3.9 Navigation Hint Bar (above bottom sheet)
- Full-width, bg `#111111`, border-top 1px `#2A2A2A`, padding 6px 12px
- Text: Space Mono 9.5px `#888888`: "Tap 🧭 to navigate turn-by-turn in Google Maps"

#### 3.3.10 Music Mini-Player (inside bottom sheet, above stat row)
- Bg `#1A1A1A`, border 1px `#2A2A2A`, border-radius `xl` (12px), padding 8px 10px, margin-top 8px
- Left: art placeholder 30×30 rounded `lg` (7px), gradient bg, 🎵 icon
- Center: track name Inter 11.5px 600 `#FFFFFF`, artist Inter 9px `#888888`
- Right: ⏮ ⏸ ▶ ⏭ buttons, Inter 15px `#F0F0F0`
- **Duck state**: border changes to `#FF5C0022`, subtitle changes to "🔉 Volume lowered — {reason}"
- **Priority**: P2 feature. Stub with placeholder data if no music API connected.

#### 3.3.11 SOS Modal (full-screen overlay, conditional)
- Overlay: bg `#000000b0`, backdrop-filter blur 3px, flex center, padding 30px
- Modal box: bg `#111111`, border 1px `#2A2A2A`, border-radius `3xl` (18px), padding 22px
- Icon: 🆘 32px centered
- Title: Bebas Neue 22px `#F0F0F0` "Send SOS to group?"
- Body: Inter 12px `#888888`, line-height 1.6: "Your live location, speed and last known point will be shared instantly with all {N} riders."
- Actions row (flex, gap 8px):
  - Cancel: bg `#1A1A1A`, text `#888888`, border-radius `lg` (10px), padding 11px
  - Send SOS: bg `#FF3B3B`, text `#FFFFFF`, border-radius `lg` (10px), padding 11px
- On confirm: triggers `triggerSos()` from `@hazard/services/sosService`, shows red toast "🆘 SOS sent — your location is live to the whole group", rider marker goes red with pulse animation, music ducks.
- On cancel: closes modal.

**SOS data flow** (unchanged from Person B):
1. `triggerSos(riderId, groupId, lat, lng)` → creates OR-Set entry → persists to MMKV → writes to Firestore (or queues offline)
2. All group members see SOS marker via `subscribeToSosEvents()` Firestore listener
3. Sender sees "Cancel SOS" button → `resolveSos(sosId)` → adds tombstone
4. Resolved markers: greyed, opacity 0.7, "Resolved" label, auto-hide after 5 min

---

### 3.4 StopsScreen

**Layout**: Scrollable, bg `#0A0A0A`, content padding 16px 18px 20px.

**Elements**:
1. **Header eyebrow**: Space Mono 9px `#FF5C00`, uppercase, letter-spacing 0.1em: "02 — Route"
2. **Header title**: Bebas Neue 24px `#F0F0F0`: "Planned Stops"
3. **Progress bar**: Track 5px tall `#1A1A1A` border-radius `pill`, fill `#FF5C00` border-radius `pill`, width = (completedStops / totalStops) × 100%. Transition: 0.5s ease.
4. **Stop list** (vertical timeline):

Each stop node:
- Circle 30×30, border 2px `#2A2A2A`, bg `#111111`, icon centered (emoji or ✓ for done)
- **Completed**: border `#22C55E`, bg `#22C55E18`
- **Current**: border `#FF5C00`, box-shadow 4px `#FF5C0022`
- **Upcoming**: default state
- Connecting line: 2px wide `#2A2A2A`, min-height 26px (completed: `#22C55E`)
- Stop name: Inter 13.5px 600 `#FFFFFF`
- Stop info: Inter 10.5px `#888888` — "{distance} · {status}"
- Tag: Space Mono 8.5px, border-radius `pill`, padding 2px 7px
  - Done: bg `#22C55E18`, text `#22C55E`, border `#22C55E44`
  - Current: bg `#FF5C0022`, text `#FF5C00`, border `#FF5C0044`
  - Upcoming: bg `#1A1A1A`, text `#888888`, border `#2A2A2A`

**Interaction**: Tap current stop → marks done → next becomes current → green toast '✅ Marked "{stop name}" as reached'

**Data source**: Stops data from route response or group metadata. Initially stubbed with group destination. Real stop data will come from route planning (future).

---

### 3.5 VoiceScreen

**Layout**: Flex column, bg `#0A0A0A`, padding 16px 18px.

**Elements**:
1. **Header eyebrow**: Space Mono 9px `#FF5C00`, uppercase: "03 — Intercom"
2. **Header title**: Bebas Neue 24px `#F0F0F0`: "Group Voice"
3. **Live pill**: green variant — "8 IN CALL" with green dot, bg `#22C55E18`, border `#22C55E44`, text `#22C55E`
4. **Voice grid**: 3-column grid, gap 14px 10px. Each participant:
   - Voice avatar: 54×54 circle, rider color bg, 2px `#111111` border
   - Initials: Space Mono 15px 700 `#FFFFFF`
   - Speaking ring: absolute inset -5px, 2px `#22C55E` border, opacity 0 → 1 when speaking, pulse animation (scale 1→1.28, opacity 0.9→0, 1s infinite)
   - Leader mic icon: absolute bottom -3px right -3px, 16×16, bg `#111111` border `#2A2A2A`, 👑 emoji 8px
   - Name: Inter 9.5px `#888888` (or "You" in bold `#F0F0F0` for current rider)
5. **Voice spacer**: flex: 1
6. **Voice toolbar** (centered, horizontal, gap 12px):
   - Mute button: 38×38 circle, bg `#1A1A1A` border `#2A2A2A`, icon 🔊/🔇. Muted state: bg `#FF3B3B1F`, border `#FF3B3B55`, text `#FF3B3B`
   - Leave button: 38×38 circle, bg `#1A1A1A` border `#2A2A2A`, icon 📵, text `#888888`
7. **VOX zone** (bottom, centered):
   - Ring wrap: 66×66, relative
   - Ring: absolute, full size, 2px `#22C55E` border, opacity 0 when idle
   - Core: 56×56 circle, bg `#1A1A1A`, 2px `#22C55E` border, 🎙️ 22px
   - Speaking state: bg `#22C55E18`
   - Muted state: border `#333333`, opacity 50%
   - Label: Space Mono 10px `#22C55E`, letter-spacing 0.05em
     - Idle: "CHANNEL OPEN · AUTO-VOICE"
     - Speaking: "YOU ARE SPEAKING…"
     - Muted: "YOUR MIC MUTED"
   - Sub: Inter 9.5px `#888888`, centered, max-width 220px: "Mic activates automatically when you speak — no buttons, hands stay on the bars."

**Data source**: `VoxClient` from `@flvoice/voxClient`, `ridersStore` for participant list. VOX mode toggle: auto (VAD) vs manual (PTT).

**Connection states**:
- Connected: green ring, active participants
- Connecting: gold ring, "CONNECTING…" label
- Disconnected: red ring, "VOICE UNAVAILABLE" label, buttons disabled

---

### 3.6 FamilyScreen

**Layout**: Scrollable, bg `#0A0A0A`, content padding 14px 18px 20px.

**Elements**:
1. **Header eyebrow**: Space Mono 9px `#FF5C00`, uppercase: "05 — Peace of mind"
2. **Header title**: Bebas Neue 24px `#F0F0F0`: "Family Tracking"
3. **Live pill**: green — "SHARING" with green dot (when sharing), or grey — "PAUSED" (when off)
4. **Toggle card** (bg `#1A1A1A`, border `#2A2A2A`, border-radius `2xl` (14px), padding 13px 14px, margin-bottom 12px):
   - Title: Inter 13px 700 `#FFFFFF`: "Share my live ride status"
   - Subtitle: Inter 10px `#888888`: "Mom, Dad and Hritika can see your live location, speed and stop history until the ride ends." (when on) / "Location sharing is paused — no one can see your live position right now." (when off)
   - Toggle switch: 42×24, border-radius `pill`, bg `#333333` (off) / `#22C55E` (on). Knob: 20×20 white circle, translates 18px right on on. Transition 0.2s.
   - On toggle: green toast "👪 Family sharing turned on" / red toast "🔒 Family sharing turned off"
5. **Link row** (bg `#1A1A1A`, border `#2A2A2A`, border-radius `2xl` (14px), padding 11px 12px, margin-bottom 18px):
   - Icon: 🔗 16px
   - Title: Inter 12px 700 `#FFFFFF`: "Live tracking link"
   - Subtitle: Inter 9.5px `#888888`: "Works even if they don't have WeRide"
   - Button: Inter 10.5px 700 `#FF5C00`, bg `#FF5C0022`, border `#FF5C0044`, border-radius `md` (8px), padding 7px 11px: "Copy link" → changes to "Copied ✓" for 1.8s
6. **Section label**: Space Mono 9.5px `#888888`, uppercase, letter-spacing 0.08em: "Watching this ride"
7. **Member cards** (each bg `#1A1A1A`, border `#2A2A2A`, border-radius `2xl` (14px), padding 11px 12px, margin-bottom 9px, gap 11px):
   - Avatar: 36×36 circle, rider color bg, Space Mono 12px 700
   - Name: Inter 12.5px 700 `#FFFFFF`
   - Meta: Inter 9.5px `#888888`: "Last checked · just now"
   - Status badge: Space Mono 8.5px 700, border-radius `pill`, padding 3px 8px
     - safe: bg `#22C55E18`, text `#22C55E`, border `#22C55E44`
     - watching: bg `#3B82F61F`, text `#3B82F6`, border `#3B82F644`

**Data source**: Group members from `GroupService`, family sharing state from local app state. Copy link generates a shareable URL.

---

### 3.7 AlertsScreen

**Layout**: Scrollable, bg `#0A0A0A`, content padding 14px 18px 20px.

**Elements**:
1. **Header eyebrow**: Space Mono 9px `#FF5C00`, uppercase: "Live · shared by group"
2. **Header title**: Bebas Neue 24px `#F0F0F0`: "Road Alerts"
3. **Live pill**: red variant — "{N} ACTIVE" with red dot, bg `#FF3B3B1F`, border `#FF3B3B55`, text `#FF3B3B`
4. **Report chips** (4-column grid, gap 6px, margin-bottom 16px):

| Emoji | Label | HazardType |
|---|---|---|
| 🕳️ | Pothole | `pothole` |
| 🐄 | Animal | `other` |
| 👮 | Checkpoint | `other` |
| 🌧️ | Rain | `other` |

- Chip: bg `#1A1A1A`, border 1px `#2A2A2A`, Inter 9.5px 600 `#F0F0F0`, padding 9px 4px, border-radius `lg` (10px)
- Active/pressed: scale(0.94), border `#FF5C00`
- On tap: opens hazard report sheet (existing `HazardReportSheet`), then on submit: adds alert card to top with "new" animation, shows green toast

5. **Alert cards** (list, gap 9px):

Each card: bg `#1A1A1A`, border 1px `#2A2A2A`, border-radius `xl` (12px), padding 11px 12px, flex row, gap 10px
- Icon (`.ai`): 18px emoji
- Title (`.at`): Inter 12.5px 600 `#FFFFFF`
- Meta (`.am`): Inter 10px `#888888`: "by Piyush · 3.2 km ahead · 2 min ago"
- New variant: border `#FF5C0055`, `alertPop` animation (opacity 0→1, translateY -6px→0, 0.4s)

**Data source**: `subscribeToHazardClusters()` from `@hazard/services/hazardService`. Hazard types mapped to emojis via `hazardColor()`. Distance calculated from current location to cluster centroid.

---

### 3.8 HistoryScreen

**Layout**: Scrollable, bg `#0A0A0A`, content padding 14px 18px 20px.

**Elements**:
1. **Header eyebrow**: Space Mono 9px `#FF5C00`, uppercase: "04 — Logbook"
2. **Header title**: Bebas Neue 24px `#F0F0F0`: "Ride History"
3. **Stats row** (3 boxes, flex row, gap 8px, margin-bottom 16px):
   - Box: bg `#1A1A1A`, border 1px `#2A2A2A`, border-radius `xl` (12px), padding 10px, center-aligned
   - Value: Bebas Neue 22px `#FF5C00`
   - Label: Inter 8px `#888888`, uppercase
   - Values: total distance ("1,240 km"), total rides ("18"), total cities ("9")
   - **If data unavailable**: show "—" for values, label unchanged

4. **History cards** (list, gap 10px):

Each card: bg `#1A1A1A`, border 1px `#2A2A2A`, border-radius `2xl` (14px), padding 14px
- Card name: Inter 13px 700 `#FFFFFF`
- Card date/status: Inter 9.5px `#888888`
- Active ride: 🟢 + "In progress · today" in `#22C55E`
- Past ride: date + rider count
- SVG route line placeholder (horizontal, 100% width, 28px height)
- Stats row: flex, gap 14px, Inter 10.5px `#888888` (values in bold `#FFFFFF`)
- Share button: bg `#FF5C0022`, border `#FF5C0044`, text "Share ride card 📤" Inter 11px 700 `#FF5C00`, full-width, border-radius `md` (8px), padding 8px
  - On tap: text changes to "Card ready ✓" for 1.8s

**Data source**: Past ride history is NOT currently available in any backend. Show empty state: "No completed rides yet" with illustration. The active ride (if any) can be shown from current route data.

**Empty state**: Centered, Inter 13px `#888888`: "Your ride history will appear here after you complete your first ride."

---

## 4. OVERLAY SPECIFICATIONS

### 4.1 RiderMarkerOverlay

**Purpose**: Show all group riders on the map with color-coded markers.

**Map markers** (inside MapView, ShapeSource + CircleLayer):
- Size: 32×32 circle
- Border: 2px `#111111`
- Color states:
  - GREEN (`#22C55E`): verified + fresh (spoof_flag=false, age < 10s)
  - RED (`#FF3B3B`): spoofed (spoof_flag=true), always RED regardless of freshness
  - GREY (`#9AA0A6`): stale (age > 10s) or missing data
- Precedence: RED > GREY > GREEN
- Initials: Space Mono 10px 700, centered in circle, white text
- Leader crown: 👑 emoji 11px, positioned top -13px, only for group leader (first member or designated)
- "You" label: For current user's marker, Space Mono 9px `#FF5C00` below marker
- Stale badge: 📡 emoji 7px, top-right of marker, bg `#0000009c`, border-radius `sm` (6px), padding 1px 5px, text "last synced Xs ago"

**Speech bubble** (conditional, appears on signal send):
- White bg, `#0A0A0A` text, Inter 9px 600, padding 4px 8px, border-radius 8px
- Positioned above marker, appears for 2.4s then fades

**SOS state**: Red bg, white "SOS" text, pulsing box-shadow animation (0.8s infinite, `0 0 9px #FF3B3B`)

**Info card** (on marker tap, outside MapView):
- Position: absolute, bottom 16px, left 16px, right 16px
- Bg `#161616f7`, border 1px `#2A2A2A`, border-radius `xl` (12px), padding 10px 12px, min-width 140px
- Rider name/short ID: Inter 12px 700 `#FFFFFF`
- Stats: Inter 10px `#888888` — speed, distance from leader
- Status badge: Space Mono 9px, pill-shaped — "Leading", "On pace", "Falling behind"
- Dismiss: tap card or tap elsewhere

**Data source**: `useRidersStore()`, stale sweep every 1s via `refreshStaleStates()`.

### 4.2 SosOverlay

**Map markers** (inside MapView, MarkerView):
- Active SOS: 32×32 circle, bg `#FF3B3B`, white "!" text 16px bold, 3px white border, pulsing animation (scale 1→1.3→1, 800ms loop)
- Resolved SOS: 32×32 circle, bg `#9AA0A655` (faded), opacity 0.7, no pulse, "Resolved" label

**Info cards** (outside MapView, absolute bottom):
- Same style as rider info card
- Red dot + "Emergency: Rider XXXX" or "You"
- Location coordinates
- "Cancel SOS" button (sender only, active SOS) — red bg `#FF3B3B`, white text
- "Navigate to Location" — opens Google Maps deep link
- Auto-hide resolved after 5 min

**SOS button** (FAB, bottom-right column):
- See section 3.3.6 for FAB spec
- See section 3.3.11 for confirmation modal spec
- Anti-accidental guard: 2-second hold required, progress ring during hold

**Data source**: `subscribeToSosEvents()` from `@hazard/services/sosService`, `triggerSos()`, `resolveSos()`.

### 4.3 HazardOverlay

**Map markers** (inside MapView, ShapeSource + MarkerView):
- Circle marker, size scales with `hazard_score` (24px + hazard_score × 16px)
- Color: `hazardColor(hazard_type)` from theme
- Resolved: faded opacity 0.5, label "(Resolved)"
- White border 2px, shadow
- Text: report count (white, bold)
- Polygon: FillLayer with hazard type color, opacity 0.35 active / 0.15 resolved

**Info card** (on marker tap, outside MapView):
- Bottom sheet: bg `#1A1A1A`, border-top 1px `#2A2A2A`, border-radius top `2xl` (14px)
- Color dot + hazard type name
- Reports count
- Hazard score percentage
- Status text
- "Resolve Hazard" button (active only): bg `#FF3B3B`, white text
- "Dismiss" button

**Report flow**:
1. Tap hazard FAB → `HazardReportSheet` bottom sheet opens
2. Select type (pothole, oil_spill, accident, debris, other)
3. Confirm → `submitHazardReport()` with current `verified_location`
4. Success → green toast "Hazard reported"
5. Offline → gold toast "Hazard queued — will sync when online"
6. Pin appears optimistically on own map

**Data source**: `subscribeToHazardClusters()` from `@hazard/services/hazardService`.

### 4.4 VoxOverlay → VoiceScreen

The VoxOverlay FAB is replaced by the Voice tab. The existing `VoxOverlay.tsx` scaffold (56×56 toggle button) is removed from MapScreen. Voice functionality is now a full tab screen (section 3.5).

The `VoxClient` from `@flvoice/voxClient` is NOT modified. Its methods (`start()`, `stop()`, `setVoiceActive()`) are called from VoiceScreen.

### 4.5 FlStatusOverlay

**Position**: Top-left, below header, absolute, top 80px, left 16px
**Pill shape**: bg `#00000099`, border-radius `pill` (99px), padding 6px 12px
**Text**: Space Mono 10px `#F0F0F0`
**States**:
- Default: "Your ride data stays on your device"
- FL round completed: "FL round {N} done · {Y} clients" (from `FlRoundLogger.latestRound()`)
**No interaction**: Information-only badge.

### 4.6 RoutePanel (Bottom Sheet Component)

See section 3.3.8 for full spec. Additional details:
- Safety score bar: 60px wide, 8px tall, border-radius `pill`, color from `safetyScoreColor(score)`
- "Avoiding hazards" toggle: when active, bg `#22C55E`, text white; when inactive, bg `#1A1A1A`, border `#2A2A2A`, text `#888888`
- "Open in Google Maps" button: bg `#3B82F6`, white text, border-radius `lg` (10px)
- Turn-by-turn: placeholder text "Turn-by-turn navigation (coming soon)"

**Data source**: `useRouteStore()` for route, location, clusters, avoid types.

---

## 5. COMPONENT DESIGN SYSTEM

### 5.1 Buttons

| Name | Bg | Text | Border | Radius | Height | Usage |
|---|---|---|---|---|---|---|
| PrimaryButton | `#FF5C00` | `#FFFFFF` 14px 700 | none | 8px | 48px | Sign in, confirm SOS |
| SecondaryButton | `#1A1A1A` | `#F0F0F0` 12.5px 700 | 1px `#2A2A2A` | 10px | 44px | Cancel, dismiss |
| DangerButton | `#FF3B3B` | `#FFFFFF` 12.5px 700 | none | 10px | 44px | Send SOS, resolve |
| IconButton | transparent | — | none | 50% | 46×46 | FABs, toolbar |
| ChipButton | `#1A1A1A` | `#F0F0F0` 9.5px 600 | 1px `#2A2A2A` | 10px | 36px | Report chips |

**Pressed state**: opacity 0.85 or scale(0.92) for FABs, 0.15s transition.

### 5.2 Inputs

| Name | Bg | Text | Border | Radius | Height |
|---|---|---|---|---|---|
| TextInput | `#1A1A1A` | `#F0F0F0` 14px | 1px `#2A2A2A` | 8px | 48px |

Placeholder: `#888888`. Focus: border `#FF5C00`. Error: border `#FF3B3B`.

### 5.3 Cards

| Name | Bg | Border | Radius | Padding |
|---|---|---|---|---|
| Card | `#1A1A1A` | 1px `#2A2A2A` | 14px | 14px |
| StatBox | `#1A1A1A` | none | 10px | 8px 10px |
| AlertCard | `#1A1A1A` | 1px `#2A2A2A` | 12px | 11px 12px |
| NewAlertCard | `#1A1A1A` | 1px `#FF5C0055` | 12px | 11px 12px |

### 5.4 Badges/Pills

| Name | Bg | Text | Border | Radius |
|---|---|---|---|---|
| LivePill (red) | `#FF3B3B1F` | `#FF3B3B` Space Mono 9px 700 | 1px `#FF3B3B55` | 99px |
| LivePill (green) | `#22C55E18` | `#22C55E` Space Mono 9px 700 | 1px `#22C55E44` | 99px |
| LivePill (gold) | `#FBBF2444` | `#fde68a` Space Mono 9px 700 | 1px `#FBBF2455` | 99px |
| StatusBadge (safe) | `#22C55E18` | `#22C55E` Space Mono 8.5px 700 | 1px `#22C55E44` | 99px |
| StatusBadge (watching) | `#3B82F61F` | `#3B82F6` Space Mono 8.5px 700 | 1px `#3B82F644` | 99px |
| StaleBadge | `#0000009c` | `#F0F0F0` Space Mono 7.5px 700 | none | 6px |

### 5.5 Avatars

| Name | Size | Border | Font | Usage |
|---|---|---|---|---|
| RiderMarker | 32×32 | 2px `#111111` | Space Mono 10px 700 | Map markers |
| VoiceAvatar | 54×54 | 2px `#111111` | Space Mono 15px 700 | Voice grid |
| MiniAvatar | 22×22 | 2px `#0d0d0d` | Space Mono 8px 700 | Bottom sheet stack |
| FamilyAvatar | 36×36 | none | Space Mono 12px 700 | Family member |

### 5.6 BottomSheet

- Handle: 32px wide, 3px tall, `#333333`, border-radius 99px, centered
- Collapsed: ~120px, shows summary stats
- Expanded: up to 300px, shows full details + controls
- Drag: vertical gesture, snap to collapsed/expanded
- Bg: `#0d0d0d`, border-top 1px `#2A2A2A`

### 5.7 Toast

- Position: top, z-60, left/right 12px, column, gap 6px
- Bg: `#161616f5`, backdrop-filter blur 8px, border-radius 99px, padding 9px 14px
- Auto-dismiss: 2600ms
- Animation: slide from top, 0.3s cubic-bezier(0.4,1.4,0.5,1)

### 5.8 Modal

- Overlay: `#000000b0`, blur 3px
- Box: `#111111`, border `#2A2A2A`, border-radius 18px, padding 22px
- Close: tap overlay or cancel button
- Animation: fade 0.2s

---

## 6. GLOBAL STATES

| State | Visual | Dismiss |
|---|---|---|
| **Loading** | ActivityIndicator `#FF5C00` centered, buttons disabled with opacity 0.6 | Auto on complete |
| **Error** | Red toast with `#FF3B3B` border, error icon | Auto-dismiss 3s or tap |
| **Empty** | Centered text "No data yet" Inter 13px `#888888`, optional illustration | N/A |
| **Offline** | Network banner with 📡 icon, gold border, "X lost connection" text in `#fde68a` | Auto-dismiss on reconnect |
| **Reconnecting** | Network banner with 📡 icon, gold border, "Reconnecting…" text | Auto-dismiss on connect |
| **Online** | Network banner with ✅ icon, green border, "X is active again" in `#bbf7d0` | Auto-dismiss 2.5s |
| **Location denied** | Full-screen overlay: "Location access required" + "Enable in Settings" button | Button opens app settings |
| **GPS unavailable** | Gold toast "GPS unavailable — using last known location" | Auto-dismiss |
| **Socket disconnected** | Live pill shows "OFFLINE" grey | Auto on reconnect |
| **Spoof detected** | Rider marker turns RED, stale badge shows "SPOOFED" | Auto on recovery |
| **SOS active** | SOS FAB pulses, red toast "🆘 SOS sent" | Auto-dismiss 2.6s |
| **Hazard detected** | Hazard marker appears on map, alert card in Alerts tab | Tap to view info |
| **Route recalculating** | Bottom sheet shows "Recalculating…" with ActivityIndicator | Auto on new route |
| **ETA unavailable** | Bottom sheet shows "—" for eta/distance, safety bar grey | Auto on route available |

---

## 7. PERMISSION FLOWS

| Permission | When | Prompt | If Denied |
|---|---|---|---|
| Location (foreground) | First MapScreen mount | System dialog: "WeRide needs location to show your position on the map" | Full-screen overlay: "Location access required — Enable in Settings" with button |
| Location (background) | TrackingService.start() with useBackground=true | System dialog: "Allow WeRide to access location in the background" | Foreground-only mode, limited tracking |
| Notifications | First app launch, via `firebaseMessaging.requestPermission()` | System dialog | No push notifications for SOS alerts |
| Microphone | First VoiceScreen mount | System dialog: "WeRide needs microphone access for group voice" | Voice tab shows "Microphone access required" overlay, VOX disabled |

---

## 8. DATA → UI MAPPING

| UI Element | Data Source | Store/Service | State | Fallback |
|---|---|---|---|---|
| Rider markers | `location:update` Socket event | `ridersStore` | live/stale/spoofed | Grey marker with "—" |
| ETA minutes | `RouteResponse.eta_minutes` | `useRouteStore().route` | loading/available | "—" |
| Distance km | `RouteResponse.distance_km` | `useRouteStore().route` | loading/available | "—" |
| Safety score | `RouteResponse.safety_score` | `useRouteStore().route` | loading/available | Grey bar |
| Safety bar color | `safetyScoreColor(score)` | computed from route | — | Grey |
| Hazard markers | Firestore `hazards/` collection | `subscribeToHazardClusters()` | active/resolved | Empty map |
| Alert cards | Same hazard clusters | `subscribeToHazardClusters()` | active/resolved | "No alerts yet" |
| SOS markers | Firestore `sos_events/` collection | `subscribeToSosEvents()` | active/resolved | No markers |
| Route line | `RouteResponse.path_points` | `useRouteStore().route` | available | No line |
| Next stop name | Group metadata / route stops | Future: stops store | available | "—" |
| Rider count | `ridersStore.riders.size` | `useRidersStore()` | — | "0 riders" |
| Group name | `Group.name` | `GroupService` | — | Group ID first 8 chars |
| Family members | `Group.member_ids` | `GroupService` | — | "No members" |
| Family sharing | Local toggle state | `appStore` (new field) | on/off | Off |
| Voice participants | `ridersStore.riders` + `VoxClient` | `useRidersStore()` + `VoxClient` | connected/connecting | "Connecting…" |
| FL status | `FlRoundLogger.latestRound()` | `@flvoice/flRoundLogger` | round N / idle | Default privacy message |
| Live pill | Socket.io connection state | `socketService` | connected/reconnecting/offline | "OFFLINE" |
| Toast messages | Various events | Local state | transient | N/A |

---

## 9. USER FLOWS

### FLOW 1: App Launch → Login → Group List
1. App opens → LoginScreen
2. User enters email + password → taps "Sign In"
3. Firebase auth succeeds → `setUserId(uid)` → `navigation.replace('Groups')`
4. Firebase auth fails → error message in red text

### FLOW 2: Create Group → Enter Main App
1. User taps FAB "+" on GroupListScreen
2. `GroupService.createGroup()` → Firestore creates group with user as first member
3. Group appears in list via `onSnapshot` subscription
4. User taps group → `setGroupId(id)` → `navigation.navigate('MainApp', { groupId })` → Tab navigator loads

### FLOW 3: Join Group → Enter Main App
1. User enters join code in input → taps "Join"
2. `GroupService.joinGroup(code)` → adds user to group
3. Group appears in list → user taps group → enters main app

### FLOW 4: Home → View Riders → Route → ETA
1. MapScreen loads → TrackingService starts → rider markers appear
2. Socket `location:update` events → ridersStore updates → markers refresh
3. RouteOverlay subscribes to location + hazards → route calculated
4. Bottom sheet shows ETA + distance + safety score
5. User can expand bottom sheet for turn-by-turn (placeholder) + Google Maps deep link

### FLOW 5: Home → Stops → Return Home
1. User taps "Stops" tab → StopsScreen shows stop timeline
2. User taps current stop → marked as done → green toast
3. User taps "Home" tab → returns to map

### FLOW 6: Home → Voice → Communicate → Return Home
1. User taps "Voice" tab → VoiceScreen shows participant grid
2. VoxClient.start() → WebRTC connections established
3. Speaking detected → avatar ring pulses → label "YOU ARE SPEAKING…"
4. Others speak → their avatar rings pulse
5. Mute/unmute toggle → mic state changes
6. Leave button → red toast "You left the voice channel"

### FLOW 7: Home → Family → Members → Return Home
1. User taps "Family" tab → FamilyScreen shows toggle + members
2. Toggle sharing on → green toast "Family sharing turned on"
3. Tap "Copy link" → link copied to clipboard, button text changes to "Copied ✓"
4. Return to Home tab

### FLOW 8: Home → Alerts → View Hazard → Return Home
1. User taps "Alerts" tab → AlertsScreen shows active hazards
2. User taps report chip → HazardReportSheet opens → select type → confirm
3. Green toast "Hazard reported" → alert card appears at top
4. Existing alert cards show type, distance, reporter, time

### FLOW 9: Home → History → Stats → Return Home
1. User taps "History" tab → HistoryScreen shows stats + ride cards
2. No completed rides → empty state "Your ride history will appear here"
3. Active ride shows with 🟢 "In progress"

### FLOW 10: SOS Flow
1. User taps SOS FAB (bottom-right, red circle with "SOS")
2. SOS confirmation modal appears with "Send SOS to group?" message
3. User taps "Send SOS" → `triggerSos()` called → OR-Set persisted → Firestore write
4. SOS marker appears on map (red, pulsing) → red toast → music ducks
5. Group members see SOS marker → info card with "Navigate to Location"
6. Sender sees "Cancel SOS" button → `resolveSos()` → tombstone added
7. Resolved: marker greys out, "Resolved" label, auto-hide after 5 min

### FLOW 11: Hazard Detected
1. Another rider reports hazard → `subscribeToHazardClusters()` fires
2. Hazard marker appears on map (colored by type)
3. Alert card appears in Alerts tab
4. Route may recalculate to avoid hazard (if "Avoid hazards" is on)
5. User taps hazard marker → info card shows details

### FLOW 12: GPS/Network Disconnect
1. Socket disconnects → Live pill shows "OFFLINE"
2. Network banner appears: "X lost connection. Showing last known location."
3. Rider markers go stale (grey) after 10s
4. Reconnect → Network banner: "X is active again. Position resynced." → auto-dismiss
5. Pending operations (hazard reports, SOS) sync via `SyncWorker`

### FLOW 13: Anti-Spoofing Detection
1. EKF NIS exceeds threshold for 3 consecutive ticks → `spoof_flag=true`
2. Rider marker turns RED
3. Info card shows "SPOOFED" status badge
4. Recovery after 5 consecutive low-NIS ticks → `spoof_flag=false` → GREEN marker

### FLOW 14: Route Change/Rerouting
1. New hazard cluster appears near route → RouteOverlay detects change
2. If "Avoid hazards" is on → `scheduleRecalculation()` fires
3. Bottom sheet briefly shows "Recalculating…" with ActivityIndicator
4. New route line renders → ETA/distance/safety update
5. If moved > 100m → `scheduleOriginRecalcIfMoved()` fires

---

## 10. ANIMATIONS

| Name | Trigger | Duration | Easing | What Changes |
|---|---|---|---|---|
| `sosPulse` | SOS marker visible | 800ms, infinite loop | linear | Scale 1→1.3→1, box-shadow 0→9px red |
| `livePulse` | Live pill visible | 1200ms, infinite loop | ease | Dot opacity 1→0.3→1 |
| `ringPulse` | Voice participant speaking | 1000ms, infinite loop | ease | Scale 1→1.28, opacity 0.9→0 |
| `toastSlide` | Toast appears | 300ms | cubic-bezier(0.4,1.4,0.5,1) | translateY -30px→0, opacity 0→1 |
| `bannerSlide` | Fuel/network banner appears | 400ms (fuel) / 250ms (network) | cubic-bezier(0.4,1.4,0.5,1) | translateY -120%→0 |
| `signalMenuOpen` | Signal FAB tapped | 180ms | ease-out | opacity 0→1, translateY 10px→0, scale 0.95→1 |
| `riderPopup` | Rider marker tapped | 150ms | ease-out | opacity 0→1, scale 0.9→1 |
| `sosModal` | SOS FAB tapped | 200ms | ease | opacity 0→1 |
| `fabPress` | Any FAB pressed | 150ms | ease | scale 1→0.92 |
| `chipPress` | Report chip pressed | 150ms | ease | scale 1→0.94 |
| `alertPop` | New alert card added | 400ms | ease | opacity 0→1, translateY -6px→0 |
| `progressFill` | Stop completed | 500ms | ease | width change |
| `toggleSwitch` | Family sharing toggle | 200ms | ease | bg color, knob translateX 18px |
| `tabSwitch` | Tab press | 200ms | ease | opacity fade, icon translateY -2px |
| `staleTransition` | Rider goes stale | 1000ms | ease | opacity 1→0.45, grayscale 0→60% |

---

## 11. ACCESSIBILITY

- **Touch targets**: Minimum 44×44px for all interactive elements (FABs are 46×46)
- **Text contrast**: All text meets WCAG AA (light text on dark backgrounds: `#F0F0F0` on `#0A0A0A` = 17.4:1)
- **Screen reader**: All buttons have `accessibilityLabel`, all images have `accessibilityLabel`, all live regions use `accessibilityLiveRegion="polite"`
- **Color-independent status**: Spoofed state uses RED color + "SPOOFED" label; stale uses GREY + "STALE" badge; verified uses GREEN + "VERIFIED" label. Never color-only.
- **Dynamic text**: Use relative sizing where possible; bottom sheet max-height adjusts for larger text
- **Modal accessibility**: `accessibilityViewIsModal={true}`, escape key closes

---

## 12. RESPONSIVE DESIGN

| Device | Behavior |
|---|---|
| Small phone (320–375px width) | Voice grid switches to 2 columns; stat boxes stack vertically; bottom sheet max-height 250px |
| Normal phone (376–414px width) | Default layout as specified |
| Large phone (415px+) | Voice grid stays 3 columns; extra padding on cards; bottom sheet max-height 350px |
| All sizes | Bottom sheet draggable; scroll views on all content screens; tab bar adds safe-area-inset-bottom padding |

---

## 13. PROTOTYPE → REAL APP MAPPING

| Prototype Element | RN Screen/Component | Existing? | New? | Connect To |
|---|---|---|---|---|
| Login screen | `LoginScreen` | Yes (style change) | No | `firebaseAuth`, `appStore` |
| Group list | `GroupListScreen` | Yes (style change) | No | `GroupService`, `appStore` |
| Tab bar | New `MainTabNavigator` | No | Yes | `@react-navigation/bottom-tabs` |
| Map + overlays | `MapScreen` + overlays | Yes (redesign) | No | MapboxGL, all module services |
| Live pill | `LivePill` component | No | Yes | Socket.io connection state |
| Screen header (eyebrow + title) | `ScreenHeader` component | No | Yes | Static + group name |
| FL badge | `FlStatusOverlay` | Yes (redesign) | No | `FlRoundLogger` |
| Toast system | `ToastContainer` + `Toast` | No | Yes | Local state + events |
| Fuel banner | `FuelBanner` component | No | Yes | Route data (nearest fuel stop) |
| Network banner | `NetworkBanner` component | No | Yes | Socket.io, `ridersStore` |
| Rider bubbles | `RiderMarkerOverlay` | Yes (redesign) | No | `ridersStore` |
| Signal menu | `SignalMenu` component | No | Yes | Socket.io custom event |
| Nav FAB | `NavFab` component | No | Yes | `googleMapsDeepLink()` |
| Signal FAB | `SignalFab` component | No | Yes | Opens `SignalMenu` |
| SOS FAB + modal | `SosButton` + `SosModal` | Yes (redesign) | No | `triggerSos()`, `resolveSos()` |
| Bottom sheet | `RoutePanel` | Yes (redesign) | No | `useRouteStore()`, `ridersStore` |
| Music mini-player | `MusicPlayer` component | No | Yes (stub) | No real API (P2) |
| Navigation hint | `NavHint` component | No | Yes | Static text |
| Stops tab | `StopsScreen` | No | Yes | Future: stops store |
| Voice tab | `VoiceScreen` | No | Yes | `VoxClient`, `ridersStore` |
| Family tab | `FamilyScreen` | No | Yes | `GroupService`, local state |
| Alerts tab | `AlertsScreen` | No | Yes | `subscribeToHazardClusters()` |
| History tab | `HistoryScreen` | No | Yes | Future: ride history store |
| Hazard report chips | `AlertsScreen` chips | No | Yes | `submitHazardReport()` |
| Rider info card | `RiderInfoCard` | Yes (redesign) | No | `ridersStore` |
| SOS info card | `SosOverlayInfoCards` | Yes (redesign) | No | `subscribeToSosEvents()` |
| Hazard info card | `HazardOverlayInfoCard` | Yes (redesign) | No | `subscribeToHazardClusters()` |

---

## 14. EXISTING UI → FINAL UI GAP

| Existing Component | Current | Target | Change | Priority |
|---|---|---|---|---|
| `theme.ts` | Light green theme (#1B4332, #F8F9FA) | Dark orange theme (#FF5C00, #0A0A0A) | Complete color/font overhaul | CRITICAL |
| `RootStack.tsx` | Stack nav (Login→Groups→Map) | Stack auth + Tab nav (6 tabs) | Replace Map with Tab navigator | CRITICAL |
| `LoginScreen` | Light bg, basic inputs | Dark bg, styled inputs, logo | Restyle | HIGH |
| `GroupListScreen` | Light bg, basic list | Dark bg, styled cards | Restyle | HIGH |
| `MapScreen` | Bare map + overlays | Map + header + FABs + bottom sheet + toasts + banners | Major redesign | CRITICAL |
| `RiderMarkerOverlay` | Simple circles, white card info | Initials, crown, speech bubbles, dark card | Major redesign | HIGH |
| `SosOverlay` | Simple red circle, white card | Pulsing marker, dark card, confirmation modal | Major redesign | HIGH |
| `HazardOverlay` | Colored circles, white card | Colored markers, dark card, report chips in Alerts tab | Major redesign | HIGH |
| `RoutePanel` | White bottom sheet | Dark bottom sheet, avatar stack, stat boxes | Restyle + add stats | HIGH |
| `VoxOverlay` | 56×56 toggle FAB | Removed from map → full VoiceScreen tab | Complete redesign | HIGH |
| `FlStatusOverlay` | Static privacy text | Dark pill badge with FL round state | Restyle | MEDIUM |
| `RouteOverlay` | Route line only | Route line (unchanged) + bottom sheet redesign | Partial restyle | MEDIUM |
| `appStore` | userId, groupId | Add: familySharingEnabled, socketConnected, currentTab | Extend | HIGH |
| 5 new screens | None | Stops, Voice, Family, Alerts, History | Create from scratch | HIGH |
| Toast system | None | Global toast container + events | Create | HIGH |
| Navigation structure | 3-screen stack | Auth stack + 6-tab bottom navigator | Restructure | CRITICAL |

---

## 15. IMPLEMENTATION FILE PLAN

```
app/src/
  theme/
    theme.ts                    ← OVERHAUL: new color tokens, font tokens, spacing, radius
    colors.ts                   ← NEW: color constant exports
    typography.ts               ← NEW: font family registration + style exports
    spacing.ts                  ← NEW: spacing scale exports
  navigation/
    RootStack.tsx               ← OVERHAUL: auth stack → MainTabNavigator
    MainTabNavigator.tsx         ← NEW: 6-tab bottom navigator
  components/
    RoutePanel.tsx              ← OVERHAUL: dark theme, stats, avatar stack
    LivePill.tsx                ← NEW: connection status pill
    ScreenHeader.tsx            ← NEW: eyebrow + title component
    ToastContainer.tsx          ← NEW: global toast system
    Toast.tsx                   ← NEW: individual toast item
    NetworkBanner.tsx           ← NEW: connection status banner
    FuelBanner.tsx              ← NEW: fuel warning banner
    SignalMenu.tsx              ← NEW: quick signal menu
    NavFab.tsx                  ← NEW: Google Maps FAB
    SignalFab.tsx               ← NEW: signal toggle FAB
    SosFab.tsx                  ← NEW: SOS FAB + confirmation modal
    SosModal.tsx                ← NEW: SOS confirmation modal
    BottomSheet.tsx             ← NEW: draggable bottom sheet wrapper
    StatBox.tsx                 ← NEW: reusable stat value/label box
    AvatarStack.tsx             ← NEW: overlapping mini-avatars
    StatusBadge.tsx             ← NEW: pill-shaped status badges
    MusicPlayer.tsx             ← NEW: stub mini-player (P2)
    Progressbar.tsx             ← NEW: stop progress bar
    StopNode.tsx                ← NEW: stop timeline node
    VoiceAvatar.tsx             ← NEW: speaking avatar with ring
    VoxZone.tsx                 ← NEW: VOX microphone zone
    VoiceToolbar.tsx            ← NEW: mute/leave buttons
    FamilyToggle.tsx            ← NEW: sharing toggle switch
    FamilyMemberCard.tsx        ← NEW: member card with status
    AlertCard.tsx               ← NEW: hazard alert card
    HazardChip.tsx              ← NEW: report type chip
    HistoryCard.tsx             ← NEW: ride history card
    StatRow.tsx                 ← NEW: stats row (3 boxes)
    NavHint.tsx                 ← NEW: "Tap 🧭 to navigate" bar
  screens/
    LoginScreen.tsx             ← OVERHAUL: dark theme, logo
    GroupListScreen.tsx          ← OVERHAUL: dark theme, styled cards
    map/
      MapScreen.tsx             ← OVERHAUL: add header, FABs, toasts, banners
      overlays/
        RiderMarkerOverlay.tsx  ← OVERHAUL: initials, crown, speech bubbles, dark theme
        SosOverlay.tsx          ← OVERHAUL: pulsing marker, dark modal, confirmation
        HazardOverlay.tsx       ← OVERHAUL: dark theme, dark card
        RouteOverlay.tsx        ← OVERHAUL: use redesigned RoutePanel
        VoxOverlay.tsx          ← REMOVE (replaced by VoiceScreen)
        FlStatusOverlay.tsx     ← OVERHAUL: dark pill badge with FL state
    StopsScreen.tsx             ← NEW
    VoiceScreen.tsx             ← NEW
    FamilyScreen.tsx             ← NEW
    AlertsScreen.tsx            ← NEW
    HistoryScreen.tsx           ← NEW
  store/
    appStore.ts                 ← EXTEND: add familySharingEnabled, socketConnected, currentTab
    ridersStore.ts              ← UNCHANGED
    stopsStore.ts               ← NEW: stops data (stub for now)
    toastStore.ts               ← NEW: global toast state
  hooks/
    useSocketStatus.ts          ← NEW: Socket.io connection state hook
    useToast.ts                 ← NEW: toast dispatch hook
  services/
    firebaseService.ts          ← UNCHANGED
    socketService.ts            ← EXTEND: add signal event emission
    localStorage.ts             ← UNCHANGED
  models/
    (all existing)              ← UNCHANGED
```

---

## 16. IMPLEMENTATION ORDER

| Phase | Scope | Dependencies |
|---|---|---|
| 1 | **Theme overhaul** — `theme.ts`, colors, typography, spacing | None |
| 2 | **Shared components** — ToastContainer, LivePill, StatusBadge, StatBox, ScreenHeader, BottomSheet, NavHint | Phase 1 |
| 3 | **Navigation restructure** — RootStack (auth) + MainTabNavigator (6 tabs) | Phase 1 |
| 4 | **Login + Group screens restyle** — Dark theme, styled inputs/cards | Phase 1 |
| 5 | **Home/Map redesign** — Header, FABs, banners, bottom sheet, toasts on MapScreen | Phase 2, 3 |
| 6 | **Map overlays redesign** — Rider markers, SOS modal, hazard cards, FL badge, route panel | Phase 2, 5 |
| 7 | **Alerts screen** — Report chips, alert cards, hazard feed | Phase 2, 5 |
| 8 | **Stops screen** — Progress bar, stop timeline | Phase 2 |
| 9 | **Voice screen** — Grid, VOX zone, toolbar | Phase 2, VoxClient |
| 10 | **Family screen** — Toggle, link, member cards | Phase 2, GroupService |
| 11 | **History screen** — Stats, ride cards (stub data) | Phase 2 |
| 12 | **Global states** — Network banners, fuel banners, toast system integration | Phase 5, 7 |
| 13 | **Animations** — Pulse, slide, fade, press transitions | Phase 5–11 |
| 14 | **Accessibility** — Labels, contrast, live regions | Phase 5–11 |
| 15 | **Testing** — Update existing tests, add new screen tests | All phases |
| 16 | **Visual audit** — Compare against demo, fix discrepancies | All phases |

---

## 17. FINAL DESIGN CHECKLIST

### Screens
- [ ] LoginScreen — dark theme, logo, styled inputs
- [ ] GroupListScreen — dark theme, styled cards, FAB
- [ ] Home/MapScreen — header, live pill, FABs, banners, bottom sheet, toasts
- [ ] StopsScreen — progress bar, stop timeline, check interaction
- [ ] VoiceScreen — participant grid, VOX zone, toolbar
- [ ] FamilyScreen — toggle, link, member cards
- [ ] AlertsScreen — report chips, alert cards
- [ ] HistoryScreen — stats row, ride cards

### Components
- [ ] LivePill (3 states: connected/reconnecting/offline)
- [ ] ToastContainer + Toast (3 variants: green/red/gold)
- [ ] NetworkBanner (2 states: lost/recovered)
- [ ] FuelBanner (dismissible)
- [ ] SignalMenu (4 options)
- [ ] NavFab (Google Maps deep link)
- [ ] SignalFab (toggle signal menu)
- [ ] SosFab + SosModal (hold guard, confirmation)
- [ ] BottomSheet (collapsible/expandable, draggable)
- [ ] StatBox (value + label)
- [ ] AvatarStack (overlapping mini-avatars)
- [ ] StatusBadge (safe/watching/offline/spoofed)
- [ ] ScreenHeader (eyebrow + title)
- [ ] Progressbar (stop progress)
- [ ] StopNode (timeline node)
- [ ] VoiceAvatar (ring pulse animation)
- [ ] VoxZone (mic zone with states)
- [ ] VoiceToolbar (mute/leave)
- [ ] FamilyToggle (switch)
- [ ] FamilyMemberCard (avatar + status)
- [ ] AlertCard (hazard info)
- [ ] HazardChip (report type)
- [ ] HistoryCard (ride summary)
- [ ] MusicPlayer (stub)
- [ ] NavHint (tap to navigate bar)

### Overlays (on Map)
- [ ] Rider markers with initials, crown, speech bubbles, stale badge
- [ ] SOS markers with pulse animation
- [ ] Hazard markers with type color, tap info card
- [ ] Route line (orange, 4px)
- [ ] FL status badge (top-left)
- [ ] Rider info card (tap)
- [ ] SOS info card (tap)
- [ ] Hazard info card (tap)

### Navigation
- [ ] Auth stack: Login → Groups
- [ ] Tab navigator: Home / Stops / Voice / Family / Alerts / History
- [ ] Tab bar: dark, orange active, grey inactive
- [ ] Group ID passed to all tabs

### States
- [ ] Loading state on all screens
- [ ] Error state on all screens
- [ ] Empty state on all lists
- [ ] Offline state (network banner)
- [ ] SOS active state (marker + toast + modal)
- [ ] Route recalculating state (bottom sheet)
- [ ] Voice connected/connecting/disconnected
- [ ] Family sharing on/off
- [ ] Hazard reported offline (queued toast)
- [ ] Spoof detected (red marker + badge)
- [ ] Rider stale (grey marker + badge)

### Data Connections
- [ ] ridersStore → rider markers (Person A)
- [ ] subscribeToHazardClusters → hazard markers + alert cards (Person B)
- [ ] subscribeToSosEvents → SOS markers (Person B)
- [ ] triggerSos / resolveSos → SOS flow (Person B)
- [ ] useRouteStore → route line + bottom sheet (Person C)
- [ ] GroupService → group list + family members (Person C)
- [ ] VoxClient → voice screen (Person D, NOT modified)
- [ ] FlRoundLogger → FL badge (Person D, NOT modified)
- [ ] Socket.io → live pill + network banner
- [ ] TrackingService → rider position (Person A)

### Animations
- [ ] SOS pulse (800ms loop)
- [ ] Live pill pulse (1200ms loop)
- [ ] Voice ring pulse (1000ms loop)
- [ ] Toast slide (300ms)
- [ ] Banner slide (250–400ms)
- [ ] Signal menu open (180ms)
- [ ] Rider popup (150ms)
- [ ] FAB press (150ms)
- [ ] Alert pop (400ms)
- [ ] Progress fill (500ms)
- [ ] Toggle switch (200ms)
- [ ] Tab switch (200ms)
- [ ] Stale transition (1000ms)