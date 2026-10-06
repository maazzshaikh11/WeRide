import { Text, TextInput } from 'react-native';
import { BODY_MAX_FONT_MULTIPLIER, CAP, applyTextPolicy, resetTextPolicyForTests } from '../src/theme/textPolicy';

describe('text scaling policy', () => {
  beforeEach(() => {
    resetTextPolicyForTests();
    (Text as any).defaultProps = undefined;
    (TextInput as any).defaultProps = undefined;
  });
  it('gives every Text and TextInput a default maxFontSizeMultiplier', () => {
    applyTextPolicy();
    expect((Text as any).defaultProps.maxFontSizeMultiplier).toBe(BODY_MAX_FONT_MULTIPLIER);
    expect((TextInput as any).defaultProps.maxFontSizeMultiplier).toBe(BODY_MAX_FONT_MULTIPLIER);
  });
  it('keeps defaults that were already there and is idempotent', () => {
    (Text as any).defaultProps = { allowFontScaling: true };
    applyTextPolicy();
    applyTextPolicy();
    expect((Text as any).defaultProps).toEqual({ allowFontScaling: true, maxFontSizeMultiplier: BODY_MAX_FONT_MULTIPLIER });
  });
  it('tightens the HUD caps below the body cap', () => {
    expect(BODY_MAX_FONT_MULTIPLIER).toBe(1.3);
    expect(CAP.fixed).toBe(1);
    expect(CAP.hud).toBeGreaterThan(1);
    expect(CAP.hud).toBeLessThanOrEqual(1.15);
    expect(CAP.reading).toBeGreaterThan(BODY_MAX_FONT_MULTIPLIER);
  });
});
