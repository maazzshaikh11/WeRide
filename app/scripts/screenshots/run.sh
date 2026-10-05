#!/bin/bash
# Renders every scene to ../../../screenshots/*.png (phone-sized, 2x).
#   CHROME=/path/to/chrome ./run.sh            # all scenes
#   CHROME=/path/to/chrome ./run.sh map alerts # some scenes
set -e
cd "$(dirname "$0")"
: "${CHROME:?Set CHROME to a Chromium/Chrome binary}"
[ -d node_modules ] || npm install --no-audit --no-fund
node build.mjs
OUT="$(cd ../../.. && pwd)/screenshots"; mkdir -p "$OUT"
shoot() { # name file [height]
  local h=${3:-844}
  "$CHROME" --headless --no-sandbox --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --window-size=390,$h --virtual-time-budget=3500 --screenshot="$OUT/$2.png" "file://$PWD/index.html#$1" >/dev/null 2>&1
  echo "$2.png"
}
declare -A FILES=(
  [login]=01-sign-in [login-create]=02-create-account [groups]=03-rides [groups-tall]=04-rides-full-list
  [groups-empty]=05-rides-empty [create-ride]=06-create-ride [map]=07-live-map [map-expanded]=08-live-map-route-details
  [sos]=09-sos-confirm [signals]=10-quick-signals [alerts]=11-road-alerts [stops]=12-planned-stops
  [history]=13-ride-history [voice]=14-group-voice [family]=15-family
)
SCENES=("$@"); [ ${#SCENES[@]} -eq 0 ] && SCENES=(login login-create groups groups-tall groups-empty create-ride map map-expanded sos signals alerts stops history voice family)
for s in "${SCENES[@]}"; do
  if [ "$s" = groups-tall ]; then shoot "$s" "${FILES[$s]}" 1900; else shoot "$s" "${FILES[$s]}"; fi
done
