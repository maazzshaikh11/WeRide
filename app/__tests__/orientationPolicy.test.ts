/**
 * Orientation policy (docs/RESPONSIVE.md): phones are portrait-only, tablets rotate. These read the native project
 * files, which cannot be built here, so the test is what keeps the policy from silently regressing.
 */
import fs from 'fs';
import path from 'path';
import { TABLET_MIN_SIDE } from '../src/theme/responsive';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

/** Values of the string array that follows <key>name</key> in an Info.plist. */
function plistArray(plist: string, key: string): string[] {
  const m = plist.match(new RegExp(`<key>${key.replace(/[~]/g, '\\~')}</key>\\s*<array>([\\s\\S]*?)</array>`));
  if (!m) throw new Error(`${key} not found in Info.plist`);
  return Array.from(m[1].matchAll(/<string>([^<]+)<\/string>/g)).map((x) => x[1]);
}

describe('iOS orientations', () => {
  const plist = read('ios/weride/Info.plist');
  it('iPhone: portrait only', () => {
    expect(plistArray(plist, 'UISupportedInterfaceOrientations')).toEqual(['UIInterfaceOrientationPortrait']);
  });
  it('iPad: all four orientations', () => {
    expect(plistArray(plist, 'UISupportedInterfaceOrientations~ipad').sort()).toEqual([
      'UIInterfaceOrientationLandscapeLeft',
      'UIInterfaceOrientationLandscapeRight',
      'UIInterfaceOrientationPortrait',
      'UIInterfaceOrientationPortraitUpsideDown',
    ]);
  });
});

describe('Android orientations', () => {
  const activity = read('android/app/src/main/java/com/weride/MainActivity.kt');
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  it('locks portrait below 600 dp smallest width and lets tablets rotate', () => {
    expect(activity).toMatch(/smallestScreenWidthDp\s*<\s*TABLET_MIN_SMALLEST_WIDTH_DP/);
    expect(activity).toMatch(/TABLET_MIN_SMALLEST_WIDTH_DP\s*=\s*600/);
    expect(activity).toContain('SCREEN_ORIENTATION_PORTRAIT');
    expect(activity).toContain('SCREEN_ORIENTATION_UNSPECIFIED');
  });
  it('applies the policy on create (before the first frame) and on configuration changes (foldables)', () => {
    expect(activity).toMatch(/override fun onCreate[\s\S]*applyOrientationPolicy\(\)[\s\S]*super\.onCreate/);
    expect(activity).toMatch(/override fun onConfigurationChanged[\s\S]*applyOrientationPolicy\(newConfig\)/);
  });
  it('does not hard-code a manifest orientation that would override the policy', () => {
    expect(manifest).not.toMatch(/android:screenOrientation=/);
    expect(manifest).toMatch(/android:configChanges="[^"]*orientation[^"]*screenSize[^"]*smallestScreenSize/);
  });
});

describe('the JS tablet threshold matches the native one', () => {
  it('is 600', () => {
    expect(TABLET_MIN_SIDE).toBe(600);
  });
});
