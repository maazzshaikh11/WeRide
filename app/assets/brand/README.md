# Brand assets

**The app's logo is `logo.jpeg` in the repository root** (a byte-identical copy ships at
`app/assets/images/logo.jpeg`; `__tests__/logo.test.tsx` keeps them in sync). Everything the app
shows or installs is cut from that file:

| Where | How |
|---|---|
| Sign-in / splash inside the app | `src/components/Logo.tsx` crops `logo.jpeg` to its rounded tile |
| Android launcher icons (legacy, round, adaptive) and the Android launch screen | `scripts/generate-brand-assets.py` |
| iOS app icon set and the iOS launch screen logo | `scripts/generate-brand-assets.py` |

```
python3 scripts/generate-brand-assets.py      # needs Pillow + numpy; no browser
```

## The SVG files in this folder

| File | What it is |
|---|---|
| `logo-mark.svg` | A vector trace of the WR + road + pin mark, transparent background. |
| `logo.svg` | The trace on the rounded dark tile. |
| `app-icon.svg` | Full-bleed square version of the trace. |
| `logo-original.jpeg` | The raster the traces were made from. |

They are kept as the vector version of the logo for places that need one (print, web), but the
**app does not use them** — it uses `logo.jpeg`.
