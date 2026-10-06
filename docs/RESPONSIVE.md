# Responsive layout: devices, policies, and how to check

The demo is drawn for one phone (390 x 844). This document describes how the real app adapts to any Android or iOS
device (small phones, large phones, tablets and foldables, different safe areas, OS "large text" and display-size
settings), the policies behind it, and the automatic check that proves it.

Everything below is verified in a real browser engine (react-native-web in headless Chrome) with the same stubs the
screenshot harness always used. A browser engine is not a device: see "What only a device can verify".

## 1. Device matrix

`app/scripts/screenshots/devices.json` (the harness feeds `w`, `h`, and the insets to the scenes the same way the app
gets them: the `react-native-safe-area-context` stub and `useWindowDimensions`).

| key | device | size (pt) | insets top / bottom |
|---|---|---|---|
| `iphone14` | iPhone 14 / 15 (default, the demo) | 390 x 844 | 47 / 34 |
| `iphone-pro` | iPhone Pro (Dynamic Island) | 393 x 852 | 59 / 34 |
| `iphone-max` | iPhone Pro Max | 430 x 932 | 59 / 34 |
| `iphone-se` | iPhone SE | 375 x 667 | 20 / 0 |
| `android-xs` | small Android, or "large display size" | 320 x 568 | 24 / 48 |
| `android-360x640` | short Android phone | 360 x 640 | 24 / 48 |
| `android-360` | common Android | 360 x 800 | 24 / 48 |
| `pixel` | Pixel | 412 x 915 | 24 / 48 |
| `fold` | foldable inner screen | 673 x 841 | 24 / 0 |
| `ipad` | iPad portrait | 768 x 1024 | 0 / 0 |
| `ipad-land` | iPad landscape | 1024 x 768 | 0 / 0 |
| `inset-0` | 390 x 844 with no insets | 390 x 844 | 0 / 0 |

Font scales: 1.0, 1.3, 1.5 and 2.0. The harness gives them to the app through `PixelRatio.getFontScale()` and
`useWindowDimensions().fontScale`, **and** scales `Text` the way React Native does on a device: `fontSize` and
`lineHeight` are multiplied by `min(fontScale, maxFontSizeMultiplier)` unless `allowFontScaling={false}`;
`adjustsFontSizeToFit` / `minimumFontScale` (ignored by react-native-web) are emulated too.

## 2. Policies

### Breakpoints (`app/src/theme/responsive.ts`)

`useResponsive()` returns `width, height, usableHeight, fontScale, orientation, isLandscape, isCompactWidth, isShortHeight,
isTablet, scale, gutter`. The pure `computeResponsive` is unit-tested.

* `isCompactWidth`: width < 360 pt.
* `isShortHeight`: usable height (window height minus the top and bottom safe-area insets) < 700 pt. iPhone SE
  (647), 360 x 640 Android (568), 320 x 568 (496); an iPhone 14 has 763. Tablets are never short.
* `isTablet`: min(width, height) >= 600 pt (iPad, foldable inner screen, Android tablet), in either orientation.
* `scaleBy(size, width)` / `useScaleBy()`: moderate scaling for display type; half of the relative width difference to
  390, kept within 0.9 .. 1.1, exactly 1 on tablets (never smaller than the demo there). Used for the Splash / Promise
  headlines, the plan time, the SOS screens.
* `dockBottom(inset)`: the distance of a pinned bottom dock from the screen edge: the demo's 30 pt, or `inset - 4` on a
  taller system bar (iPhone: 34 - 4 = 30, so the iPhone render is identical to the demo; Android 48 -> 44).

### Tablets: a centred column

* `Screen` (every garage and onboarding screen): content and the pinned CTA sit in a column of at most 560 pt (road
  screens 640 pt) centred on the page; the page background fills the screen.
* Tab bar: the bar's background and top rule span the screen; its four tabs sit in a centred 560 pt row.
* `Sheet`: a bottom sheet on phones; on tablets a centred card (<= 560 pt, all corners rounded, centred vertically).
* Live: the HUD (header, plate, side buttons, speed cluster, controls) sits in a centred 640 pt column over the full-bleed map.
* Stop / Arrive / SOS / crash overlays: centred 640 pt column.

### Compact widths (< 360 pt)

* Gutters 20 -> 16 (`Screen`, `Sheet`; the Drill banner bleeds by the same amount).
* Display type steps down through `scaleBy`; plate titles drop to 22-24 pt and shrink to fit (`adjustsFontSizeToFit`);
  plate icons 40 -> 32.
* The six code boxes are flex boxes (41 pt wide at 320 pt). The OTP keypad is a 3-column grid.
* Letter keypad (join code): keys never narrower than 28 pt. 10-key QWERTY rows are used while the key width is >= 28
  (360 pt phones tighten the gap to 4 pt and keep QWERTY); below that the pad switches to 8-key rows (digits, then the
  23 usable letters alphabetically, inert I / L / O dropped, 31 pt keys). `letterKeypadPlan(width)` is unit-tested.

### Live / Stop / Arrive / SOS: height-aware

`app/src/screens/map/live/liveLayout.ts` (pure, unit-tested) picks a tier from the usable height:

| tier | usable height | side button | plate | control row | speed | bottom gap |
|---|---|---|---|---|---|---|
| regular | >= 700 | 62 | 82 | 88 | 122 | 30 |
| short | 600 .. 700 | 56 | 76 | 80 | 100 | 20 |
| tiny | < 600 | 50 | 70 | 76 | 84 | 14 |

* The control row is never below 76 pt. Glove mode scales keys and speed by the demo's ratios (88 -> 104,
  122 -> 132) inside the tier. The SOS key takes about 30 % of the row (76 .. 96 pt wide); key labels drop to 10 pt on
  narrow keys.
* The speed number is also capped by the width so the digits and the ETA column always fit side by side.
* The side column hangs off the *measured* height of the header + plate block, so a plate that wraps pushes it down; a
  unit test proves it clears the speed cluster on every device in the matrix, with and without glove mode.
* Stop and Arrive (`RoadFrame`) and the SOS / crash overlays (`OverlayFrame`): scrolling content above a pinned dock.
  The dock holds the buttons that matter (SOS, "I'm ready", Hold to end ride, Call 112, "I'm OK" / cancel, "I'm going");
  the scroller reserves the dock's *measured* height, so large text can never push a button out of reach.

### Text scaling (`app/src/theme/textPolicy.ts`)

* Global default: every `Text` and `TextInput` gets `maxFontSizeMultiplier = 1.3` (`applyTextPolicy()` in `index.js`).
  Body text, long copy, and list rows therefore grow with the OS setting up to 1.3 x and the screen scrolls.
* `CAP.fixed = 1` (never scales): tab-bar labels, plate titles, speed / ETA / distance numerals and their labels,
  keypad keys, code boxes, avatar initials, control-key and side-button labels, the SOS key, big SOS / countdown headlines.
* `CAP.hud = 1.15`: pills, chips, segmented labels, button labels, plate subtitles, KV keys, small HUD captions.
* `CAP.reading = 1.6` is available for long reading copy.
* Fixed-height elements that could still be too narrow use `adjustsFontSizeToFit` with a `minimumFontScale`.

### Orientation

* iPhone: portrait only (`UISupportedInterfaceOrientations` = portrait). iPad: all four
  (`UISupportedInterfaceOrientations~ipad`); landscape lays out with the centred column.
* Android: `MainActivity` locks `SCREEN_ORIENTATION_PORTRAIT` when `smallestScreenWidthDp < 600` before the first frame,
  and re-evaluates in `onConfigurationChanged` (a foldable opening or closing); tablets get `UNSPECIFIED` (rotation
  allowed). The manifest keeps `configChanges` for orientation and screen size, so React Native handles rotation without
  recreating the activity. A jest test (`orientationPolicy.test.ts`) pins all of this.

### Safe areas

Every screen takes its top and bottom space from `useSafeAreaInsets` / the insets context: `Screen` (top pad, CTA
position, bottom gap), the tab bar (height and padding), `Sheet` (bottom padding), `MapScreen`, `RoadFrame`,
`OverlayFrame`, the SOS / crash / call overlays, and the Stop / Arrive / Meetup toasts. There is no hard-coded 47 or 34.
Checked at insets 0/0, 20/0, 47/34, 59/34 and 24/48.

### Touch targets

Every pressable is at least 44 x 44 pt (hit slop counts): segmented controls 44, chips 44, switches 54 x 32 + 6 pt
slop top and bottom, the sheet's grab handle gets slop, "xs" buttons get 4 pt slop. The only exception is the dense
letter keypad: keys are at least 28 pt wide and 48 pt high (see above).

### Keyboard

* Sheets (Add contact, New crew): `KeyboardAvoidingView` (iOS `padding`; Android resizes the window) around the sheet,
  and the sheet's scroller has `keyboardShouldPersistTaps="handled"`, so Save works on the first tap with the keyboard
  open on a 320 x 568 screen and the form scrolls.
* Screens (Auth phone / email, Profile): `Kav` around the screen; `Screen`'s scroller has `keyboardShouldPersistTaps` and
  iOS `automaticallyAdjustKeyboardInsets` (Plan where search, any future form).
* Not verifiable here: see below.

## 3. How to re-run the check

```
CHROME=/usr/bin/google-chrome app/scripts/screenshots/matrix.sh                 # every scene x every device x fonts 1, 1.3, 1.5, 2
CHROME=/usr/bin/google-chrome DEVICES=iphone-se,android-xs FONTS=1,2 app/scripts/screenshots/matrix.sh 11-home road-live
```

Environment: `DEVICES`, `FONTS`, `JOBS`, `SHOTS`, `SHEETS` (contact sheets `device:font,...`), `BASELINE` (layout dir of an
earlier run, adds a "before" column), `OS=android` (render the Android branches), `OUT`. Output (outside the repo):
`layout/<device>__fs<scale>/<scene>.json` (machine-readable, one per scene x device x font), `layout-report.md`,
`summary.json`, `shots/<device>/fs<scale>/<scene>.png`, `sheets/*.png`.

The check (`layoutcheck.js`, injected after each scene settles) reports, per element:

| type | meaning |
|---|---|
| `page-hscroll`, `scroll-hclip` | the page / a vertical scroller scrolls or clips sideways |
| `beyond-viewport` | a box extends past the left or right screen edge (not in a horizontal scroller or the map) |
| `offscreen` | text or a control is partly off screen and cannot be scrolled to |
| `text-clipped` | text is cut by an ancestor with `overflow: hidden` (tolerance of one letter at the line end) |
| `text-word-broken` | a word is broken in the middle by wrapping (more lines than words: "Me / etu / p") |
| `target-small` | a pressable under 44 x 44 pt, hit slop included (28 x 44 for the dense letter keypad) |
| `overlap-text`, `overlap-control`, `overlap-control-text` | two texts / two controls / a control over text that is not its own overlap (text rectangles shrunk 20 % top and bottom). Content that is under a modal sheet, toasts, and scroller content that is *scrollable out from under* pinned chrome are not counted at rest; instead a second **end-of-scroll pass** scrolls every scroller to its end and flags anything still under pinned chrome (a CTA, keypad or dock taller than the space reserved for it), tagged `scrolled-to-end` |
| `text-truncated` (warning, not counted) | an ellipsis / line clamp is showing |

`probe.mjs` renders one scene and evaluates an expression in the page (for debugging a single violation).
`run.sh` is unchanged: the 390 x 844 parity renders against `docs/demo-screens`.

## 4. Results

Run of the full matrix on 2026-10-06: **64 scenes × 9 devices × 3 font scales = 1,728 renders, 0 layout errors** (iPhone 14, iPhone SE,
iPhone Pro Max, Pixel, short 360 × 640 Android, small 320 × 568 Android, foldable inner screen, iPad portrait and landscape;
font scales 1.0, 1.5 and 2.0). Every error class in the table in section 3 is 0 in every row: no sideways overflow, nothing off
screen, no clipped or word-broken text, no touch target under 44 pt (28 pt wide for the dense letter keypad), no overlapping text
or controls, including after scrolling each screen to its end.

Warnings (not counted as errors) are ellipsis truncations of single-line labels: ride names and subtitles on the smallest
screens (320 pt) at 1.5-2× text, e.g. "Sunday Gha…" in the live header or a rider's bike line. They are 9-10 per device at normal text
and up to ~82 on the 320 pt phone at 2× text; none hides something a rider must read (the plates, speed, ETA, SOS and the primary
buttons never truncate).

Sanity check of the checker itself: a deliberately broken layout (a 700 pt-wide line, an 18 × 18 pt button) injected into a rendered
scene was reported as `page-hscroll`, `beyond-viewport`, `offscreen` and `target-small`, so a zero is a real zero for those classes.
Not covered by the checker: a text node clipped by its own element, and anything a browser engine cannot show (next section).

## 5. What only a device can verify

* The soft keyboard (iOS `padding`, Android `adjustResize`, `automaticallyAdjustKeyboardInsets`): the harness has no keyboard.
* The real OS font scaling: iOS Dynamic Type uses a non-linear curve per text style (the harness multiplies linearly, as
  Android does); Android "display size" changes density, which the harness approximates with the 320 x 568 / 360 x 640
  rows. `maxFontSizeMultiplier` and `adjustsFontSizeToFit` behave slightly differently in the native text engines.
* Foldables: the posture change, the hinge, and what `MainActivity.onConfigurationChanged` does on a real unfold.
  Gradle and Xcode cannot be built in this environment; the Kotlin and Info.plist edits are small and covered by a file
  test, but build and rotate on an emulator before release (`Pixel Fold`, a 7" tablet, an iPad).
* Real safe-area values (notch, Dynamic Island, gesture bar vs. three-button bar, edge-to-edge on Android 15). The matrix
  uses representative numbers.
* Mapbox: the harness draws a placeholder map; the camera padding is computed from the same layout numbers, but the
  framing of a route on a short screen should be looked at once on a device.
* Touch feel of 44 pt targets with gloves, and haptics.
