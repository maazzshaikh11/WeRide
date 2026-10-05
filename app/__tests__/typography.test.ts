import { type } from '../src/theme/typography';

describe('type scale', () => {
  const roles = Object.entries(type);

  it.each(roles)('%s: whole-number size, readable floor, sane line height', (_name, s) => {
    expect(Number.isInteger(s.fontSize)).toBe(true);
    expect(s.fontSize).toBeGreaterThanOrEqual(11);
    expect(s.lineHeight).toBeGreaterThanOrEqual(s.fontSize);
  });

  it.each(roles)('%s: weight comes from the font file, not fontWeight', (_name, s) => {
    expect((s as { fontWeight?: string }).fontWeight).toBeUndefined();
    expect(typeof s.fontFamily).toBe('string');
  });

  it('running copy is never below 12px', () => {
    for (const k of ['body', 'bodyStrong', 'caption', 'captionStrong'] as const) {
      expect(type[k].fontSize).toBeGreaterThanOrEqual(12);
    }
  });
});
