/** The yellow/black hazard stripes of the demo (`repeating-linear-gradient(-45deg, #FFC20E 0 14px, #14140F 14px 28px)`). */
import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { Plates } from '../theme/palettes';

export default function HazardStripes({ style, testID }: { style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <View pointerEvents="none" style={style} testID={testID} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="hazstripes" patternUnits="userSpaceOnUse" width={28} height={28} patternTransform="rotate(45)">
            <Rect x={0} y={0} width={14} height={28} fill={Plates.yellow.bg} />
            <Rect x={14} y={0} width={14} height={28} fill={Plates.yellow.fg} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#hazstripes)" />
      </Svg>
    </View>
  );
}
