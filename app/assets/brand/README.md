# Brand assets

| File | What it is |
|---|---|
| `logo-mark.svg` | The WR + road + pin mark, transparent background. **Source of truth.** |
| `logo.svg` | The mark on the rounded dark tile (the original artwork's look). |
| `app-icon.svg` | Full-bleed square used to produce the iOS / Android icons (generated). |
| `logo-original.jpeg` | The raster artwork the SVGs were traced from. |

The SVGs were vectorised from `logo-original.jpeg` and cleaned by hand-tuned post-processing
(stray tile-edge glows removed, orange rebuilt as a real gradient, translations baked into
paths). They are 36 paths / ~48 KB.

`react-native-svg` is not a dependency, so the app displays PNGs rasterised from these SVGs.
To regenerate every icon and the in-app logo after editing an SVG:

```
CHROME=/path/to/chrome python3 scripts/generate-brand-assets.py   # needs Pillow
```

Outputs: `assets/images/logo-mark.png`, Android legacy + adaptive launcher icons
(`mipmap-*`, `mipmap-anydpi-v26`, `values/ic_launcher_background.xml`) and the iOS
`AppIcon.appiconset` (all iPhone sizes + 1024 marketing icon).
