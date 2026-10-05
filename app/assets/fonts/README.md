# Fonts

| Font | Files | Used for | License |
|---|---|---|---|
| **Fraunces** (SemiBold, optical size 36, SOFT/WONK off) | `Fraunces-SemiBold.ttf` | titles, stat numbers | SIL OFL 1.1 — `OFL-Fraunces.txt` |
| **Figtree** (Regular, Medium, SemiBold, Bold) | `Figtree-*.ttf` | all UI text, labels | SIL OFL 1.1 — `OFL-Figtree.txt` |
| **Space Mono** Bold | `SpaceMono-Bold.ttf` | join codes only (letter clarity) | SIL OFL 1.1 |

Same pairing as the digitern frontend (Figtree + Fraunces).

The files are **static instances** cut from the Google Fonts variable fonts
(`fonttools varLib.instancer`), because React Native cannot pick weights from a variable font.
PostScript names equal the file names (`Figtree-SemiBold`, …): iOS matches `UIAppFonts` by
PostScript name, Android by file name in `android/app/src/main/assets/fonts`, so both resolve
the same `fontFamily` string from `src/theme/theme.ts`.

Adding a font = put the TTF here **and** in `android/app/src/main/assets/fonts`, list it in
`ios/weride/Info.plist` (`UIAppFonts`). `__tests__/fonts.test.ts` fails if any token in
`WeRideFonts` has no bundled file.
