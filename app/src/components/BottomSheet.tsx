/**
 * BottomSheet — draggable collapsible/expandable sheet wrapper (spec §5.6).
 * Drag vertical gesture, snap to collapsed/expanded. Surface dark2, top radius
 * WeRideRadius.xxxl, 36×4 handle in the muted token.
 *
 * Snapping is a spring (Motion.spring) that carries the release velocity of a
 * drag; collapsing is overshoot-clamped so the sheet never dips below its
 * collapsed height (the map camera padding is computed from that height). The
 * handle row is a PressableScale that toggles the sheet.
 * Height is layout, so this one animation cannot use the native driver.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  Animated,
  LayoutChangeEvent,
} from 'react-native';
import { WeRideColors, WeRideRadius } from '../theme/theme';
import { Motion, PressableScale } from '../ui';

const HANDLE_HEIGHT = 20;
const SNAP_VELOCITY = 0.6;

interface Props {
  collapsedHeight: number;
  maxHeight: number;
  initialCollapsed?: boolean;
  children: (state: { expanded: boolean; toggle: () => void }) => React.ReactNode;
}

export default function BottomSheet({ collapsedHeight, maxHeight, initialCollapsed = true, children }: Props) {
  const [expanded, setExpanded] = useState(!initialCollapsed);
  const heightAnim = useRef(new Animated.Value(collapsedHeight)).current;
  const startY = useRef(0);
  const currentHeight = useRef(collapsedHeight);

  useEffect(() => {
    const id = heightAnim.addListener(({ value }) => {
      currentHeight.current = value;
    });
    return () => heightAnim.removeListener(id);
  }, [heightAnim]);

  const snapTo = useCallback(
    (toExpanded: boolean, velocity = 0) => {
      setExpanded(toExpanded);
      heightAnim.stopAnimation();
      Animated.spring(heightAnim, {
        toValue: toExpanded ? maxHeight : collapsedHeight,
        ...Motion.spring,
        // px/ms, positive = growing. Collapsing must not undershoot the collapsed height.
        velocity,
        overshootClamping: !toExpanded,
        useNativeDriver: false,
      }).start();
    },
    [collapsedHeight, maxHeight, heightAnim],
  );

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 6 && Math.abs(g.vy) > 0.1,
      onPanResponderGrant: () => {
        // Start from where the sheet really is (it may be mid-spring), not the
        // `expanded` flag captured when this responder was created.
        heightAnim.stopAnimation();
        startY.current = currentHeight.current;
      },
      onPanResponderMove: (_e, g) => {
        const next = Math.min(
          maxHeight,
          Math.max(HANDLE_HEIGHT, startY.current - g.dy),
        );
        heightAnim.setValue(next);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.vy < -SNAP_VELOCITY) {
          snapTo(true, -g.vy);
        } else if (g.vy > SNAP_VELOCITY) {
          snapTo(false, -g.vy);
        } else {
          snapTo(currentHeight.current > (collapsedHeight + maxHeight) / 2, -g.vy);
        }
      },
      // Another responder took over mid-drag: settle to the nearest snap point.
      onPanResponderTerminate: () => {
        snapTo(currentHeight.current > (collapsedHeight + maxHeight) / 2);
      },
    }),
  ).current;

  const onLayout = (_e: LayoutChangeEvent) => {
    // Keep animated value authoritative; ignore layout-driven resets.
  };

  return (
    <View style={styles.sheet}>
      <Animated.View
        style={[styles.content, { height: heightAnim }]}
        {...pan.panHandlers}
        onLayout={onLayout}
      >
        <PressableScale
          onPress={() => snapTo(!expanded)}
          haptic="tap"
          scaleTo={0.9}
          hitSlop={{ bottom: 12 }}
          style={styles.handleWrap}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Collapse sheet' : 'Expand sheet'}
        >
          <View style={styles.handle} />
        </PressableScale>
        {children({ expanded, toggle: () => snapTo(!expanded) })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: WeRideColors.dark2,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: WeRideColors.border,
    borderTopLeftRadius: WeRideRadius.xxxl,
    borderTopRightRadius: WeRideRadius.xxxl,
    overflow: 'hidden',
  },
  content: { overflow: 'hidden' },
  // 8 + 4 + 8 = HANDLE_HEIGHT. Full-width row; hitSlop reaches into the body
  // (which toggles the sheet too), so the effective target is well over 44pt.
  handleWrap: { alignItems: 'center', paddingVertical: 8 },
  handle: {
    width: 36,
    height: 4,
    borderRadius: WeRideRadius.pill,
    backgroundColor: WeRideColors.muted,
  },
});
