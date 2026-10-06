/**
 * Splash — the brand plate (demo `splash`): dark, the real logo on a road-sign tile, "WeRide" / "EVERYONE HOME"
 * and a moving dashed centre-line. After 2.3 s it replaces itself with Promise.
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Plates } from '../../theme/palettes';
import { useTheme } from '../../theme/ThemeProvider';
import DarkScope from './parts/DarkScope';
import { MovingDashes } from './parts/DashedLine';
import LogoTile from './parts/LogoTile';

export const SPLASH_MS = 2300;

function SplashBody({ navigation }: { navigation: { replace: (name: 'Promise') => void } }) {
  const { colors, type } = useTheme();
  const { width } = useWindowDimensions();

  useEffect(() => {
    const t = setTimeout(() => navigation.replace('Promise'), SPLASH_MS);
    return () => clearTimeout(t);
  }, [navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} testID="screen-Splash" accessible accessibilityLabel="WeRide. Everyone home.">
      {/* radial glow behind the mark (demo: 70% × 45% ellipse at 50% 38%) */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="38%" rx="70%" ry="45%" fx="50%" fy="38%" gradientUnits="objectBoundingBox">
            <Stop offset="0" stopColor={Plates.yellow.bg} stopOpacity={0.12} />
            <Stop offset="1" stopColor={Plates.yellow.bg} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glow)" />
      </Svg>
      <View style={{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 22, paddingBottom: 70 }}>
        <View style={{ shadowColor: Plates.yellow.bg, shadowOpacity: 0.25, shadowRadius: 40, shadowOffset: { width: 0, height: 20 }, elevation: 0 }}>
          <LogoTile size={116} />
        </View>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Text style={[type.display, { fontSize: 46, lineHeight: 48, letterSpacing: -1.84 }]}>WeRide</Text>
          <Text style={[type.label, { letterSpacing: 3.3, color: colors.ink3 }]}>EVERYONE HOME</Text>
        </View>
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 120 }}>
        <MovingDashes color={Plates.yellow.bg} width={width} />
      </View>
    </View>
  );
}

export default function SplashScreen(props: any) {
  return (
    <DarkScope>
      <SplashBody navigation={props.navigation} />
    </DarkScope>
  );
}
