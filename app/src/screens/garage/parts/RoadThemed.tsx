/**
 * The live ticket is night-dark in every theme and mode (demo: `pal: night`), so it cannot use the garage palette
 * or the day variant of the road palette. `NightRoad` goes around the Ticket (its dark skin reads `road`; the
 * notches still use the page colour) and `RoadThemed` around its contents (header map, text, button).
 */
import React, { useMemo } from 'react';
import { THEMES } from '../../../theme/palettes';
import { ThemeContext, buildTheme, useTheme } from '../../../theme/ThemeProvider';

function useNight() {
  const theme = useTheme();
  return useMemo(() => ({ theme, night: buildTheme(theme.themeId, THEMES[theme.themeId].dark) }), [theme]);
}

export function NightRoad({ children }: { children: React.ReactNode }) {
  const { theme, night } = useNight();
  const value = useMemo(() => ({ ...theme, road: night.road, roadType: night.roadType }), [theme, night]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export default function RoadThemed({ children }: { children: React.ReactNode }) {
  const { theme, night } = useNight();
  const value = useMemo(
    () => ({ ...theme, scheme: 'dark' as const, colors: night.road, road: night.road, type: night.roadType, roadType: night.roadType }),
    [theme, night],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
