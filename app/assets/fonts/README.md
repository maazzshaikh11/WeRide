# Fonts

| Font | Files | Used for | License |
|---|---|---|---|
| **Overpass** (Medium 500, Bold 700, ExtraBold 800, Black 900) | `Overpass-*.ttf` | all UI text, titles | SIL OFL 1.1 — `OFL-Overpass.txt` |
| **Overpass Mono** Bold 700 | `OverpassMono-Bold.ttf` | numbers: speed, ETA, distances, codes | SIL OFL 1.1 — `OFL-Overpass.txt` |

The same typeface as the approved `demo.html`.

The files are **static instances** cut from the Google Fonts variable fonts
(`fonttools varLib.instancer`), because React Native cannot pick weights from a variable font.
The demo uses a continuous weight range (500–900); four static weights stand in for it:
Medium 500 · Bold 700 (demo 650–750) · ExtraBold 800 (800–850) · Black 900.

PostScript names equal the file names (`Overpass-Bold`, …): iOS matches `UIAppFonts` by
PostScript name, Android by file name in `android/app/src/main/assets/fonts`, so both resolve
the same `fontFamily` string from `src/theme/theme.ts`. On iOS the files live in
`ios/weride/Fonts` and are listed in the Xcode project's Resources phase.

Adding a font = put the TTF here, in `android/app/src/main/assets/fonts` and `ios/weride/Fonts`,
list it in `ios/weride/Info.plist` (`UIAppFonts`) and the Xcode project.
`__tests__/fonts.test.ts` fails if any token in `WeRideFonts` has no bundled file.
