/**
 * Security regression tests. They read the real manifests / Gradle / plist / gitignore / sources, so a change that
 * weakens the posture (cleartext, debug signing, backups on, unencrypted MMKV, secrets or tokens in logs...) fails CI.
 * Runtime behaviour that is security-relevant (join codes, sms: links) is tested in this file as well.
 */
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

const APP = path.resolve(__dirname, '..');
const ROOT = path.resolve(APP, '..');
const read = (...p: string[]) => fs.readFileSync(path.join(...p), 'utf8');
const stripXmlComments = (s: string) => s.replace(/<!--[\s\S]*?-->/g, '');
const stripGradleComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const MAIN = path.join(APP, 'android/app/src/main');
const DEBUG = path.join(APP, 'android/app/src/debug');
const mainManifest = () => stripXmlComments(read(MAIN, 'AndroidManifest.xml'));

function walk(dir: string, exts: string[], out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '__tests__') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, exts, out);
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}
const SRC_FILES = walk(path.join(APP, 'src'), ['.ts', '.tsx']);

function gitTracked(): string[] | null {
  try {
    return execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean);
  } catch {
    return null; // not a git checkout (e.g. source tarball): the git-based checks are skipped
  }
}

describe('Android manifest', () => {
  it('backups are off and app storage is excluded if they are ever turned on', () => {
    const m = mainManifest();
    expect(m).toMatch(/android:allowBackup="false"/);
    expect(m).toMatch(/android:fullBackupContent="@xml\/backup_rules"/);
    expect(m).toMatch(/android:dataExtractionRules="@xml\/data_extraction_rules"/);
    const rules = stripXmlComments(read(MAIN, 'res/xml/backup_rules.xml')) + stripXmlComments(read(MAIN, 'res/xml/data_extraction_rules.xml'));
    for (const domain of ['root', 'file', 'database', 'sharedpref']) expect(rules).toContain(`<exclude domain="${domain}"`);
    expect(rules).not.toMatch(/<include\b/);
  });

  it('has no cleartext flag in the main manifest and references the network security config', () => {
    const m = mainManifest();
    expect(m).not.toMatch(/usesCleartextTraffic/);
    expect(m).toMatch(/android:networkSecurityConfig="@xml\/network_security_config"/);
  });

  it('the debug manifest does not blanket-allow cleartext either', () => {
    expect(stripXmlComments(read(DEBUG, 'AndroidManifest.xml'))).not.toMatch(/usesCleartextTraffic="true"/);
  });

  it('main network security config: HTTPS only, system CAs only, no cleartext exceptions', () => {
    const c = stripXmlComments(read(MAIN, 'res/xml/network_security_config.xml'));
    expect(c).toMatch(/<base-config cleartextTrafficPermitted="false"/);
    expect(c).not.toMatch(/cleartextTrafficPermitted="true"/);
    expect(c).not.toMatch(/src="user"/);
    expect(c).not.toMatch(/<domain-config/);
  });

  it('debug network security config allows cleartext only for localhost, 127.0.0.1 and 10.0.2.2', () => {
    const c = stripXmlComments(read(DEBUG, 'res/xml/network_security_config.xml'));
    expect(c).toMatch(/<base-config cleartextTrafficPermitted="false"/);
    const allowed = [...c.matchAll(/<domain-config cleartextTrafficPermitted="true">([\s\S]*?)<\/domain-config>/g)];
    const domains = allowed.flatMap((m) => [...m[1].matchAll(/<domain[^>]*>([^<]+)<\/domain>/g)].map((d) => d[1].trim()));
    expect(domains.sort()).toEqual(['10.0.2.2', '127.0.0.1', 'localhost']);
    expect(c).not.toMatch(/src="user"/);
  });

  it('exported components: only the launcher activity is exported by the app itself', () => {
    const exported = [...mainManifest().matchAll(/<(activity|service|receiver|provider)\b[^>]*>/g)].filter((m) => /android:exported="true"/.test(m[0]));
    expect(exported).toHaveLength(1);
    expect(exported[0][0]).toContain('.MainActivity');
    expect(mainManifest()).toMatch(/<action android:name="android.intent.action.MAIN"/);
  });

  it('permissions are limited to the reviewed set (no storage, contacts, SMS, phone, camera, accounts)', () => {
    const perms = [...mainManifest().matchAll(/<uses-permission android:name="([^"]+)"(?![^>]*tools:node="remove")/g)].map((m) => m[1].replace('android.permission.', ''));
    expect(perms.sort()).toEqual(
      [
        'ACCESS_BACKGROUND_LOCATION', 'ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_LOCATION',
        'HIGH_SAMPLING_RATE_SENSORS', 'INTERNET', 'POST_NOTIFICATIONS', 'RECORD_AUDIO', 'VIBRATE', 'WAKE_LOCK',
      ].sort(),
    );
    expect(mainManifest()).toMatch(/USE_BIOMETRIC"[^>]*tools:node="remove"/);
  });
});

describe('Android release build', () => {
  const gradle = stripGradleComments(read(APP, 'android/app/build.gradle'));
  const releaseBlock = gradle.slice(gradle.indexOf('release {', gradle.indexOf('buildTypes')));

  it('is not signed with the debug key and fails without release credentials', () => {
    expect(releaseBlock).not.toMatch(/signingConfigs\.debug/);
    expect(releaseBlock).toMatch(/signingConfig signingConfigs\.release/);
    expect(gradle).toMatch(/keystore\.properties/);
    expect(gradle).toMatch(/throw new GradleException/);
    expect(gradle).toMatch(/hasReleaseSigning/);
  });

  it('uses R8 and resource shrinking, and is not debuggable', () => {
    expect(gradle).toMatch(/def enableProguardInReleaseBuilds = true/);
    expect(releaseBlock).toMatch(/minifyEnabled enableProguardInReleaseBuilds/);
    expect(releaseBlock).toMatch(/shrinkResources enableProguardInReleaseBuilds/);
    expect(releaseBlock).toMatch(/debuggable false/);
  });

  it('keeps the native libraries that are loaded by reflection/JNI', () => {
    const rules = read(APP, 'android/app/proguard-rules.pro');
    for (const pkg of ['io.invertase.firebase', 'com.rnmapbox.rnmbx', 'org.webrtc', 'com.reactnativemmkv', 'com.oblador.keychain', 'com.transistorsoft', 'com.horcrux.svg']) {
      expect(rules).toContain(pkg);
    }
  });

  it('a template for the signing properties exists and carries no secret', () => {
    const ex = read(APP, 'android/keystore.properties.example');
    expect(ex).toMatch(/^STORE_PASSWORD=$/m);
    expect(ex).toMatch(/^KEY_PASSWORD=$/m);
  });
});

describe('iOS', () => {
  const plist = read(APP, 'ios/weride/Info.plist');
  const ats = plist.slice(plist.indexOf('<key>NSAppTransportSecurity</key>'));
  const atsDict = ats.slice(0, ats.indexOf('</dict>') + 7);

  it('App Transport Security does not allow arbitrary loads', () => {
    expect(atsDict).toMatch(/<key>NSAllowsArbitraryLoads<\/key>\s*<false\/>/);
    expect(plist).not.toMatch(/NSAllowsArbitraryLoadsInWebContent<\/key>\s*<true/);
    expect(plist).not.toMatch(/NSAllowsArbitraryLoadsForMedia<\/key>\s*<true/);
    expect(plist).not.toMatch(/NSExceptionAllowsInsecureHTTPLoads/);
    expect(plist).not.toMatch(/NSExceptionDomains/);
  });

  it('declares only the background modes the app needs and has usage strings for what it asks', () => {
    const modes = plist.match(/<key>UIBackgroundModes<\/key>\s*<array>([\s\S]*?)<\/array>/);
    expect(modes).not.toBeNull();
    expect([...modes![1].matchAll(/<string>([^<]+)<\/string>/g)].map((m) => m[1]).sort()).toEqual(['location', 'remote-notification']);
    for (const k of ['NSLocationWhenInUseUsageDescription', 'NSLocationAlwaysAndWhenInUseUsageDescription', 'NSMicrophoneUsageDescription', 'NSMotionUsageDescription']) {
      expect(plist).toMatch(new RegExp(`<key>${k}</key>\\s*<string>[^<]{30,}</string>`));
    }
    for (const k of ['NSCameraUsageDescription', 'NSContactsUsageDescription', 'NSPhotoLibraryUsageDescription']) expect(plist).not.toContain(k);
  });
});

describe('repository hygiene', () => {
  const gitignore = read(ROOT, '.gitignore').split('\n').map((l) => l.trim());
  it.each([
    '.env', 'google-services.json', 'GoogleService-Info.plist', '*.jks', '*.keystore', 'keystore.properties', 'firebase-adminsdk-*.json',
    '*.p12', '*.mobileprovision', 'service-account*.json', '.env.production',
  ])('.gitignore covers %s', (pattern) => {
    expect(gitignore).toContain(pattern);
  });

  it('no secret-bearing file is tracked by git', () => {
    const files = gitTracked();
    if (!files) return;
    const bad = files.filter((f) =>
      /(^|\/)(\.env(\.(?!example$|d\.ts$)[^/]*)?|google-services[^/]*\.json|GoogleService-Info[^/]*\.plist|keystore\.properties|[^/]*\.(jks|keystore|p12|p8|pem|mobileprovision)|[^/]*service-?account[^/]*\.json|firebase-adminsdk[^/]*\.json)$/i.test(f),
    );
    expect(bad).toEqual([]);
  });

  it('no real-looking credential literal in tracked source (Mapbox sk./pk. tokens, Google API keys, private keys)', () => {
    const files = gitTracked();
    if (!files) return;
    const re = /(\bsk\.eyJ[A-Za-z0-9_-]{20,}|\bpk\.eyJ[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{35}|-----BEGIN [A-Z ]*PRIVATE KEY-----|"private_key"\s*:\s*"-----)/;
    const hits = files
      .filter((f) => /\.(ts|tsx|js|jsx|json|gradle|xml|plist|properties|md|sh|yml|yaml|html|mjs|py)$/.test(f) && !/package-lock\.json$|^graphify-out\//.test(f))
      .filter((f) => {
        try {
          return re.test(fs.readFileSync(path.join(ROOT, f), 'utf8'));
        } catch {
          return false;
        }
      });
    expect(hits).toEqual([]);
  });
});

describe('source rules (app/src)', () => {
  it('no MMKV instance is created outside services/secureStorage', () => {
    const offenders = SRC_FILES.filter((f) => !f.endsWith(path.join('services', 'secureStorage.ts')) && /new\s+MMKV\s*\(/.test(read(f)));
    expect(offenders.map((f) => path.relative(APP, f))).toEqual([]);
  });

  it('every store uses the encrypted opener', () => {
    for (const f of ['store/prefsStore.ts', 'store/crewsStore.ts', 'theme/themeStore.ts', 'services/pendingLogs.ts', 'services/localStorage.ts']) {
      expect(read(APP, 'src', f)).toMatch(/getEncryptedMMKV\(/);
    }
    expect(read(APP, 'src/services/rideRecorder.ts')).toMatch(/getEncryptedMMKV\('ride_recorder'\)/);
  });

  it('no token / credential / position / phone is passed to console or the log helpers', () => {
    const SENSITIVE = /\b(token|fcmtoken|idtoken|accesstoken|password|otp|secret|credential|authorization|phone|email|lat|lng|latitude|longitude|payload|rawpayload|contacts?|number)\b/i;
    const offenders: string[] = [];
    for (const f of SRC_FILES) {
      read(f).split('\n').forEach((line, i) => {
        if (!/\b(console\.(log|info|debug|warn|error)|warn|logError)\(/.test(line)) return;
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
        const code = line
          .replace(/describeRejected\([^)]*\)/g, '') // logs only the shape (key names) of a rejected payload
          .replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''"); // ignore words inside message text
        if (SENSITIVE.test(code)) offenders.push(`${path.relative(APP, f)}:${i + 1}: ${line.trim().slice(0, 120)}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('no eval, new Function, WebView or dangerouslySetInnerHTML', () => {
    const offenders = SRC_FILES.filter((f) => /\beval\s*\(|new\s+Function\s*\(|dangerouslySetInnerHTML|react-native-webview|<WebView\b/.test(read(f)));
    expect(offenders.map((f) => path.relative(APP, f))).toEqual([]);
  });

  it('Math.random is not used for join codes', () => {
    expect(stripGradleComments(read(APP, 'src/utils/joinCode.ts'))).not.toMatch(/Math\.random/); // (comment stripper works for TS too)
  });

  it('has no deep-link surface: no linking config, URL listeners or custom scheme intent filters', () => {
    const offenders = SRC_FILES.filter((f) => /getInitialURL|addEventListener\(\s*['"]url['"]|linking\s*=\s*\{|prefixes\s*:/.test(read(f)));
    expect(offenders.map((f) => path.relative(APP, f))).toEqual([]);
    expect(mainManifest()).not.toMatch(/<data\b|android\.intent\.action\.VIEW|BROWSABLE/);
    expect(read(APP, 'ios/weride/Info.plist')).not.toContain('CFBundleURLTypes');
  });
});

describe('join codes', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { generateJoinCode, JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH } = require('../src/utils/joinCode');

  it('come from crypto.getRandomValues, never Math.random', () => {
    const grv = jest.spyOn(globalThis.crypto, 'getRandomValues');
    const mr = jest.spyOn(Math, 'random');
    const code = generateJoinCode();
    expect(code).toMatch(new RegExp(`^[${JOIN_CODE_ALPHABET}]{${JOIN_CODE_LENGTH}}$`));
    expect(grv).toHaveBeenCalled();
    expect(mr).not.toHaveBeenCalled();
    grv.mockRestore();
    mr.mockRestore();
  });

  it('are unbiased enough: every symbol appears, no collisions in 2000 codes', () => {
    const seen = new Set<string>();
    const symbols = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const c = generateJoinCode();
      seen.add(c);
      for (const ch of c) symbols.add(ch);
    }
    expect(symbols.size).toBe(JOIN_CODE_ALPHABET.length);
    expect(seen.size).toBe(2000);
  });

  it('refuse to generate without a secure random source instead of degrading', () => {
    const real = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      expect(() => generateJoinCode()).toThrow(/secure random/);
    } finally {
      if (real) Object.defineProperty(globalThis, 'crypto', real);
    }
  });
});

describe('sms: links', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { smsLink, smsRecipient } = require('../src/services/sosFormat');

  it('only digits and a leading + reach the URL, so a hostile number cannot inject parameters', () => {
    expect(smsRecipient('+91 98000-00000')).toBe('+919800000000');
    const url = smsLink('+919800000000?body=pwned&x=1;/../', 'A', null);
    expect(url.startsWith('sms:+919800000000')).toBe(true);
    expect(url.split('?')).toHaveLength(2); // exactly one query: our own body
    expect(url).not.toMatch(/pwned|;|\.\./);
  });

  it('encodes the body (names and coordinates cannot break out of it)', () => {
    const url = smsLink('+911234567890', 'Bob&body=x#frag ?', { lat: 1, lng: 2 });
    const body = url.split('?body=')[1];
    expect(body).not.toMatch(/[ &#?]/);
    expect(decodeURIComponent(body)).toContain('Bob&body=x#frag ?');
  });
});
