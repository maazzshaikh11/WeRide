---
### Byte 8: The UI system, quality gates — and putting it all together
*Builds on:* Bytes 1–7 (this is how the screens are built and kept honest)

*In plain terms:*
All screens share one small **design system** (the approved "Signage" design): one type scale, a set of building blocks (plates, cards, buttons, sheets) and **colour palettes**. There are two themes — *Demo* and *Ember* — each in light and dark, so four palettes in all. Switching theme or mode changes **only colours**; layout, spacing and type are identical. A set of automated checks keeps behaviour and style from drifting.

*The code:*
```ts
// every screen reads colours and text styles from the active theme
const { colors, type } = useTheme();
const styles = useStyles(({ colors }) => ({ card: { backgroundColor: colors.card } }));
```
```ts
// theme/palettes.ts — the only thing that differs between themes
THEMES.ember.dark.pri  // '#FF4D00'     THEMES.demo.dark.pri  // '#FFC20E'
```

*How it fits together:*
- **Palettes** (`theme/palettes.ts`): `demo` and `ember` × `light` and `dark`. Each also carries a high-contrast `road` variant used on the live ride screen. Road-sign plate colours (green = fine, yellow = caution, red = SOS) are the same in every theme because they carry meaning.
- **Choosing a theme**: `themeStore` keeps the rider's theme and mode (Light / Dark / **System**, which follows the phone) on the device; `ThemeProvider` resolves them, and Settings → Appearance changes them.
- **Type** (`theme/typography.ts`): one scale in Overpass (Overpass Mono for numbers). Sizes, line heights and tracking are the same in all four palettes — a test enforces it.
- **Building blocks** (`app/src/ui`): `Button`, `TextField`, `Plate`, `Card`/`List`, `Sheet`, `Segmented`, `Toggle`, `Icon`… plus the press feedback primitives (`PressableScale`). They use only opacity/transform on the native driver and respect the OS "reduce motion" setting.
- **Fonts** (`assets/fonts`) are static instances cut from variable fonts — React Native can't pick weights from a variable font. Each token's PostScript name must equal its file name; a test checks every token has a bundled file on iOS *and* Android.
- **Logo**: the real `logo.jpeg`, shown by `<Logo>` and used to cut the app icons and launch screens (`scripts/generate-brand-assets.py`).
- **Quality gates:** each package runs *lint → typecheck → test* (CI, one job per package). App tests mock native modules at the boundary; the server uses Node's built-in test runner. `app/scripts/screenshots` renders real screens in a browser, in any theme, to regenerate the `screenshots/` folder.

---
## PUTTING IT TOGETHER

A rider signs in and opens a ride from the **Rides screen** (Byte 7), which resets the **shared stores** and enters the **app shell** (Byte 2). On the map, the **tracking module** fuses sensors into a verified position every second and publishes it (Byte 3); the app also feeds that position to its own route store. The position travels over the **live socket** to the crew while a throttled copy lands in **Firestore** (Byte 4). With a destination set, the rider's position becomes the origin for a **route/ETA request**, and the camera frames the result (Byte 5). Riders' hazard reports are clustered and shared, and an SOS is written locally first, then synced and pushed to the group even after a signal gap (Byte 6). Everything is drawn with one **design system** and guarded by automated checks (this byte), on top of a modular, contract-first structure (Byte 1).
