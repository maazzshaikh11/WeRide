/// <reference types="node" />
/**
 * A font token without a bundled file silently falls back to the system font
 * (no error, just the wrong typeface), so check every token is actually shipped
 * on both platforms: file present in assets/fonts AND android assets, and listed
 * in the iOS Info.plist. PostScript name inside the file must equal the token.
 */
import fs from 'fs';
import path from 'path';
import { WeRideFonts } from '../src/theme/theme';

const root = path.resolve(__dirname, '..');
const names = Array.from(new Set(Object.values(WeRideFonts)));
const plist = fs.readFileSync(path.join(root, 'ios/weride/Info.plist'), 'utf8');

/** Reads nameID 6 (PostScript name) from a TTF without a font library. */
function postScriptName(file: string): string | null {
  const buf = fs.readFileSync(file);
  const numTables = buf.readUInt16BE(4);
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (buf.toString('ascii', rec, rec + 4) !== 'name') continue;
    const off = buf.readUInt32BE(rec + 8);
    const count = buf.readUInt16BE(off + 2);
    const strOff = off + buf.readUInt16BE(off + 4);
    for (let n = 0; n < count; n++) {
      const r = off + 6 + n * 12;
      const platform = buf.readUInt16BE(r);
      const nameId = buf.readUInt16BE(r + 6);
      if (nameId !== 6) continue;
      const len = buf.readUInt16BE(r + 8);
      const o = strOff + buf.readUInt16BE(r + 10);
      return platform === 3
        ? Buffer.from(buf.subarray(o, o + len)).swap16().toString('utf16le')
        : buf.toString('ascii', o, o + len);
    }
  }
  return null;
}

describe('bundled fonts', () => {
  it.each(names)('%s is bundled for iOS and Android with a matching PostScript name', (name) => {
    const rn = path.join(root, 'assets/fonts', `${name}.ttf`);
    const android = path.join(root, 'android/app/src/main/assets/fonts', `${name}.ttf`);
    expect(fs.existsSync(rn)).toBe(true);
    expect(fs.existsSync(android)).toBe(true);
    expect(plist).toContain(`<string>${name}.ttf</string>`);
    expect(postScriptName(rn)).toBe(name);
  });

  it('the old typefaces are gone from the bundle and the plist', () => {
    for (const old of ['BebasNeue-Regular', 'Inter-Regular', 'Inter-Bold', 'SpaceMono-Regular', 'SpaceMono-Bold', 'Figtree-Regular', 'Fraunces-SemiBold']) {
      expect(fs.existsSync(path.join(root, 'assets/fonts', `${old}.ttf`))).toBe(false);
      expect(plist).not.toContain(`${old}.ttf`);
    }
  });
});
