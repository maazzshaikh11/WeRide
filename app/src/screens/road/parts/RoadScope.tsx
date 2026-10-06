/**
 * RoadScope — renders its children in the Road palette (docs: the dark Road screens Stop / Arrive).
 * Every `src/ui` block reads `useTheme().colors` / `.type`; inside the scope those ARE the road palette and road type
 * scale (which package C3 makes honour the Road theme pref), so Screen, Plate, Button and RiderTile need no road variants.
 */
import React, { useMemo } from 'react';
import { ThemeContext, useTheme } from '../../../theme/ThemeProvider';

export default function RoadScope({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const road = useMemo(() => ({ ...theme, colors: theme.road, type: theme.roadType }), [theme]);
  return <ThemeContext.Provider value={road}>{children}</ThemeContext.Provider>;
}
