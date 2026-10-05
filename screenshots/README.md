# WeRide — screenshots

How the app looks right now (dark Ember theme), one image per screen/state. Phone-sized (390 × 844 pt) at 2×.

| | Screen | |
|---|---|---|
| `01-sign-in.png` | Sign in | brand logo, validated fields |
| `02-create-account.png` | Create account | confirm-password field enters when switching |
| `03-rides.png` | My rides | greeting, join row, **Up next** ride card with route map + join-code pill |
| `04-rides-full-list.png` | My rides (full list) | Up next / Your rides / Earlier sections, rides with and without a plan |
| `05-rides-empty.png` | My rides, no rides yet | |
| `06-create-ride.png` | Create ride | start, destination, stops, ride type, start time |
| `07-live-map.png` | Live map | header, FAB column, collapsed route sheet |
| `08-live-map-route-details.png` | Live map, route sheet expanded | safety score, avoid-hazards, Google Maps hand-off; FABs ride up with the sheet |
| `09-sos-confirm.png` | SOS confirmation | |
| `10-quick-signals.png` | Quick signals menu | |
| `11-road-alerts.png` | Road alerts | report chips, hazard cards |
| `12-planned-stops.png` | Planned stops | |
| `13-ride-history.png` | Ride history | |
| `14-group-voice.png` | Group voice | |
| `15-family.png` | Family | |

## What these are — and are not

These are **not device screenshots**. The app's real screens and components (real stores, real
styles, the bundled Bebas Neue / Inter / Space Mono fonts) are rendered in headless Chromium with
`react-native-web`, and the native-only modules (Firebase, Mapbox, sockets, sensors) are stubbed.
So:

- **Layout, type, colour and spacing are the app's own.** Exact native text metrics, shadows and
  safe areas can differ slightly on a phone.
- **The map is a dark placeholder with a faint grid** — Mapbox tiles can't render in a browser.
  The route, pins and your position on the live map are therefore not shown; everything *around*
  the map (header, buttons, route sheet) is real.
- **Ride-card thumbnails show the on-device route sketch** (planned waypoints joined by straight
  lines). On a phone with a Mapbox token and a connection, the real Mapbox map of the same points
  fades in over it.
- **Data is sample data** (rides, hazards, riders) seeded in `app/scripts/screenshots/scenes.tsx`.
- Animations are shown at their resting state. Touch feedback (press, hover-like card response,
  haptics) can't be shown in a still image.

## Regenerate

```
cd app/scripts/screenshots
CHROME=/path/to/chromium ./run.sh            # all scenes
CHROME=/path/to/chromium ./run.sh map alerts  # some scenes
```

Needs Node and a Chromium/Chrome binary; `run.sh` installs its own small dependency set
(`react-native-web`, `esbuild`) inside that folder.
