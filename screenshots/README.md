# WeRide — screenshots

How the app looks right now, one image per screen/state. Phone-sized (390 × 844 pt) at 2×.
The main set is the **Demo theme, dark**. `themes/` shows the key screens in all four
theme × mode combinations: the layout is identical in each, only the colours change.

| | Screen | |
|---|---|---|
| `01-sign-in.png` | Sign in | the real logo, validated fields |
| `02-create-account.png` | Create account | confirm-password field enters when switching |
| `03-rides.png` | My rides | greeting, settings, join row, **Up next** ride pass with route map + join-code pill |
| `04-rides-full-list.png` | My rides (full list) | Up next / Your rides / Earlier sections, rides with and without a plan |
| `05-rides-empty.png` | My rides, no rides yet | |
| `06-create-ride.png` | Create ride | start, destination, stops, ride type, start time |
| `07-live-map.png` | Live ride | status plate, side buttons, **your avatar with the distance to the nearest rider pinned on its right**, speed / ETA, SOS · Signal · Hazard · Talk |
| `08-live-map-route-details.png` | Live ride, route details sheet | safety score, avoid-hazards, Google Maps hand-off |
| `09-sos-confirm.png` | SOS confirmation | |
| `10-quick-signals.png` | Quick signals sheet | |
| `11-report-hazard.png` | Report a hazard sheet | |
| `12-road-alerts.png` | Road alerts | report tiles, hazard cards |
| `13-planned-stops.png` | Planned stops | |
| `14-ride-history.png` | Ride history | |
| `15-group-voice.png` | Group voice | |
| `16-family.png` | Family | |
| `17-settings-appearance.png` | Settings → Appearance | theme (Demo / Ember) and mode (Light / Dark / System) |
| `themes/<theme>-<light\|dark>/` | Rides · live ride · route details · settings | `demo-light`, `demo-dark`, `ember-light`, `ember-dark` |

## What these are — and are not

These are **not device screenshots**. The app's real screens and components (real stores, real
styles, the bundled Overpass fonts) are rendered in headless Chromium with `react-native-web`,
and the native-only modules (Firebase, Mapbox, sockets, sensors, react-native-svg) are stubbed.
So:

- **Layout, type, colour and spacing are the app's own.** Exact native text metrics, shadows,
  `adjustsFontSizeToFit` and safe areas can differ slightly on a phone (for example the Rides
  greeting shrinks to fit on a phone instead of being cut off, and the active tab's icon sits on
  top of its accent well natively).
- **The map is a flat placeholder with a faint grid** — Mapbox tiles can't render in a browser.
  The route line and rider pins on the live map are therefore not shown, and the avatar is drawn
  at a fixed spot; everything *around* the map (plate, buttons, label, sheets) is real.
- **Ride-card thumbnails show the on-device route sketch** (planned waypoints joined by straight
  lines). On a phone with a Mapbox token and a connection, the real Mapbox map of the same points
  fades in over it.
- **Data is sample data** (rides, hazards, riders at ~100 m / ~220 m / ~380 m from you) seeded in
  `app/scripts/screenshots/scenes.tsx`. The app itself never invents any of it.
- Animations are shown at their resting state. Touch feedback (press, haptics) can't be shown in a still image.

## Regenerate

```
cd app/scripts/screenshots
CHROME=/path/to/chromium ./run.sh
```

Needs Node and a Chromium/Chrome binary; `run.sh` installs its own small dependency set
(`react-native-web`, `esbuild`) inside that folder. Any single scene in any theme can be opened
by hand: `index.html#map:ember:light` (scene : theme : scheme).
