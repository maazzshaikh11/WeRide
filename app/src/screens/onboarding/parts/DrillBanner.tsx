/** The hazard-striped "DRILL ∙ NOBODY IS ALERTED" strip (demo `drill`): yellow/black stripes, fixed plate colours. */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { Plates } from '../../../theme/palettes';
import { useTheme } from '../../../theme/ThemeProvider';

export default function DrillBanner() {
  const { type } = useTheme();
  return (
    <View
      style={{ marginHorizontal: -20, marginTop: -6, height: 28, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
      accessible
      accessibilityLabel="Drill. Nobody is alerted."
      testID="drill-banner"
    >
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <Pattern id="hazard" patternUnits="userSpaceOnUse" width={28} height={28} patternTransform="rotate(45)">
            <Rect x={0} y={0} width={28} height={28} fill={Plates.black.bg} />
            <Rect x={0} y={0} width={14} height={28} fill={Plates.yellow.bg} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#hazard)" />
      </Svg>
      <View style={{ backgroundColor: Plates.black.bg, paddingVertical: 3, paddingHorizontal: 12, borderRadius: 5 }}>
        <Text style={{ fontFamily: type.display.fontFamily, fontSize: 12, lineHeight: 14, letterSpacing: 2.4, color: Plates.yellow.bg }}>DRILL ∙ NOBODY IS ALERTED</Text>
      </View>
    </View>
  );
}
