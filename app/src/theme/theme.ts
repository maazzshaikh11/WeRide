/**
 * Shared design system for WeRide. Owned by Person C (UI-lead).
 * Everyone imports this. No one hardcodes colors.
 * To change a value here, open a PR — C reviews all UI PRs for consistency.
 *
 * Replaces the Flutter `theme.dart`. Same color values, RN-native.
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