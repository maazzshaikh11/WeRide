/**
 * Height-aware geometry of the Live screen's floating chrome (pure, unit-tested).
 *
 * The demo is drawn for a 390 x 844 phone; on shorter screens the fixed numbers (82 pt plate, 88 pt keys, 122 pt speed,
 * 62 pt side buttons) stack to more than the screen is tall and the side column ends up on top of the speed cluster.
 * The usable height (screen height minus the status-bar and home-indicator insets) picks a tier; glove mode scales
 * the keys and speed up by the demo's ratios (88 -> 104, 122 -> 132) within the tier, so it stays relative.
 *
 *   regular  usable >= 700   the demo's numbers
 *   short    600 .. 700      iPhone SE, 360x640 Android
 *   tiny     < 600           320x568 with gesture / 3-button navigation
 *
 * Tablets (min side >= 600) always use `regular` and a centred column of ROAD_COLUMN pt.
 */
import { GUTTER_COMPACT, ROAD_COLUMN, TABLET_MIN_SIDE } from '../../../theme/responsive';

export type LiveTier = 'regular' | 'short' | 'tiny';

export const HUD_GUTTER = 14;
export const HEADER_PAD = 8;
export const HEADER_BAR_H = 44;
export const CONTROL_GAP = 10;
/** Controls never get smaller than this (glove or not): the demo's 76-88 pt row. */
export const MIN_CONTROL_H = 76;
const GLOVE_CONTROL_RATIO = 104 / 88;
const GLOVE_SPEED_RATIO = 132 / 122;

const TIERS: Record<LiveTier, { sideBtn: number; sideGap: number; plateH: number; controlH: number; bottom: number; gloveBottom: number; speed: number; sos: number }> = {
  regular: { sideBtn: 62, sideGap: 12, plateH: 82, controlH: 88, bottom: 30, gloveBottom: 26, speed: 122, sos: 96 },
  short: { sideBtn: 56, sideGap: 10, plateH: 76, controlH: 80, bottom: 20, gloveBottom: 18, speed: 100, sos: 92 },
  tiny: { sideBtn: 50, sideGap: 8, plateH: 70, controlH: MIN_CONTROL_H, bottom: 14, gloveBottom: 14, speed: 84, sos: 84 },
};

export interface LiveLayoutInput {
  width: number;
  height: number;
  insets?: { top?: number; bottom?: number };
  glove?: boolean;
}

export interface LiveLayout {
  tier: LiveTier;
  /** Width of the centred HUD column (the window width on phones). */
  columnW: number;
  /** Space left and right of the column (0 on phones). */
  sideMargin: number;
  /** Left / right inset of the HUD rows from the screen edge. */
  gutter: number;
  sideBtn: number;
  sideGap: number;
  plateH: number;
  controlH: number;
  /** Distance of the control row from the bottom edge (clears the home indicator / navigation bar). */
  controlsBottom: number;
  sosKeyW: number;
  speedSize: number;
  /** Height reserved for the speed / ETA cluster. */
  clusterH: number;
  /** Max height of the hazard / SOS / rider info cards that sit above the cluster. */
  infoCardsMaxH: number;
  /** Header + plate block below the status-bar inset. */
  topChromeH: number;
  /** Width the side column plus its gutter occupy. */
  sideColumnW: number;
  /** Label size of the control keys (smaller on narrow keys). */
  keyLabelSize: number;
}

export function liveTier(usableHeight: number, isTablet: boolean): LiveTier {
  if (isTablet || usableHeight >= 700) return 'regular';
  return usableHeight >= 600 ? 'short' : 'tiny';
}

export function liveLayout({ width, height, insets, glove }: LiveLayoutInput): LiveLayout {
  const top = insets?.top ?? 0;
  const bottomInset = insets?.bottom ?? 0;
  const isTablet = Math.min(width, height) >= TABLET_MIN_SIDE;
  const usable = height - top - bottomInset;
  const tier = liveTier(usable, isTablet);
  const t = TIERS[tier];
  const columnW = isTablet ? Math.min(width, ROAD_COLUMN) : width;
  const sideMargin = Math.max(0, (width - columnW) / 2);
  const gutter = columnW < 360 ? Math.min(HUD_GUTTER, GUTTER_COMPACT) : HUD_GUTTER;
  const inner = columnW - 2 * gutter;

  const controlH = glove ? Math.round(t.controlH * GLOVE_CONTROL_RATIO) : t.controlH;
  const base = glove ? t.gloveBottom : t.bottom;
  // The home indicator / navigation bar is inside the window on iPhones and edge-to-edge Android: stay above it.
  const controlsBottom = Math.max(base, bottomInset - 4);
  // SOS takes ~30 % of the row (never wider than the demo's 96, never narrower than 76); the other keys share the rest.
  const sosKeyW = Math.round(Math.max(76, Math.min(t.sos, inner * 0.3)));
  // Speed digits + the ETA column must fit side by side: ~1.6 em for 3 digits, ~100 pt for ETA and distance.
  const speedFit = Math.floor((inner - 36 - 12 - 100) / 1.6);
  const baseSpeed = glove ? Math.round(t.speed * GLOVE_SPEED_RATIO) : t.speed;
  const speedSize = Math.max(64, Math.min(baseSpeed, speedFit));
  const clusterH = Math.round(speedSize * 0.8 + 34);
  const keyW = (inner - sosKeyW - 3 * CONTROL_GAP) / 3;
  return {
    tier,
    columnW,
    sideMargin,
    gutter,
    sideBtn: t.sideBtn,
    sideGap: t.sideGap,
    plateH: t.plateH,
    controlH,
    controlsBottom,
    sosKeyW,
    speedSize,
    clusterH,
    infoCardsMaxH: Math.max(120, Math.min(220, Math.round(usable * 0.28))),
    topChromeH: HEADER_PAD + HEADER_BAR_H + HEADER_PAD + t.plateH + HEADER_PAD,
    sideColumnW: t.sideBtn + gutter,
    keyLabelSize: keyW < 66 ? 10 : 11.5,
  };
}

/** Whether the side column (top = `sideTop`, two buttons) would end below the cluster's top edge: used by tests and a dev check. */
export function sideColumnClearsCluster(l: LiveLayout, height: number, insetsTop: number, topBlockH?: number): boolean {
  const sideTop = insetsTop + (topBlockH ?? l.topChromeH) + l.sideGap;
  const sideBottom = sideTop + 2 * l.sideBtn + l.sideGap;
  const clusterTop = height - (l.controlsBottom + l.controlH + 8 + l.clusterH);
  return sideBottom + 6 <= clusterTop;
}
