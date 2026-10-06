/**
 * WeRide UI Master Design System.
 * Source of truth: docs/UIUX_MASTER_DESIGN_SPEC.md §1.
 *
 * Colors follow the dark WeRide theme (dark bg, orange primary accent).
 * Legacy green theme (#1B4332, #2D6A4F, #40916C) removed per spec §1.1.
 */

export const WeRideColors = {
  // Core dark palette (spec §1.1)
  dark: '#0A0A0A',          // page background
  dark2: '#111111',         // screen/card inner background
  dark3: '#1A1A1A',         // card, stat-box, button-fill background
  muted: '#333333',         // sheet handle, muted borders
  border: '#2A2A2A',        // all card borders, dividers, input borders

  // Brand
  primary: '#FF5C00',       // primary accent (orange)
  primaryDim: '#FF5C0022',  // primary at 8% opacity — badge bg, button tints
  onPrimary: '#FFFFFF',
  error: '#FF3B3B',

  // Status colors
  green: '#22C55E',
  greenDim: '#22C55E18',
  red: '#FF3B3B',
  redDim: '#FF3B3B1F',
  blue: '#3B82F6',
  gold: '#FBBF24',

  // Rider colors (per-rider assignment)
  pink: '#EC4899',
  purple: '#A855F7',
  teal: '#14B8A6',

  // Rider marker states (Person A) — spec §1.1 semantic aliases
  riderVerified: '#22C55E', // green — fresh verified
  riderFlagged: '#FF3B3B',  // red — spoofed
  riderStale: '#9AA0A6',    // grey — stale (>10s)

  // Hazard type colors (Person B)
  hazardPothole: '#FB8500',
  hazardOilSpill: '#5C4033',
  hazardAccident: '#FF3B3B',
  hazardDebris: '#FBBF24',
  hazardOther: '#9AA0A6',
  hazardResolved: '#9AA0A655',

  // Safety score bar thresholds (Person C)
  safetyGood: '#22C55E',    // >= 0.7
  safetyCaution: '#FBBF24', // 0.4 - 0.7
  safetyPoor: '#FF3B3B',    // < 0.4

  // VOX indicator (Person D)
  voxActive: '#22C55E',
  voxIdle: 'transparent',

  // Text
  text: '#F0F0F0',          // primary body text
  textPrimary: '#F0F0F0',   // alias kept for existing imports
  textSub: '#888888',       // secondary/muted text
  textSecondary: '#888888', // alias kept for existing imports
  white: '#FFFFFF',

  // Surfaces (semantic aliases per spec §1.1)
  background: '#0A0A0A',
  surface: '#1A1A1A',
} as const;

/**
 * Typography tokens — Overpass (UI) + Overpass Mono (numbers), as in the approved demo.html.
 * Custom fonts are bundled (app/assets/fonts, Android assets, iOS UIAppFonts).
 * Family strings are the PostScript names, which resolve on BOTH platforms:
 * iOS matches UIAppFonts by PostScript name; Android matches the file name
 * in assets/fonts (files are named <PostScriptName>.ttf).
 *
 * Four static weights stand in for the demo's variable-font weights:
 * Medium 500 ∙ Bold 700 (demo 650-750) ∙ ExtraBold 800 (800-850) ∙ Black 900.
 */
export const WeRideFonts = {
  medium: 'Overpass-Medium',
  bold: 'Overpass-Bold',
  extraBold: 'Overpass-ExtraBold',
  black: 'Overpass-Black',
  /** Tabular numerals — speed, ETA, distances, codes. */
  num: 'OverpassMono-Bold',
  // Semantic names kept so existing call sites don't churn.
  display: 'Overpass-Black',      // large titles and stat numbers
  heading: 'Overpass-ExtraBold',  // screen titles, modal headings
  body: 'Overpass-Medium',        // default body text
  bodyMedium: 'Overpass-Medium',
  bodySemibold: 'Overpass-Bold',  // ride names, card titles, buttons
  bodyBold: 'Overpass-ExtraBold', // emphasised values
  mono: 'Overpass-Medium',
  monoBold: 'Overpass-ExtraBold',
  /** Monospace, where character clarity matters (join codes). */
  code: 'OverpassMono-Bold',
  // Legacy aliases kept for existing imports
  primary: 'Overpass-Medium',
  headline: 'Overpass-ExtraBold',
} as const;

/** Spacing scale (spec §1.3). */
export const WeRideSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 36,
} as const;

/** Border radius scale (spec §1.4). */
export const WeRideRadius = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  xxl: 14,
  xxxl: 18,
  pill: 99,
} as const;

/** Icon set configuration (D-07 unchanged). */
export const WeRideIconSet = {
  library: 'MaterialIcons',
  defaultSize: 24,
  defaultColor: '#F0F0F0',
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

/** Rider color assignment for multi-rider visuals (spec §1.1 rider colors). */
const RIDER_PALETTE = [
  WeRideColors.purple, // Maaz
  WeRideColors.pink,   // Hritika, Mom
  WeRideColors.teal,   // Piyush
  WeRideColors.blue,
  WeRideColors.gold,
  WeRideColors.green,
];
export function riderColor(index: number): string {
  return RIDER_PALETTE[index % RIDER_PALETTE.length];
}