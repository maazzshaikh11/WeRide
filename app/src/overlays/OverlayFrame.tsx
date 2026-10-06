/**
 * OverlayFrame — scrolling content + a pinned bottom dock, for the full-screen SOS / crash overlays.
 *
 * The buttons that matter in an emergency (Call 112, cancel, "I'm going") live in the dock and are always on screen;
 * everything above them scrolls and keeps a bottom padding equal to the *measured* dock height, so large text or a
 * short screen can never push a button out of reach or hide content behind it. The column is centred and at most
 * `column` pt wide on tablets.
 */
import React, { useState } from 'react';
import { ScrollView, StyleProp, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ROAD_COLUMN, dockBottom } from '../theme/responsive';

export default function OverlayFrame({ children, dock, header, paddingTop, column = ROAD_COLUMN, onDockHeight, scrollStyle, centerContent, bg }: {
  children: React.ReactNode;
  dock: React.ReactNode;
  /** Pinned above the scroller, in flow (never scrolls under anything): a close button, a status line. */
  header?: React.ReactNode;
  paddingTop: number;
  column?: number;
  /** Measured height of the dock + its bottom gap (for toasts that float above it). */
  onDockHeight?: (h: number) => void;
  scrollStyle?: StyleProp<ViewStyle>;
  /** Vertically centre the content when it is shorter than the screen (still scrolls when taller). */
  centerContent?: boolean;
  /** The overlay's colour: the dock sits on an opaque strip of it (with a short fade above) so scrolled content never shows through the buttons. */
  bg: string;
}) {
  const insets = useSafeAreaInsets();
  const bottom = dockBottom(insets.bottom);
  const [dockH, setDockH] = useState(150);
  return (
    <>
      {header}
      <ScrollView
        style={scrollStyle}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[{ paddingHorizontal: 20, paddingTop, paddingBottom: dockH + bottom + 20, alignItems: 'center' }, centerContent && { flexGrow: 1, justifyContent: 'center' }]}
      >
        <View style={{ width: '100%', maxWidth: column }}>{children}</View>
      </ScrollView>
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' }}>
        {/* opaque strip behind the dock + a short fade above it */}
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: dockH + bottom + 14, backgroundColor: bg }} />
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: dockH + bottom + 14, height: 28 }}>
          <Svg width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="ovfade" x1="0" y1="1" x2="0" y2="0">
                <Stop offset="0" stopColor={bg} stopOpacity={1} />
                <Stop offset="1" stopColor={bg} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#ovfade)" />
          </Svg>
        </View>
        <View
          style={{ width: '100%', maxWidth: column, paddingHorizontal: 14, gap: 10, marginBottom: bottom }}
          onLayout={(e) => {
            const h = Math.round(e.nativeEvent.layout.height);
            setDockH(h);
            onDockHeight?.(h + bottom);
          }}
        >
          {dock}
        </View>
      </View>
    </>
  );
}
