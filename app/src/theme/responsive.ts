/**
 * Responsive helpers — one place that decides what "small phone", "short screen" and "tablet" mean, so screens
 * adapt from the same numbers instead of each re-deriving them.
 *
 * Design baseline: the demo is drawn for a 390 x 844 phone. Everything here is *moderate*: widths scale a little,
 * tablets keep the demo's sizes and get a centred content column instead of stretched layouts.
 *
 *   isCompactWidth  width  < 360 pt            (320 pt iPhone SE 1st gen / Android "large display size")
 *   isShortHeight   usable height < 700 pt     (screen height minus the status-bar and home-indicator insets:
 *                                               iPhone SE 667 - 20 = 647, 360x640 Android; an iPhone 14 has 763)
 *   isTablet        min(width, height) >= 600  (iPad, foldable inner screens, Android tablets)
 *
 * The pure functions (`computeResponsive`, `scaleFactor`, `scaleBy`, `columnWidth`, `gutterFor`) are what the unit
 * tests cover; `useResponsive` just feeds them the live window size, font scale and safe-area insets.
 */
import React, { createContext, useContext, useMemo } from 'react';
import { PixelRatio, useWindowDimensions } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

export const DEMO_WIDTH = 390;
export const COMPACT_WIDTH = 360;
export const SHORT_HEIGHT = 700;
export const TABLET_MIN_SIDE = 600;
/** Content column on tablets: garage screens / road screens. */
export const GARAGE_COLUMN = 560;
export const ROAD_COLUMN = 640;
/** Side gutter of garage screens (demo 20; 16 on compact widths). */
export const GUTTER = 20;
export const GUTTER_COMPACT = 16;

export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}
export const NO_INSETS: Insets = { top: 0, bottom: 0, left: 0, right: 0 };

export interface Responsive {
  width: number;
  height: number;
  /** Window height minus the top and bottom safe-area insets. */
  usableHeight: number;
  fontScale: number;
  orientation: 'portrait' | 'landscape';
  isLandscape: boolean;
  isCompactWidth: boolean;
  isShortHeight: boolean;
  isTablet: boolean;
  /** `scaleBy` factor for this width (1 on tablets). */
  scale: number;
  /** Side gutter for garage screens. */
  gutter: number;
}

/** Moderate width scale: half of the relative difference to 390, kept within [0.9, 1.1]; tablets never change size. */
export function scaleFactor(width: number, isTablet = false): number {
  if (isTablet || width >= TABLET_MIN_SIDE) return 1;
  const raw = 1 + (width / DEMO_WIDTH - 1) * 0.5;
  return Math.max(0.9, Math.min(1.1, raw));
}

/** `size` scaled for the width (moderate, capped; never below the demo size on tablets). Rounded to half points. */
export function scaleBy(size: number, width: number, isTablet = false): number {
  return Math.round(size * scaleFactor(width, isTablet) * 2) / 2;
}

export function gutterFor(width: number): number {
  return width < COMPACT_WIDTH ? GUTTER_COMPACT : GUTTER;
}

/** Width of the centred content column: the whole width on phones, `max` on tablets (minus nothing: the page fills the rest). */
export function columnWidth(width: number, max: number = GARAGE_COLUMN): number {
  return Math.min(width, max);
}

export function computeResponsive(width: number, height: number, fontScale = 1, insets: Insets = NO_INSETS): Responsive {
  const isTablet = Math.min(width, height) >= TABLET_MIN_SIDE;
  const usableHeight = height - insets.top - insets.bottom;
  const isLandscape = width > height;
  return {
    width,
    height,
    usableHeight,
    fontScale,
    orientation: isLandscape ? 'landscape' : 'portrait',
    isLandscape,
    isCompactWidth: width < COMPACT_WIDTH,
    // A tablet is never "short": it has room, and its landscape height (768) is plenty for the centred column.
    isShortHeight: !isTablet && usableHeight < SHORT_HEIGHT,
    isTablet,
    scale: scaleFactor(width, isTablet),
    gutter: gutterFor(width),
  };
}

const NO_CONTEXT = createContext<Insets | null>(null);

/** Safe-area insets read from the context (not the hook), so this also works without a SafeAreaProvider (isolated tests). */
export function useInsetsOrZero(): Insets {
  return useContext((SafeAreaInsetsContext ?? NO_CONTEXT) as React.Context<Insets | null>) ?? NO_INSETS;
}

/** Live responsive info: window size, font scale and the safe-area insets. */
export function useResponsive(): Responsive {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useInsetsOrZero();
  const fs = fontScale || PixelRatio.getFontScale?.() || 1;
  return useMemo(() => computeResponsive(width, height, fs, insets), [width, height, fs, insets]);
}

/**
 * Distance of a pinned bottom dock (Live controls, SOS / Stop / Arrive buttons) from the screen's bottom edge: the demo's
 * `bottom` (30) on a phone with a home indicator (inset 34 - 4), more on a taller system bar, `base` on screens with none.
 */
export function dockBottom(insetBottom: number, base = 30): number {
  return Math.max(base, insetBottom - 4);
}

/** `scaleBy` bound to the live window: `const sz = useScaleBy(); fontSize: sz(46)`. */
export function useScaleBy(): (size: number) => number {
  const { width, isTablet } = useResponsive();
  return useMemo(() => (size: number) => scaleBy(size, width, isTablet), [width, isTablet]);
}
