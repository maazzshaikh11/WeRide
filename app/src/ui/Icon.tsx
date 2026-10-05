/**
 * Icon — the demo.html icon set (24-px grid, 2.25 stroke, round caps).
 * Colour defaults to the theme's `ink`; pass `color` for anything else.
 */
import React from 'react';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { ICONS, IconName } from './iconData';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  testID?: string;
}

export default function Icon({ name, size = 24, color, strokeWidth = 2.25, testID }: IconProps) {
  const { colors } = useTheme();
  const tint = color ?? colors.ink;
  const prims = (ICONS[name] ?? []) as unknown as readonly { t: string; [k: string]: string }[];
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={tint}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {prims.map(({ t, fill, stroke, ...a }, i) => {
        const common = {
          key: i,
          ...(fill === 'currentColor' ? { fill: tint } : fill ? { fill } : null),
          ...(stroke ? { stroke } : null),
        };
        if (t === 'circle') return <Circle {...common} cx={a.cx} cy={a.cy} r={a.r} />;
        if (t === 'ellipse') return <Ellipse {...common} cx={a.cx} cy={a.cy} rx={a.rx} ry={a.ry} />;
        if (t === 'rect') return <Rect {...common} x={a.x} y={a.y} width={a.width} height={a.height} rx={a.rx} />;
        return <Path {...common} d={a.d} />;
      })}
    </Svg>
  );
}
