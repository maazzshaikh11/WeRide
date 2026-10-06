/**
 * RoadFrame — layout of the dark Road screens (Stop, Arrive): scrolling content with a pinned bottom dock.
 *
 * The content scrolls (so large text or a short screen never pushes anything out of reach) and sits in a centred
 * column of at most ROAD_COLUMN pt on tablets. The dock (SOS key + main action) is pinned above the home indicator
 * with the page colour fading in behind it; its measured height is added to the scroller's bottom padding so the
 * last row can always be scrolled clear of it. Sizes of the dock come from the height-aware Live layout.
 */
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ROAD_COLUMN } from '../../../theme/responsive';
import { useTheme } from '../../../theme/ThemeProvider';
import { useLiveLayout } from '../../map/live/LiveChrome';

export default function RoadFrame({ children, dock, glove, testID }: { children: React.ReactNode; dock: React.ReactNode; glove?: boolean; testID?: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const l = useLiveLayout(glove);
  const [dockH, setDockH] = useState(l.controlH);
  const top = Math.max(insets.top, 24) + (l.tier === 'regular' ? 20 : 12);
  const dockBottom = l.controlsBottom;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} testID={testID}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: top, paddingHorizontal: 14, paddingBottom: dockH + dockBottom + 24, alignItems: 'center' }}
      >
        <View style={{ width: '100%', maxWidth: ROAD_COLUMN }}>{children}</View>
      </ScrollView>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: dockH + dockBottom + 40 }}>
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="roadfade" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0.7" stopColor={colors.bg} stopOpacity={1} />
              <Stop offset="1" stopColor={colors.bg} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#roadfade)" />
        </Svg>
      </View>
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: dockBottom, alignItems: 'center' }}>
        <View
          style={{ width: '100%', maxWidth: ROAD_COLUMN, paddingHorizontal: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}
          onLayout={(e) => setDockH(Math.round(e.nativeEvent.layout.height))}
        >
          {dock}
        </View>
      </View>
    </View>
  );
}
