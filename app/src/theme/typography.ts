/**
 * Type scale — the single source for text styles (spec §1.2).
 *
 * Rules (enforced by __tests__/typography.test.ts):
 *  - whole-number sizes only; nothing below 11 px (labels) / 12 px (copy);
 *  - every style carries a lineHeight >= its fontSize;
 *  - weight comes from the font FILE (Inter-SemiBold, SpaceMono-Bold, …), never
 *    from `fontWeight` — bundled static fonts ignore/fake it on Android.
 *
 * Colours are NOT baked in except where the role implies one (stat numbers use
 * the accent, caption the muted text). Override with `[type.body, { color }]`.
 * Brand tokens live in theme.ts and are not changed here.
 */
import { TextStyle } from 'react-native';
import { WeRideColors, WeRideFonts } from './theme';

export const type = {
  /** Hero numbers / splash wordmark. */
  display: { fontFamily: WeRideFonts.display, fontSize: 36, lineHeight: 40, color: WeRideColors.text },
  /** Screen titles. */
  title: { fontFamily: WeRideFonts.heading, fontSize: 28, lineHeight: 32, color: WeRideColors.text },
  /** Sheet / modal titles. */
  titleSm: { fontFamily: WeRideFonts.heading, fontSize: 22, lineHeight: 26, color: WeRideColors.text },
  /** Stat numbers (ETA, km). */
  stat: { fontFamily: WeRideFonts.heading, fontSize: 26, lineHeight: 28, color: WeRideColors.primary },
  statSm: { fontFamily: WeRideFonts.heading, fontSize: 20, lineHeight: 24, color: WeRideColors.primary },

  /** Card / row titles. */
  heading: { fontFamily: WeRideFonts.bodySemibold, fontSize: 16, lineHeight: 22, color: WeRideColors.text },
  body: { fontFamily: WeRideFonts.body, fontSize: 14, lineHeight: 20, color: WeRideColors.text },
  bodyStrong: { fontFamily: WeRideFonts.bodySemibold, fontSize: 14, lineHeight: 20, color: WeRideColors.text },
  caption: { fontFamily: WeRideFonts.body, fontSize: 12, lineHeight: 16, color: WeRideColors.textSub },
  captionStrong: { fontFamily: WeRideFonts.bodyMedium, fontSize: 12, lineHeight: 16, color: WeRideColors.textSub },

  /** Eyebrows, badges, tab labels, units. Uppercase them at the call site. */
  label: { fontFamily: WeRideFonts.mono, fontSize: 11, lineHeight: 14, letterSpacing: 1, color: WeRideColors.textSub },
  labelStrong: { fontFamily: WeRideFonts.monoBold, fontSize: 11, lineHeight: 14, letterSpacing: 1, color: WeRideColors.text },
  eyebrow: { fontFamily: WeRideFonts.mono, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, color: WeRideColors.primary },

  button: { fontFamily: WeRideFonts.bodySemibold, fontSize: 15, lineHeight: 20, color: WeRideColors.onPrimary },
  buttonSm: { fontFamily: WeRideFonts.bodySemibold, fontSize: 13, lineHeight: 18, color: WeRideColors.onPrimary },
  input: { fontFamily: WeRideFonts.body, fontSize: 15, lineHeight: 20, color: WeRideColors.text },
} satisfies Record<string, TextStyle>;

export type TypeRole = keyof typeof type;
