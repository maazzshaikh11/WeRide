/**
 * DarkScope — renders its children in the current theme's DARK palette whatever the Garage mode is
 * (demo.html `th: 'dark'` screens: Splash, Promise, Drill). Also turns the status-bar icons light.
 */
import React, { useMemo } from 'react';
import { StatusBar } from 'react-native';
import { ThemeContext, buildTheme, useTheme } from '../../../theme/ThemeProvider';
import { THEMES } from '../../../theme/palettes';

export default function DarkScope({ children }: { children: React.ReactNode }) {
  const { themeId } = useTheme();
  const value = useMemo(() => buildTheme(themeId, THEMES[themeId].dark), [themeId]);
  return (
    <ThemeContext.Provider value={value}>
      <StatusBar barStyle="light-content" backgroundColor={value.colors.bg} />
      {children}
    </ThemeContext.Provider>
  );
}
