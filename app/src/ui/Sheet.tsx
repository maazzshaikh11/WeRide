/**
 * Sheet — demo.html bottom sheet (.sheet): 30 px top radius, grab handle, 20 px
 * gutters, over a scrim. Slides up on the native driver; tapping the scrim or
 * the grab handle closes it. Rendered in place (absolute) so it sits inside the
 * screen that owns it. Stays mounted during the close animation.
 */
import React, { useContext, useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { GARAGE_COLUMN, useResponsive } from '../theme/responsive';
import { useStyles } from '../theme/ThemeProvider';
import { Motion, useReducedMotion } from './motion';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  testID?: string;
  accessibilityLabel?: string;
}

const CLOSE_MS = 180;

export default function Sheet({ visible, onClose, children, testID, accessibilityLabel }: SheetProps) {
  // Context (not the hook): works without a SafeAreaProvider, e.g. in isolated tests.
  const insets = useContext(SafeAreaInsetsContext);
  const { height } = useWindowDimensions();
  const { isTablet, gutter } = useResponsive();
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [mounted, setMounted] = useState(visible);
  const alive = useRef(true);
  const s = useStyles(({ colors }) => ({
    root: { ...StyleSheet.absoluteFillObject, zIndex: 120 },
    scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrim },
    sheet: {
      backgroundColor: colors.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30,
      paddingTop: 12, maxHeight: '88%',
      borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderColor: colors.line,
    },
    // Tablets: a centred card (<= 560 pt) instead of a full-width sheet.
    card: { alignSelf: 'center', width: '100%', maxWidth: GARAGE_COLUMN, borderRadius: 30, borderWidth: 1.5, marginBottom: 24 },
    grabHit: { height: 29, alignItems: 'center', justifyContent: 'flex-start' },
    grab: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line2 },
  }));

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      const a = reduced
        ? Animated.timing(t, { toValue: 1, duration: 100, useNativeDriver: true })
        : Animated.spring(t, { toValue: 1, ...Motion.spring, useNativeDriver: true });
      a.start();
      return () => a.stop();
    }
    const out = Animated.timing(t, { toValue: 0, duration: CLOSE_MS, useNativeDriver: true });
    out.start(({ finished }) => {
      if (finished && alive.current) setMounted(false);
    });
    return () => out.stop();
  }, [visible, reduced, t]);

  if (!visible && !mounted) return null;

  return (
    // iOS lifts the sheet above the keyboard (padding); Android resizes the window itself (windowSoftInputMode=adjustResize)
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.root, { justifyContent: isTablet ? 'center' : 'flex-end' }]} testID={testID} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: t }]}>
        <Pressable style={s.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" testID="sheet-scrim" />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        accessibilityLabel={accessibilityLabel}
        style={[
          s.sheet,
          isTablet && s.card,
          { paddingHorizontal: gutter, paddingBottom: isTablet ? 26 : Math.max(insets?.bottom ?? 0, 12) + 26, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] },
        ]}
      >
        <Pressable style={s.grabHit} hitSlop={{ top: 8, bottom: 8 }} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close sheet">
          <View style={s.grab} />
        </Pressable>
        <ScrollView bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
