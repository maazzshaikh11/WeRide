/**
 * TextField — text input with life: the border eases to the accent on focus,
 * turns red when `error` is set, and the field gives a short horizontal shake
 * the moment an error appears (once per new error, never on every keystroke).
 * The error text renders under the field. Forwards its ref to the TextInput so
 * screens can chain focus (returnKeyType="next").
 */
import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { Animated, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { WeRideColors, WeRideRadius, WeRideSpacing } from '../theme/theme';
import { type } from '../theme/typography';
import { Motion, useReducedMotion } from './motion';

export interface TextFieldProps extends TextInputProps {
  error?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
}

const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { error, containerStyle, onFocus, onBlur, style, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const focus = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const lastError = useRef<string | null | undefined>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    // JS-driven (border colour); the field is tiny so this is cheap.
    Animated.timing(focus, {
      toValue: focused ? 1 : 0,
      duration: Motion.focus.durationMs,
      useNativeDriver: false,
    }).start();
  }, [focused, focus]);

  useEffect(() => {
    if (error && error !== lastError.current && !reduced) {
      const d = Motion.shake.distance;
      const step = (to: number) =>
        Animated.timing(shake, { toValue: to, duration: Motion.shake.stepMs, useNativeDriver: true });
      Animated.sequence([step(-d), step(d), step(-d / 2), step(0)]).start();
    }
    lastError.current = error;
  }, [error, shake, reduced]);

  const borderColor = error
    ? WeRideColors.error
    : focus.interpolate({ inputRange: [0, 1], outputRange: [WeRideColors.border, WeRideColors.primary] });

  return (
    <View style={containerStyle}>
      <Animated.View style={[styles.box, { borderColor, transform: [{ translateX: shake }] }]}>
        <TextInput
          ref={ref}
          placeholderTextColor={WeRideColors.textSub}
          selectionColor={WeRideColors.primary}
          {...rest}
          style={[styles.input, style]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
        />
      </Animated.View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
});

export default TextField;

const styles = StyleSheet.create({
  box: {
    height: 48,
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderRadius: WeRideRadius.xl,
    justifyContent: 'center',
  },
  input: { ...type.input, paddingHorizontal: WeRideSpacing.lg, height: '100%' },
  error: { ...type.caption, color: WeRideColors.error, marginTop: WeRideSpacing.xs },
});
