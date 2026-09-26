/** Typography style tokens (spec §1.2). Fonts fall back to system defaults when unbundled. */
import { TextStyle } from 'react-native';
import { WeRideColors, WeRideFonts } from './theme';

export const type: Record<string, TextStyle> = {
  display: { fontFamily: WeRideFonts.display, fontSize: 38, color: WeRideColors.text },
  heading: { fontFamily: WeRideFonts.heading, fontSize: 24, color: WeRideColors.text },
  headingLg: { fontFamily: WeRideFonts.heading, fontSize: 22, color: WeRideColors.text },
  statValue: { fontFamily: WeRideFonts.heading, fontSize: 19, color: WeRideColors.primary },
  statValueLg: { fontFamily: WeRideFonts.heading, fontSize: 22, color: WeRideColors.primary },
  body: { fontFamily: WeRideFonts.body, fontSize: 13, color: WeRideColors.text },
  bodySemibold: { fontFamily: WeRideFonts.body, fontSize: 13, fontWeight: '600', color: WeRideColors.text },
  bodyBold: { fontFamily: WeRideFonts.body, fontSize: 13, fontWeight: '700', color: WeRideColors.text },
  caption: { fontFamily: WeRideFonts.body, fontSize: 10, color: WeRideColors.textSub },
  captionMedium: { fontFamily: WeRideFonts.body, fontSize: 10, fontWeight: '500', color: WeRideColors.textSub },
  captionSemibold: { fontFamily: WeRideFonts.body, fontSize: 10.5, fontWeight: '600', color: WeRideColors.textSub },
  small: { fontFamily: WeRideFonts.body, fontSize: 9, color: WeRideColors.textSub },
  badge: { fontFamily: WeRideFonts.mono, fontSize: 10, fontWeight: '700', color: WeRideColors.text },
  badgeSmall: { fontFamily: WeRideFonts.mono, fontSize: 8, fontWeight: '700', color: WeRideColors.text },
  badgeMicro: { fontFamily: WeRideFonts.mono, fontSize: 7.5, fontWeight: '700', color: WeRideColors.text },
  eyebrow: { fontFamily: WeRideFonts.mono, fontSize: 9, letterSpacing: 1, color: WeRideColors.primary },
  mono: { fontFamily: WeRideFonts.mono, fontSize: 10, color: WeRideColors.text },
  button: { fontFamily: WeRideFonts.body, fontSize: 12.5, fontWeight: '700', color: WeRideColors.onPrimary },
  input: { fontFamily: WeRideFonts.body, fontSize: 14, color: WeRideColors.text },
};