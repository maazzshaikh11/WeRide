#!/bin/bash
# Renders the app's real screens to ../../../screenshots (phone-sized, 2x).
#   CHROME=/path/to/chrome ./run.sh
# Writes:
#   screenshots/*.png                         every scene, Demo theme, dark
#   screenshots/themes/<theme>-<scheme>/*.png the key screens in all four theme/mode combinations
set -e
cd "$(dirname "$0")"
: "${CHROME:?Set CHROME to a Chromium/Chrome binary}"
[ -d node_modules ] || npm install --no-audit --no-fund
node build.mjs
ROOT="$(cd ../../.. && pwd)/screenshots"; mkdir -p "$ROOT"
shoot() { # scene[:theme:scheme] outfile [height]
  "$CHROME" --headless --no-sandbox --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --window-size=390,${3:-844} --virtual-time-budget=6000 --screenshot="$2" "file://$PWD/index.html#$1" >/dev/null 2>&1
  echo "${2#$ROOT/}"
}
declare -A FILES=(
  [login]=01-sign-in [login-create]=02-create-account [groups]=03-rides [groups-tall]=04-rides-full-list
  [groups-empty]=05-rides-empty [create-ride]=06-create-ride [map]=07-live-map [map-expanded]=08-live-map-route-details
  [sos]=09-sos-confirm [signals]=10-quick-signals [hazards]=11-report-hazard [alerts]=12-road-alerts [stops]=13-planned-stops
  [history]=14-ride-history [voice]=15-group-voice [family]=16-family [settings]=17-settings-appearance
)
ORDER=(login login-create groups groups-tall groups-empty create-ride map map-expanded sos signals hazards alerts stops history voice family settings)
for s in "${ORDER[@]}"; do
  h=844; [ "$s" = groups-tall ] && h=1900
  shoot "$s:demo:dark" "$ROOT/${FILES[$s]}.png" $h
done
for t in demo ember; do for m in light dark; do
  mkdir -p "$ROOT/themes/$t-$m"
  for s in groups map map-expanded settings; do shoot "$s:$t:$m" "$ROOT/themes/$t-$m/${FILES[$s]}.png"; done
done; done
