# demo.html — reference renders

One image per demo screen, sheet and overlay, rendered from `demo.html` in headless Chrome (390 × 844 pt, 1×;
garage screens in the light "Demo" theme, Road screens in night). These are the targets the production screens are
compared against. File prefix = order in the demo; names match the route/sheet names in `../DEMO_PARITY_SPEC.md`.

Garage: `01-splash` … `24-meetup`, `11b/c/d-home-*` (meetup / live / finished hero), `sheet-*`, `perm-prompt-location`,
`join-error`, `auth-otp-typed`, `meetup-waiting/ready`.
Road: `road-live`, `road-stop(-late)`, `road-arrive`, `live-gap`, `live-hazard-ahead`, `live-hazard-confirm`,
`live-signal-incoming`, `live-rider-nosignal`, `live-ptt`, `live-sheet-signals`, `live-sheet-hazard`.
SOS: `sos-sent`, `sos-queued`, `sos-drill`, `sos-auto`, `sos-incoming(-going)`, `crash-countdown`, `call-112`.

The demo shows fictional people and numbers; production shows only real data (see the spec).
