#!/usr/bin/env bash
# WeRide security check. Run from anywhere:  scripts/security-check.sh
#   SKIP_AUDIT=1        skip the (network) npm audit step
#   AUDIT_FAIL_ON=high  fail when a package has production advisories of at least this severity (default: critical)
#   SKIP_JEST=1         skip the jest security suites
# Exits non-zero if any check FAILs. The jest suites (app/__tests__/security*.test.ts, secureStorage.test.ts) assert the
# same things more precisely; this script is the quick CI gate that needs no node_modules for the static checks.
set -u
cd "$(dirname "$0")/.."
ROOT=$(pwd)
FAILS=0
pass() { printf '  PASS  %s\n' "$1"; }
fail() { printf '  FAIL  %s\n' "$1"; FAILS=$((FAILS + 1)); }
warn() { printf '  WARN  %s\n' "$1"; }
section() { printf '\n== %s\n' "$1"; }

MAIN_MANIFEST=app/android/app/src/main/AndroidManifest.xml
DEBUG_MANIFEST=app/android/app/src/debug/AndroidManifest.xml
GRADLE=app/android/app/build.gradle
PLIST=app/ios/weride/Info.plist
# XML/Gradle with comments removed, so a comment that merely mentions a flag does not trip a check.
xml_nocomment() { perl -0pe 's/<!--.*?-->//gs' "$1"; }
gradle_nocomment() { perl -0pe 's{/\*.*?\*/}{}gs; s{^\s*//.*$}{}gm' "$1"; }

section "1. Secrets in tracked files (current tree)"
TRACKED=$(git ls-files 2>/dev/null | grep -vE '(^|/)package-lock\.json$|^graphify-out/|\.(png|jpe?g|ttf|gif|ico|webp|keystore)$' || true)
if [ -z "$TRACKED" ]; then warn "not a git checkout, skipped"; else
  PATTERNS=(
    'sk\.eyJ[A-Za-z0-9_-]{20,}'                 # Mapbox secret token
    'pk\.eyJ[A-Za-z0-9_-]{20,}'                 # Mapbox public token (should come from app/.env only)
    'AIza[0-9A-Za-z_-]{35}'                     # Google API key
    '-----BEGIN [A-Z ]*PRIVATE KEY-----'        # PEM private keys
    '"private_key"[[:space:]]*:[[:space:]]*"-----'  # service-account JSON
    'AKIA[0-9A-Z]{16}'                          # AWS access key id
    'xox[baprs]-[0-9A-Za-z-]{10,}'              # Slack
    'ghp_[A-Za-z0-9]{36}'                       # GitHub PAT
    'eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}'  # JWT
  )
  HIT=0
  for p in "${PATTERNS[@]}"; do
    # shellcheck disable=SC2086
    out=$(echo "$TRACKED" | xargs -d '\n' grep -InE -e "$p" 2>/dev/null | cut -c1-160 || true)
    if [ -n "$out" ]; then fail "secret pattern /$p/ matched:"; echo "$out" | sed 's/^/          /'; HIT=1; fi
  done
  [ "$HIT" = 0 ] && pass "no secret patterns in $(echo "$TRACKED" | wc -l) tracked files"
  BADFILES=$(git ls-files | grep -iE '(^|/)(\.env(\.[^/]*)?|google-services[^/]*\.json|GoogleService-Info[^/]*\.plist|keystore\.properties|[^/]*\.(jks|keystore|p12|p8|pem|mobileprovision)|[^/]*service-?account[^/]*\.json|firebase-adminsdk[^/]*\.json)$' | grep -vE '(\.env\.example|\.env\.d\.ts)$' || true)
  if [ -n "$BADFILES" ]; then fail "secret-bearing files are tracked:"; echo "$BADFILES" | sed 's/^/          /'; else pass "no secret-bearing file is tracked"; fi
fi

section "2. .gitignore coverage"
for pat in '.env' 'google-services.json' 'GoogleService-Info.plist' '*.jks' '*.keystore' 'keystore.properties' 'firebase-adminsdk-*.json' '*.p12' '*.mobileprovision' 'service-account*.json' '.env.production'; do
  if grep -qxF -- "$pat" .gitignore; then pass ".gitignore has $pat"; else fail ".gitignore is missing $pat"; fi
done

section "3. Android manifest and build"
M=$(xml_nocomment "$MAIN_MANIFEST")
echo "$M" | grep -q 'android:allowBackup="false"' && pass "allowBackup=false" || fail "allowBackup is not false"
echo "$M" | grep -q 'android:fullBackupContent=' && echo "$M" | grep -q 'android:dataExtractionRules=' && pass "fullBackupContent + dataExtractionRules set" || fail "backup rules not referenced"
echo "$M" | grep -q 'usesCleartextTraffic' && fail "usesCleartextTraffic present in the main manifest" || pass "no usesCleartextTraffic in main manifest"
echo "$M" | grep -q 'android:networkSecurityConfig="@xml/network_security_config"' && pass "network security config referenced" || fail "networkSecurityConfig not referenced"
xml_nocomment "$DEBUG_MANIFEST" | grep -q 'usesCleartextTraffic="true"' && fail "debug manifest allows blanket cleartext" || pass "debug manifest has no blanket cleartext"
MAIN_NSC=$(xml_nocomment app/android/app/src/main/res/xml/network_security_config.xml)
if echo "$MAIN_NSC" | grep -q 'cleartextTrafficPermitted="true"' || echo "$MAIN_NSC" | grep -q 'src="user"'; then fail "main network_security_config allows cleartext or user CAs"; else pass "main network_security_config: HTTPS only, system CAs"; fi
DBG_DOMAINS=$(xml_nocomment app/android/app/src/debug/res/xml/network_security_config.xml | grep -o '<domain[^>]*>[^<]*</domain>' | sed 's/<[^>]*>//g' | sort | tr '\n' ' ')
[ "$DBG_DOMAINS" = "10.0.2.2 127.0.0.1 localhost " ] && pass "debug cleartext limited to: $DBG_DOMAINS" || fail "debug cleartext domains are '$DBG_DOMAINS'"
G=$(gradle_nocomment "$GRADLE")
REL=$(echo "$G" | perl -0ne 'if (/buildTypes\s*\{.*?(release\s*\{.*?\n\s{8}\})/s) { print $1 }')
echo "$REL" | grep -q 'signingConfigs.debug' && fail "release buildType uses the DEBUG signing config" || pass "release is not signed with the debug key"
echo "$REL" | grep -q 'signingConfigs.release' && echo "$G" | grep -q 'GradleException' && pass "release signing config present and enforced" || fail "release signing config / enforcement missing"
echo "$G" | grep -q 'def enableProguardInReleaseBuilds = true' && echo "$REL" | grep -q 'shrinkResources' && pass "R8 + resource shrinking enabled for release" || fail "R8/shrinkResources not enabled for release"
EXPORTED=$(echo "$M" | grep -c 'android:exported="true"' || true)
[ "$EXPORTED" = "1" ] && pass "exactly one exported component (MainActivity launcher)" || fail "$EXPORTED exported components in the main manifest (expected 1)"

section "4. iOS"
grep -A1 'NSAllowsArbitraryLoads</key>' "$PLIST" | grep -q '<false/>' && pass "ATS NSAllowsArbitraryLoads=false" || fail "ATS allows arbitrary loads"
grep -q 'NSExceptionAllowsInsecureHTTPLoads\|NSAllowsArbitraryLoadsInWebContent' "$PLIST" && fail "ATS insecure exceptions present" || pass "no ATS insecure-HTTP exceptions"
grep -q 'NSAllowsLocalNetworking' "$PLIST" && warn "NSAllowsLocalNetworking is on (dev convenience): remove for the App Store build"

section "5. Source rules (app/src)"
OFF=$(grep -rnE 'new[[:space:]]+MMKV[[:space:]]*\(' app/src --include=*.ts --include=*.tsx | grep -v 'app/src/services/secureStorage.ts' || true)
[ -z "$OFF" ] && pass "no 'new MMKV(' outside services/secureStorage.ts" || { fail "unencrypted MMKV instances:"; echo "$OFF" | sed 's/^/          /'; }
LOGS=$(grep -rnE '(console\.(log|info|debug|warn|error)|\bwarn|\blogError)\(' app/src --include=*.ts --include=*.tsx \
  | grep -vE "^[^:]+:[0-9]+:[[:space:]]*(//|\*)" \
  | perl -ne 'my $l=$_; (my $c=$l) =~ s/describeRejected\([^)]*\)//g; $c =~ s/\x27(?:[^\x27\\]|\\.)*\x27|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/\x27\x27/g; print $l if $c =~ /\b(token|fcmToken|idToken|accessToken|password|otp|secret|credential|authorization|phone|email|lat|lng|latitude|longitude|payload|rawPayload|contacts?|number)\b/i' || true)
[ -z "$LOGS" ] && pass "no token/credential/position/phone passed to console or log helpers" || { fail "possible sensitive logging:"; echo "$LOGS" | sed 's/^/          /'; }
UNSAFE=$(grep -rnE '\beval[[:space:]]*\(|new[[:space:]]+Function[[:space:]]*\(|dangerouslySetInnerHTML|react-native-webview|<WebView' app/src --include=*.ts --include=*.tsx || true)
[ -z "$UNSAFE" ] && pass "no eval / new Function / WebView / dangerouslySetInnerHTML" || { fail "unsafe constructs:"; echo "$UNSAFE" | sed 's/^/          /'; }
grep -v '^[[:space:]]*\(//\|\*\|/\*\)' app/src/utils/joinCode.ts | grep -q 'Math\.random' && fail "joinCode.ts uses Math.random" || pass "joinCode.ts does not use Math.random"

section "6. Dependency audit (production dependencies)"
if [ "${SKIP_AUDIT:-0}" = "1" ]; then warn "skipped (SKIP_AUDIT=1)"; elif ! command -v npm >/dev/null; then warn "npm not found, skipped"; else
  LEVEL=${AUDIT_FAIL_ON:-critical}
  for d in app modules/tracking modules/hazard-sos modules/routing-eta modules/routing-eta/server modules/fl-voice infra/firebase/functions infra/firebase/seed infra/firebase/rules-test app/scripts/screenshots; do
    [ -f "$d/package-lock.json" ] || { warn "$d: no package-lock.json (not auditable, versions float)"; continue; }
    J=$( (cd "$d" && npm audit --omit=dev --json 2>/dev/null) || true)
    LINE=$(echo "$J" | node -e '
      let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{try{const v=JSON.parse(s).metadata.vulnerabilities;
      console.log(["critical","high","moderate","low"].map(k=>k+"="+v[k]).join(" ")+"|"+v.critical+"|"+v.high)}catch(e){console.log("audit unavailable|0|0")}})')
    TXT=${LINE%%|*}; REST=${LINE#*|}; CRIT=${REST%%|*}; HIGH=${REST#*|}
    printf '  INFO  %-32s %s\n' "$d" "$TXT"
    if [ "$LEVEL" = "critical" ] && [ "$CRIT" -gt 0 ] 2>/dev/null; then fail "$d: $CRIT critical production advisories"; fi
    if [ "$LEVEL" = "high" ] && [ $((CRIT + HIGH)) -gt 0 ] 2>/dev/null; then fail "$d: $((CRIT + HIGH)) critical/high production advisories"; fi
  done
  echo "  (see docs/SECURITY.md for the reachability triage of the remaining advisories)"
fi

section "7. Jest security suites"
if [ "${SKIP_JEST:-0}" = "1" ]; then warn "skipped (SKIP_JEST=1)"; elif [ -d app/node_modules ]; then
  if (cd app && npx jest __tests__/security.test.ts __tests__/secureStorage.test.ts __tests__/secureRoot.test.tsx --silent >/tmp/weride-sec-jest.log 2>&1); then pass "app security suites"; else fail "app security suites (see /tmp/weride-sec-jest.log)"; tail -30 /tmp/weride-sec-jest.log | sed 's/^/          /'; fi
else warn "app/node_modules missing, skipped"; fi

printf '\n'
if [ "$FAILS" -gt 0 ]; then printf 'security-check: %d FAILED\n' "$FAILS"; exit 1; fi
printf 'security-check: all checks passed\n'
