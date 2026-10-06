#!/bin/bash
# Visual-parity harness: renders EVERY real screen / sheet / overlay of the app in headless Chrome (react-native-web) and
# puts each next to its demo reference (docs/demo-screens/<name>.png).
#
#   CHROME=/usr/bin/google-chrome app/scripts/screenshots/run.sh [scene ...]
#
# Output (scratchpad, NOT the repo):  $OUT (default below)
#   real/<name>.png        the real app at 2x of the 390x844 phone
#   compare/<name>.png     [demo | real] side by side
#   compare/sheet-NN.png   contact sheets, 4 pairs each
#   compare/INDEX.md       per scene: "rendered ok" or the errors
# With scene names as arguments only those are re-rendered (scene[:theme:scheme], e.g. 11-home:ember:dark);
# the compare images are rebuilt for everything that has been rendered.
# Responsiveness (device matrix, OS font scale, automatic layout check): see matrix.sh and docs/RESPONSIVE.md.
# Scenes live in scenes.tsx (keys = demo file names); stubs/ holds the native-module stand-ins; seed.ts the data.
set -e
cd "$(dirname "$0")"
: "${CHROME:?Set CHROME to a Chromium/Chrome binary}"
OUT="${OUT:-/tmp/claude-1000/-home-raj-dev-muaz/0c87c01f-33c3-4c77-bef7-5290091872cd/scratchpad}"
DEMO="$(cd ../../.. && pwd)/docs/demo-screens"
[ -d node_modules ] || npm install --no-audit --no-fund
node build.mjs
mkdir -p "$OUT/real"
if [ $# -gt 0 ]; then SCENES=("$@"); else SCENES=($(ls "$DEMO" | grep '\.png$' | sed 's/\.png$//')); fi
node shoot.mjs "$CHROME" "$OUT/real" "$OUT/results.partial.json" "${SCENES[@]}"
# merge results (partial runs keep earlier ones)
python3 - "$OUT/results.json" "$OUT/results.partial.json" <<'PY'
import json, os, sys
a = json.load(open(sys.argv[1])) if os.path.exists(sys.argv[1]) else {}
a.update(json.load(open(sys.argv[2])))
json.dump(a, open(sys.argv[1], 'w'), indent=1)
PY
python3 compare.py "$DEMO" "$OUT/real" "$OUT/compare" "$OUT/results.json"
echo "compare images: $OUT/compare"
