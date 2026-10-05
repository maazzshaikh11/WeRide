import { THEMES } from '../src/theme/palettes';
import { makeType } from '../src/theme/typography';

const palettes = [THEMES.demo.light, THEMES.demo.dark, THEMES.ember.light, THEMES.ember.dark];
const roles = Object.entries(makeType(THEMES.demo.dark));

describe('type scale', () => {
  it.each(roles)('%s: half-point size, readable floor, sane line height', (_name, s) => {
    expect(Number.isInteger(s.fontSize * 2)).toBe(true);
    expect(s.fontSize).toBeGreaterThanOrEqual(10.5);
    expect(s.lineHeight).toBeGreaterThanOrEqual(s.fontSize);
  });

  it.each(roles)('%s: weight comes from the font file, not fontWeight', (_name, s) => {
    expect((s as { fontWeight?: string }).fontWeight).toBeUndefined();
    expect(typeof s.fontFamily).toBe('string');
  });

  it('running copy is never below 13px; only tab labels and stat keys go under 11', () => {
    const t = makeType(THEMES.demo.dark);
    for (const k of ['body', 'bodyStrong', 'sm', 'smStrong', 'listSub', 'listTitle'] as const) {
      expect(t[k].fontSize).toBeGreaterThanOrEqual(13);
    }
    const small = Object.entries(t).filter(([, s]) => s.fontSize < 11).map(([k]) => k).sort();
    expect(small).toEqual(['statKey', 'tab']);
  });

  it('sizes, line heights, tracking and fonts are identical in all four themes — only colour differs', () => {
    const strip = (p: (typeof palettes)[number]) =>
      Object.fromEntries(Object.entries(makeType(p)).map(([k, v]) => { const { color: _c, ...rest } = v as { color?: string }; return [k, rest]; }));
    const base = strip(palettes[0]);
    for (const p of palettes.slice(1)) expect(strip(p)).toEqual(base);
  });

  it('roles that imply a colour read from the palette', () => {
    const light = makeType(THEMES.ember.light);
    expect(light.h1.color).toBe(THEMES.ember.light.ink);
    expect(light.label.color).toBe(THEMES.ember.light.ink3);
  });
});
