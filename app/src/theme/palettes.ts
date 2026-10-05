/**
 * Colour palettes — the ONLY thing that changes between themes.
 *
 * Two themes × two schemes = four palettes:
 *   demo  — the "Signage" theme from the approved demo.html (paper / asphalt + road yellow)
 *   ember — the WeRide brand theme (ember #FF4D00)
 * each in light and dark. Layout, spacing, radii and type are shared (see
 * typography.ts, theme.ts) and are identical across all four.
 *
 * Every palette also carries a `road` variant: the high-contrast version used on
 * the live ride screen (demo.html "Road mode"), so glare/night reads stay easy.
 */

export type ThemeId = 'demo' | 'ember';
export type Scheme = 'light' | 'dark';
export type ThemePreference = 'system' | Scheme;

export interface Palette {
  scheme: Scheme;
  /** Page background. */
  bg: string;
  /** Recessed background (under cards / behind lists). */
  bg2: string;
  /** Card / list surface. */
  card: string;
  /** Raised-on-card surface (icon wells, pills, segmented tracks). */
  card2: string;
  /** Primary text. */
  ink: string;
  /** Secondary text. */
  ink2: string;
  /** Tertiary text, labels, inactive icons. */
  ink3: string;
  /** Card rim / dividers. */
  line: string;
  /** Stronger rim (inputs, ghost buttons, toggles off). */
  line2: string;
  ok: string;
  bad: string;
  blue: string;
  /** Brand accent. */
  pri: string;
  /** Text/icons on top of `pri`. */
  priInk: string;
  /** Drop-shadow tint. */
  shade: string;
  /** Modal scrim. */
  scrim: string;
}

export interface ThemePalette extends Palette {
  /** High-contrast variant for the live ride screen. */
  road: Palette;
}

/**
 * Road-sign plates carry meaning (green = fine, yellow = caution, red = SOS,
 * blue = stop ahead), so they are the same in every theme.
 */
export const Plates = {
  green: { bg: '#0C7A47', fg: '#FFFFFF', rim: '#FFFFFF' },
  yellow: { bg: '#FFC20E', fg: '#14140F', rim: '#14140F' },
  red: { bg: '#D92B24', fg: '#FFFFFF', rim: '#FFFFFF' },
  white: { bg: '#F4F1E8', fg: '#14140F', rim: '#14140F' },
  black: { bg: '#14140F', fg: '#F4F1E8', rim: '#F4F1E8' },
  blue: { bg: '#1B55C9', fg: '#FFFFFF', rim: '#FFFFFF' },
} as const;
export type PlateTone = keyof typeof Plates;

/** Rider avatar fills (dark initials on top), from demo.html's crew. */
export const AvatarColors = ['#7CC4FF', '#FF9ECB', '#8FE3A4', '#C6A6FF', '#FF9C68', '#FFC20E'] as const;
export function avatarColor(index: number): string {
  return AvatarColors[((index % AvatarColors.length) + AvatarColors.length) % AvatarColors.length];
}

// ─── Demo (Signage) ────────────────────────────────────────────────────────
const demoLight: Palette = {
  scheme: 'light',
  bg: '#ECE8DB', bg2: '#E3DECF', card: '#FAF8F0', card2: '#F2EFE4',
  ink: '#14140F', ink2: '#53544A', ink3: '#8B8C80', line: '#D7D2C2', line2: '#C6C1AE',
  ok: '#0C7A47', bad: '#C9231D', blue: '#1B55C9', pri: '#FFC20E', priInk: '#14140F',
  shade: 'rgba(20,20,15,0.08)', scrim: 'rgba(20,20,15,0.45)',
};
const demoDark: Palette = {
  scheme: 'dark',
  bg: '#12130F', bg2: '#181A15', card: '#1D1F19', card2: '#242620',
  ink: '#F4F1E8', ink2: '#B7B8AB', ink3: '#7D7E71', line: '#2D2F27', line2: '#3B3E34',
  ok: '#3FD17F', bad: '#FF5148', blue: '#6B9BFF', pri: '#FFC20E', priInk: '#14140F',
  shade: 'rgba(0,0,0,0.35)', scrim: 'rgba(0,0,0,0.6)',
};
// demo.html "road-d" (day) and "road-n" (night)
const demoRoadLight: Palette = {
  ...demoLight,
  bg: '#EFEBDD', bg2: '#E3DECF', card: '#FFFFFF', card2: '#F2EFE4',
  ink: '#0D0D0A', ink2: '#3F4037', ink3: '#74756A', line: '#D2CDBB', line2: '#B9B49F',
  priInk: '#0D0D0A', shade: 'rgba(20,20,15,0.1)', scrim: 'rgba(20,20,15,0.55)',
};
const demoRoadDark: Palette = {
  ...demoDark,
  bg: '#0C0D0B', bg2: '#141511', card: '#1A1C17', card2: '#22241E',
  ink: '#F6F3EA', ink2: '#C4C5B8', ink3: '#8A8B7E', line: '#2D2F27', line2: '#42453A',
  shade: 'rgba(0,0,0,0.5)', scrim: 'rgba(0,0,0,0.72)',
};

// ─── Ember (brand) ─────────────────────────────────────────────────────────
// Same structure, brand accent #FF4D00 on neutral (no yellow cast) surfaces.
// Text on the accent is near-black: white on #FF4D00 is only 3.4:1, near-black is 6:1.
export const EMBER = '#FF4D00';
const emberLight: Palette = {
  scheme: 'light',
  bg: '#F5F2EC', bg2: '#ECE8E0', card: '#FFFFFF', card2: '#F4F1EA',
  ink: '#141414', ink2: '#4F4C46', ink3: '#85817A', line: '#E2DDD3', line2: '#CFC9BC',
  ok: '#15803D', bad: '#D92B24', blue: '#2563EB', pri: EMBER, priInk: '#140A05',
  shade: 'rgba(20,20,20,0.08)', scrim: 'rgba(20,20,20,0.45)',
};
const emberDark: Palette = {
  scheme: 'dark',
  bg: '#0A0A0A', bg2: '#111111', card: '#1A1A1A', card2: '#222222',
  ink: '#F0F0F0', ink2: '#B4B4B4', ink3: '#808080', line: '#2A2A2A', line2: '#3A3A3A',
  ok: '#22C55E', bad: '#FF3B3B', blue: '#4C8DF6', pri: EMBER, priInk: '#140A05',
  shade: 'rgba(0,0,0,0.4)', scrim: 'rgba(0,0,0,0.65)',
};
const emberRoadLight: Palette = {
  ...emberLight,
  bg: '#F4F1EA', card: '#FFFFFF', card2: '#F2EFE8',
  ink: '#0D0D0D', ink2: '#3F3C37', ink3: '#75716A', line: '#D8D3C8', line2: '#BDB7A8',
  ok: '#15803D', bad: '#C9231D', shade: 'rgba(20,20,20,0.1)', scrim: 'rgba(20,20,20,0.55)',
};
const emberRoadDark: Palette = {
  ...emberDark,
  bg: '#050505', bg2: '#0E0E0E', card: '#161616', card2: '#1E1E1E',
  ink: '#F7F7F7', ink2: '#C8C8C8', ink3: '#8C8C8C', line: '#2A2A2A', line2: '#444444',
  shade: 'rgba(0,0,0,0.55)', scrim: 'rgba(0,0,0,0.75)',
};

export const THEMES: Record<ThemeId, Record<Scheme, ThemePalette>> = {
  demo: {
    light: { ...demoLight, road: demoRoadLight },
    dark: { ...demoDark, road: demoRoadDark },
  },
  ember: {
    light: { ...emberLight, road: emberRoadLight },
    dark: { ...emberDark, road: emberRoadDark },
  },
};

export const THEME_IDS: readonly ThemeId[] = ['demo', 'ember'];

export const THEME_LABELS: Record<ThemeId, { name: string; blurb: string }> = {
  demo: { name: 'Demo', blurb: 'Road-sign yellow on paper and asphalt' },
  ember: { name: 'Ember', blurb: 'WeRide brand orange' },
};

/** Picks the palette for a theme and a scheme preference ('system' follows the OS). */
export function resolvePalette(
  theme: ThemeId,
  preference: ThemePreference,
  systemScheme: Scheme | null | undefined,
): ThemePalette {
  const scheme: Scheme = preference === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : preference;
  return THEMES[theme][scheme];
}

/** rgba() of a #RRGGBB colour at `alpha` (0..1) — for tinted fills like the demo's `color-mix`. */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
