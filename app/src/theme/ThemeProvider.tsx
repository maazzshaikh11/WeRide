/**
 * ThemeProvider — resolves (theme, light/dark preference, OS scheme) into the
 * palette + type scale every screen reads through `useTheme()`.
 *
 * Components build their styles from it with `useStyles(factory)`, so a change
 * in Settings re-renders the whole tree in the new colours; layout never changes.
 */
import React, { createContext, useContext, useMemo } from 'react';
import { ImageStyle, StyleSheet, TextStyle, ViewStyle, useColorScheme } from 'react-native';
import { Palette, Scheme, ThemeId, ThemePalette, resolvePalette } from './palettes';
import { DEFAULT_MODE, DEFAULT_THEME, useThemeStore } from './themeStore';
import { TypeScale, makeType } from './typography';

export interface Theme {
  themeId: ThemeId;
  scheme: Scheme;
  /** Garage palette (every screen except the live ride). */
  colors: Palette;
  /** High-contrast palette for the live ride screen. */
  road: Palette;
  /** Type scale coloured for `colors`. */
  type: TypeScale;
  /** Type scale coloured for `road`. */
  roadType: TypeScale;
}

export function buildTheme(themeId: ThemeId, palette: ThemePalette): Theme {
  const { road, ...colors } = palette;
  return {
    themeId,
    scheme: palette.scheme,
    colors,
    road,
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
  const theme = useMemo(
    () => buildTheme(themeId, resolvePalette(themeId, mode, system === 'light' ? 'light' : system === 'dark' ? 'dark' : null)),
    [themeId, mode, system],
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
