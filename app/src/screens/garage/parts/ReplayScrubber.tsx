/**
 * ReplayScrubber — the recap's draggable position bar (demo `.rng`): an 8 px track with a 26 px accent thumb ringed in ink.
 * Built on PanResponder (no native slider). Tap or drag anywhere on it; screen readers get increment / decrement actions.
 */
import React, { useMemo, useRef, useState } from 'react';
import { AccessibilityActionEvent, LayoutChangeEvent, PanResponder, StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '../../../theme/ThemeProvider';

const THUMB = 32; // 26 + the 3 px ring
const STEP = 0.1;

export interface ReplayScrubberProps {
  /** 0..1 */
  value: number;
  onChange: (v: number) => void;
  /** Fired when a drag starts / ends (the screen can pause playback meanwhile). */
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export default function ReplayScrubber({ value, onChange, onScrubStart, onScrubEnd, style, testID }: ReplayScrubberProps) {
  const { colors } = useTheme();
  const [w, setW] = useState(200);
  const widthRef = useRef(200);
  const startX = useRef(0);
  const cb = useRef({ onChange, onScrubStart, onScrubEnd });
  cb.current = { onChange, onScrubStart, onScrubEnd };

  const emit = (x: number) => {
    const usable = Math.max(1, widthRef.current - THUMB);
    cb.current.onChange(clamp01((x - THUMB / 2) / usable));
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          startX.current = e.nativeEvent.locationX;
          cb.current.onScrubStart?.();
          emit(startX.current);
        },
        onPanResponderMove: (_e, g) => emit(startX.current + g.dx),
        onPanResponderRelease: () => cb.current.onScrubEnd?.(),
        onPanResponderTerminate: () => cb.current.onScrubEnd?.(),
      }),
    [],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const nw = e.nativeEvent.layout.width;
    if (nw > 0) {
      widthRef.current = nw;
      setW(nw);
    }
  };
  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') onChange(clamp01(value + STEP));
    else if (e.nativeEvent.actionName === 'decrement') onChange(clamp01(value - STEP));
  };

  const v = clamp01(value);
  return (
    <View
      {...pan.panHandlers}
      onLayout={onLayout}
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Replay position"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={onAction}
      style={[{ height: 44, justifyContent: 'center' }, style]}
    >
      <View pointerEvents="none" style={{ height: 8, borderRadius: 4, backgroundColor: colors.line2 }} />
      <View
        pointerEvents="none"
        testID={testID ? `${testID}-thumb` : undefined}
        style={{ position: 'absolute', top: 6, left: v * Math.max(0, w - THUMB), width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: colors.pri, borderWidth: 3, borderColor: colors.ink }}
      />
    </View>
  );
}
