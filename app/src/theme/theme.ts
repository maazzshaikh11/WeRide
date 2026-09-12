/**
 * Shared design system for WeRide. Owned by Person C (UI-lead).
 * Everyone imports this. No one hardcodes colors.
 * To change a value here, open a PR — C reviews all UI PRs for consistency.
 *
 * Replaces the Flutter `theme.dart`. Same color values, RN-native.
 * Phase 1 Day 1 (W1 D1): Locked fonts + icon set + all color maps + safety thresholds.
 *
 * Decision Register (ratified W1 D1):
 * - D-07: Material Icons (react-native-vector-icons) + system font (Roboto)
 * - D-08: Safety thresholds ≥0.7 (green), 0.4–0.7 (yellow), <0.4 (red)
 * - Hazard severity: accident(5) > oil_spill(4) > debris(3) > pothole(2) > other(1)
 * - Hazard radius R: 100m (tuned in Phase 3)
 */

export const WeRideColors = {
  // Brand
  primary: '#1B4332',
  primaryLight: '#2D6A4F',
  accent: '#40916C',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  onPrimary: '#FFFFFF',
  error: '#E63946',

  // Rider marker colors (Person A)
  riderVerified: '#2D6A4F', // green
  riderFlagged: '#E63946', // red (spoof_flag=true)
  riderStale: '#9AA0A6', // grey (no recent update)

  // Hazard type colors (Person B)
  hazardPothole: '#FB8500', // orange
  hazardOilSpill: '#5C4033', // dark brown
  hazardAccident: '#E63946', // red
  hazardDebris: '#FFD60A', // yellow
  hazardOther: '#9AA0A6', // grey
  hazardResolved: '#9AA0A655', // faded grey (alpha 33%)

  // Safety score bar thresholds (Person C)
  safetyGood: '#2D6A4F', // >= 0.7
  safetyCaution: '#FFD60A', // 0.4 - 0.7
  safetyPoor: '#E63946', // < 0.4

  // VOX indicator (Person D)
  voxActive: '#40916C',
  voxIdle: 'transparent',

  // Text
  textPrimary: '#1A1A1A',
  textSecondary: '#6C757D',
} as const;

/**
 * Font configuration (D-07: Material Icons + Roboto system font, locked W1 D1).
 * Roboto is the standard system font for React Native on both iOS/Android.
 * For custom fonts, this would reference font family names registered in native config.
 */
export const WeRideFonts = {
  // Primary font family (Roboto system default)
  primary: 'Roboto',
  // Headline/display font (same as primary for MVP; can split later)
  headline: 'Roboto',
  // Monospace for technical UI (if needed)
  mono: 'Menlo',
} as const;

/**
 * Icon set configuration (D-07: Material Icons via react-native-vector-icons, locked W1 D1).
 * Use `react-native-vector-icons/MaterialIcons` for all icons.
 * This constant documents the choice; implementations use the icon name directly.
 */
export const WeRideIconSet = {
  // Icon library name for react-native-vector-icons
  library: 'MaterialIcons',
  // Default icon size in pixels
  defaultSize: 24,
  // Common icon color (uses primary text color by default)
  defaultColor: '#1A1A1A',
} as const;

/** Hazard type → color mapping. Single source of truth. */
export function hazardColor(hazardType: string): string {
  switch (hazardType) {
    case 'pothole':
      return WeRideColors.hazardPothole;
    case 'oil_spill':
      return WeRideColors.hazardOilSpill;
    case 'accident':
      return WeRideColors.hazardAccident;
    case 'debris':
      return WeRideColors.hazardDebris;
    case 'other':
      return WeRideColors.hazardOther;
    default:
      return WeRideColors.hazardOther;
  }
}

/** Safety score → bar color. Single source of truth. */
export function safetyScoreColor(score: number): string {
  if (score >= 0.7) return WeRideColors.safetyGood;
  if (score >= 0.4) return WeRideColors.safetyCaution;
  return WeRideColors.safetyPoor;
}