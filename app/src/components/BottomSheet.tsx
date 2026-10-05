/**
 * BottomSheet — draggable collapsible/expandable sheet wrapper (spec §5.6).
 * Drag vertical gesture, snap to collapsed/expanded. Surface dark2, top radius
 * WeRideRadius.xxxl, 36×4 handle in the muted token.
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
    (toExpanded: boolean) => {
      setExpanded(toExpanded);
      Animated.timing(heightAnim, {
        toValue: toExpanded ? maxHeight : collapsedHeight,
        duration: 250,
        useNativeDriver: false,
        // Linear easing avoids Easing.bezier resolution issues in test environments.
        easing: (t: number) => t,
      }).start();
    },
    [collapsedHeight, maxHeight, heightAnim],
  );

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 6 && Math.abs(g.vy) > 0.1,
      onPanResponderGrant: () => {
        startY.current = expanded ? maxHeight : collapsedHeight;
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
          snapTo(true);
        } else if (g.vy > SNAP_VELOCITY) {
          snapTo(false);
        } else {
          snapTo(currentHeight.current > (collapsedHeight + maxHeight) / 2);
        }
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
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>
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
  // 8 + 4 + 8 = HANDLE_HEIGHT
  handleWrap: { alignItems: 'center', paddingVertical: 8 },
  handle: {
    width: 36,
    height: 4,
    borderRadius: WeRideRadius.pill,
    backgroundColor: WeRideColors.muted,
  },
});
