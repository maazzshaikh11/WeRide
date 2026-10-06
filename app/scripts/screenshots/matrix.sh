#!/bin/bash
# Responsive matrix: renders every scene on a device matrix (devices.json) at several OS font scales in headless Chrome
# (react-native-web, same stubs as run.sh), runs the DOM layout check (layoutcheck.js) after each scene settles and writes
# a per-configuration JSON, a human summary and contact sheets. See docs/RESPONSIVE.md.
#
#   CHROME=/usr/bin/google-chrome app/scripts/screenshots/matrix.sh [scene ...]      (no scenes = every file in docs/demo-screens)
#
# Env (all optional):
#   DEVICES   comma list of keys of devices.json, or "all" (default all). e.g. DEVICES=iphone-se,android-xs
#   FONTS     comma list of font scales (default 1,1.3,1.5,2)
#   JOBS      parallel Chrome tabs (default 5)
#   SHOTS     1 = also write PNGs (default 1)
#   SHEETS    contact sheets to build, "device:fontScale,..." (default android-xs:2,iphone-se:1,ipad:1)
#   BASELINE  layout dir of an earlier run: adds a "before" column to the report
#   OS        android = render the Android branches (Platform.OS), default ios
#   OUT       output dir (default: the scratchpad resp/ dir). Outputs: $OUT/layout/<device>__fs<scale>/<scene>.json,
#             $OUT/layout-report.md, $OUT/summary.json, $OUT/shots/<device>/fs<scale>/<scene>.png, $OUT/sheets/*.png
set -e
cd "$(dirname "$0")"
: "${CHROME:?Set CHROME to a Chromium/Chrome binary}"
OUT="${OUT:-/tmp/claude-1000/-home-raj-dev-muaz/0c87c01f-33c3-4c77-bef7-5290091872cd/scratchpad/resp/final}"
DEMO="$(cd ../../.. && pwd)/docs/demo-screens"
[ -d node_modules ] || npm install --no-audit --no-fund
export BUNDLE="${BUNDLE:-scenes.matrix.js}"
node build.mjs
if [ $# -gt 0 ]; then SCENES=("$@"); else SCENES=($(ls "$DEMO" | grep '\.png$' | sed 's/\.png$//')); fi
export DEVICES="${DEVICES:-all}" FONTS="${FONTS:-1,1.3,1.5,2}" JOBS="${JOBS:-5}" SHOTS="${SHOTS:-1}" LAYOUT="$OUT/layout"
mkdir -p "$OUT"
node shoot.mjs "$CHROME" "$OUT/shots" "$OUT/results.json" "${SCENES[@]}"
ARGS=("$LAYOUT" "$OUT" --title "Layout report" --sheets "${SHEETS:-android-xs:2,iphone-se:1,ipad:1}" --shots "$OUT/shots")
[ -n "$BASELINE" ] && ARGS+=(--baseline "$BASELINE")
python3 report.py "${ARGS[@]}"
echo "report: $OUT/layout-report.md"
