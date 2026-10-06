/**
 * ThemeProvider — resolves (theme, light/dark preference, OS scheme) into the
 * palette + type scale every screen reads through `useTheme()`.
 *
 * Components build their styles from it with `useStyles(factory)`, so a change
 * in Me > Road screen & controls re-renders the whole tree in the new colours; layout never changes.
 */
import React, { createContext, useContext, useMemo } from 'react';
import { ImageStyle, StyleSheet, TextStyle, ViewStyle, useColorScheme } from 'react-native';
import { Palette, Scheme, THEMES, ThemeId, ThemePalette, resolvePalette } from './palettes';
import { useRoadScheme } from './roadTheme';
import { DEFAULT_MODE, DEFAULT_THEME, useThemeStore } from './themeStore';
import { TypeScale, makeType } from './typography';

export interface Theme {
  themeId: ThemeId;
  scheme: Scheme;
  /** Garage palette (every screen except the live ride). */
  colors: Palette;
  /** High-contrast palette for the Road screens; its scheme follows the Road theme setting, not the garage scheme. */
  road: Palette;
  /** Which scheme `road` is in. */
  roadScheme: Scheme;
  /** Type scale coloured for `colors`. */
  type: TypeScale;
  /** Type scale coloured for `road`. */
  roadType: TypeScale;
}

/** `roadScheme` picks which Road palette to use; omitted, the Road palette matches the garage scheme. */
export function buildTheme(themeId: ThemeId, palette: ThemePalette, roadScheme?: Scheme): Theme {
  const { road: garageRoad, ...colors } = palette;
  const road = roadScheme ? THEMES[themeId][roadScheme].road : garageRoad;
  return {
    themeId,
    scheme: palette.scheme,
    colors,
    road,
    roadScheme: road.scheme,
    type: makeType(colors),
    roadType: makeType(road),
  };
}

const FALLBACK = buildTheme(DEFAULT_THEME, resolvePalette(DEFAULT_THEME, DEFAULT_MODE, 'dark'));
export const ThemeContext = createContext<Theme>(FALLBACK);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeId = useThemeStore((s) => s.themeId);
  const mode = useThemeStore((s) => s.mode);
  const system = useColorScheme();
  const roadScheme = useRoadScheme();
  const theme = useMemo(
    () => buildTheme(themeId, resolvePalette(themeId, mode, system === 'light' ? 'light' : system === 'dark' ? 'dark' : null), roadScheme),
    [themeId, mode, system, roadScheme],
  );
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** The active theme. Outside a provider (e.g. isolated tests) this is Demo / dark. */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}

type Named = { [key: string]: ViewStyle | TextStyle | ImageStyle };

/** StyleSheet built from the active theme, rebuilt only when the theme changes. */
export function useStyles<T extends Named>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- factory is a module-level function by convention
  return useMemo(() => StyleSheet.create(factory(theme)), [theme]);
}
