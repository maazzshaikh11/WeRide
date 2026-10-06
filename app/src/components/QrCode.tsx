/**
 * QrCode — the crew code as a QR. Always dark modules on a light tile (taken from the light palette of the
 * active theme) because scanners need that contrast, even when the app is in dark mode.
 */
import React, { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { THEMES } from '../theme/palettes';
import { qrMatrix, qrPath } from '../utils/qr';

const QUIET = 3;

export default function QrCode({ value, size = 150, radius = 18, testID }: { value: string; size?: number; radius?: number; testID?: string }) {
  const { themeId } = useTheme();
  const light = THEMES[themeId].light;
  const { d, n } = useMemo(() => {
    const m = qrMatrix(value);
    return { d: qrPath(m), n: m.length };
  }, [value]);
  const total = n + QUIET * 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${total} ${total}`} accessibilityLabel={`QR code for ${value}`} accessibilityRole="image" testID={testID}>
      <Rect x={0} y={0} width={total} height={total} rx={(radius / size) * total} fill={light.card} />
      <Path d={d} fill={light.ink} transform={`translate(${QUIET} ${QUIET})`} />
    </Svg>
  );
}
