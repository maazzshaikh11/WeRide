/**
 * The map header of a ride ticket: a crisp on-device sketch of the route (the saved road geometry when the ride
 * has one, else start → stops → destination) with the real Mapbox static map fading in over it once it has
 * loaded (offline or no token: the sketch simply stays).
 */
import React, { useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { MAPBOX_TOKEN } from '@env';
import { useTheme } from '../../../theme/ThemeProvider';
import { MapSketch, useReducedMotion } from '../../../ui';
import type { LatLng } from '../../../utils/mapFit';
import { buildStaticMapUrl } from '../../../utils/staticMap';

const OUTLINE = '#14140F';

export default function TicketMap({ points, height = 158, token = MAPBOX_TOKEN }: { points: LatLng[]; height?: number; token?: string | null }) {
  const { colors, scheme } = useTheme();
  const [width, setWidth] = useState(335);
  const [failed, setFailed] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  const hex = (c: string) => c.replace('#', '');
  const url = useMemo(
    () =>
      failed
        ? null
        : buildStaticMapUrl({
            points,
            width: Math.ceil(width / 10) * 10,
            height,
            token,
            style: scheme === 'light' ? 'light-v11' : 'dark-v11',
            routeHex: hex(colors.pri),
            startHex: hex(colors.ok),
            outlineHex: hex(OUTLINE),
          }),
    [points, width, height, failed, token, scheme, colors.pri, colors.ok],
  );
  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && Math.abs(w - width) > 8) setWidth(w);
  };
  return (
    <View style={{ height, overflow: 'hidden' }} onLayout={onLayout} testID="ticket-map" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <MapSketch points={points} height={height} />
      {url ? (
        <Animated.Image
          source={{ uri: url }}
          style={[StyleSheet.absoluteFill, { opacity: fade }]}
          resizeMode="cover"
          onLoad={() => {
            if (reduced) fade.setValue(1);
            else Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }).start();
          }}
          onError={() => setFailed(true)}
        />
      ) : null}
    </View>
  );
}
