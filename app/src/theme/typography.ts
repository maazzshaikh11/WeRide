/**
 * Type scale — the single source for text styles, taken from the approved demo.html.
 *
 * It is a function of the palette only for the colour each role implies
 * (`ink` / `ink2` / `ink3`); sizes, line heights, tracking and fonts are the
 * same in every theme. Rules (enforced by __tests__/typography.test.ts):
 *  - sizes in half-point steps, nothing below 10.5 (tab labels) / 11 (everything else);
 *  - every style carries a lineHeight >= its fontSize;
 *  - weight comes from the font FILE (Overpass-Bold, …), never from `fontWeight` —
 *    bundled static fonts ignore/fake it on Android.
 *
 * demo.html letter-spacing is in em; here it is em × fontSize in px.
 * Uppercase roles (label, plateTitle, …) must be uppercased at the call site.
 */
import { TextStyle } from 'react-native';
import { Palette } from './palettes';
import { WeRideFonts } from './theme';

const F = WeRideFonts;
const em = (size: number, v: number) => Math.round(size * v * 100) / 100;

export function makeType(c: Palette) {
  return {
    /** Hero title (demo .t-display). */
    display: { fontFamily: F.black, fontSize: 44, lineHeight: 44, letterSpacing: em(44, -0.035), color: c.ink },
    /** Screen title (.t-h1). */
    h1: { fontFamily: F.extraBold, fontSize: 32, lineHeight: 33, letterSpacing: em(32, -0.03), color: c.ink },
    /** Sheet / section title (.t-h2). */
    h2: { fontFamily: F.extraBold, fontSize: 22, lineHeight: 24, letterSpacing: em(22, -0.02), color: c.ink },
    /** Card title (.t-h3). */
    h3: { fontFamily: F.bold, fontSize: 17, lineHeight: 20, letterSpacing: em(17, -0.01), color: c.ink },
    /** Reading text (.t-body). */
    body: { fontFamily: F.medium, fontSize: 16, lineHeight: 22, color: c.ink2 },
    bodyStrong: { fontFamily: F.bold, fontSize: 16, lineHeight: 22, color: c.ink },
    /** Supporting text (.t-sm). */
    sm: { fontFamily: F.medium, fontSize: 13.5, lineHeight: 18, color: c.ink2 },
    smStrong: { fontFamily: F.bold, fontSize: 13.5, lineHeight: 18, color: c.ink },
    /** Eyebrow / section label (.t-label) — uppercase. */
    label: { fontFamily: F.extraBold, fontSize: 11, lineHeight: 11, letterSpacing: em(11, 0.15), color: c.ink3 },
    /** Form label (.flabel) — uppercase. */
    fieldLabel: { fontFamily: F.extraBold, fontSize: 12, lineHeight: 12, letterSpacing: em(12, 0.13), color: c.ink3 },
    /** Buttons (.btn). */
    button: { fontFamily: F.extraBold, fontSize: 17, lineHeight: 20, letterSpacing: em(17, -0.01), color: c.ink },
    buttonSm: { fontFamily: F.extraBold, fontSize: 15, lineHeight: 18, letterSpacing: em(15, -0.01), color: c.ink },
    buttonXs: { fontFamily: F.extraBold, fontSize: 13.5, lineHeight: 16, letterSpacing: em(13.5, -0.01), color: c.ink },
    /** Text field value (.field). */
    input: { fontFamily: F.bold, fontSize: 19, lineHeight: 24, letterSpacing: em(19, -0.01), color: c.ink },
    /** List row title / subtitle (.li .lt / .ls). */
    listTitle: { fontFamily: F.bold, fontSize: 16.5, lineHeight: 19, letterSpacing: em(16.5, -0.01), color: c.ink },
    listSub: { fontFamily: F.medium, fontSize: 13, lineHeight: 16, color: c.ink2 },
    /** Road-sign plate (.plate .pt / .ps) — title uppercase. */
    plateTitle: { fontFamily: F.black, fontSize: 26, lineHeight: 26, letterSpacing: em(26, -0.02) },
    plateSub: { fontFamily: F.bold, fontSize: 13.5, lineHeight: 15 },
    /** Pill (.pill) — uppercase. */
    pill: { fontFamily: F.extraBold, fontSize: 11.5, lineHeight: 14, letterSpacing: em(11.5, 0.06), color: c.ink2 },
    /** Segmented control / chip (.seg button / .chip). */
    seg: { fontFamily: F.extraBold, fontSize: 14.5, lineHeight: 18, color: c.ink2 },
    chip: { fontFamily: F.bold, fontSize: 15, lineHeight: 18, color: c.ink },
    /** Tab-bar label (.tab span) — uppercase. */
    tab: { fontFamily: F.extraBold, fontSize: 10.5, lineHeight: 12, letterSpacing: em(10.5, 0.1), color: c.ink3 },
    /** Tabular numerals (.num): ETA, distances, codes. */
    num: { fontFamily: F.num, fontSize: 16, lineHeight: 20, letterSpacing: em(16, -0.02), color: c.ink },
    /** Key/value stat (.kv .v / .k). */
    statValue: { fontFamily: F.num, fontSize: 25, lineHeight: 25, letterSpacing: em(25, -0.03), color: c.ink },
    statKey: { fontFamily: F.extraBold, fontSize: 10.5, lineHeight: 12, letterSpacing: em(10.5, 0.14), color: c.ink3 },
  } satisfies Record<string, TextStyle>;
}

export type TypeScale = ReturnType<typeof makeType>;
export type TypeRole = keyof TypeScale;
