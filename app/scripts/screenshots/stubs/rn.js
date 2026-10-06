// react-native for the browser: react-native-web plus the few native-only exports the app touches at import time.
export * from 'react-native-web';
import * as RNW from 'react-native-web';
import React from 'react';
const { Platform } = RNW;
// Device under test, from the page URL (see index.html / shoot.mjs): ?w=&h=&top=&bottom=&fs=&os=
const QS = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const FS = Number(QS.get('fs')) || 1;
// The app renders its iOS branches by default; ?os=android renders the Android ones.
Platform.OS = QS.get('os') === 'android' ? 'android' : 'ios';
Platform.Version = '17.0';
Platform.select = (o) => (o && (o[Platform.OS] !== undefined ? o[Platform.OS] : o.native !== undefined ? o.native : o.default));
export const PermissionsAndroid = {
  PERMISSIONS: {},
  RESULTS: { GRANTED: 'granted', DENIED: 'denied', NEVER_ASK_AGAIN: 'never_ask_again' },
  check: async () => false,
  request: async () => 'denied',
  requestMultiple: async () => ({}),
};
export const ToastAndroid = { show() {}, SHORT: 0, LONG: 1 };
export const BackHandler = { addEventListener: () => ({ remove() {} }), removeEventListener() {}, exitApp() {} };

// ───────────── font scale: what the OS "large text" setting does on a device ─────────────
// react-native-web reports fontScale 1 and never scales Text. On a device RN multiplies fontSize and lineHeight by
// min(fontScale, maxFontSizeMultiplier) unless allowFontScaling={false}; do the same here so renders and the layout
// checker see what a user with large text sees. adjustsFontSizeToFit (ignored by RNW) is emulated too.
export const PixelRatio = {
  get: () => RNW.PixelRatio.get(),
  getFontScale: () => FS,
  getPixelSizeForLayoutSize: (n) => RNW.PixelRatio.getPixelSizeForLayoutSize(n),
  roundToNearestPixel: (n) => RNW.PixelRatio.roundToNearestPixel(n),
};
export const Dimensions = {
  get: (k) => ({ ...RNW.Dimensions.get(k), fontScale: FS }),
  set: (...a) => RNW.Dimensions.set(...a),
  addEventListener: (...a) => RNW.Dimensions.addEventListener(...a),
};
export function useWindowDimensions() {
  const d = RNW.useWindowDimensions();
  return React.useMemo(() => ({ ...d, fontScale: FS }), [d]);
}
const InText = React.createContext(false);
function scaled(style, props, nested) {
  const flat = RNW.StyleSheet.flatten(style) || {};
  if (props.allowFontScaling === false || FS === 1) return { flat, mult: 1 };
  const cap = props.maxFontSizeMultiplier;
  const mult = cap != null && cap > 0 ? Math.min(FS, cap) : FS;
  const out = { ...flat };
  const size = flat.fontSize ?? (nested ? undefined : 14);
  if (size != null) out.fontSize = size * mult;
  if (typeof flat.lineHeight === 'number') out.lineHeight = flat.lineHeight * mult;
  return { flat: out, mult };
}
function fit(el, props, base, baseLine) {
  if (!el || !props.adjustsFontSizeToFit) return;
  // start from the size React rendered, shrink in half-point steps (line height with it) until it fits, like iOS / Android do
  el.style.fontSize = base + 'px';
  if (baseLine) el.style.lineHeight = baseLine + 'px';
  const min = (props.minimumFontScale ?? 0.5) * base;
  let size = base;
  const over = () => el.scrollWidth > el.clientWidth + 0.5 || (props.numberOfLines > 1 ? el.scrollHeight > el.clientHeight + 0.5 : false);
  while (over() && size > min) {
    size -= 0.5;
    el.style.fontSize = size + 'px';
    if (baseLine) el.style.lineHeight = (baseLine * size) / base + 'px';
  }
}
export const Text = React.forwardRef(function Text(props, fwd) {
  const nested = React.useContext(InText);
  const { flat } = scaled(props.style, props, nested);
  const ref = React.useRef(null);
  React.useLayoutEffect(() => { fit(ref.current, props, flat.fontSize || 14, typeof flat.lineHeight === 'number' ? flat.lineHeight : 0); });
  const set = (n) => { ref.current = n; if (typeof fwd === 'function') fwd(n); else if (fwd) fwd.current = n; };
  return React.createElement(InText.Provider, { value: true }, React.createElement(RNW.Text, { ...props, style: flat, ref: set }));
});
Text.displayName = 'Text';
export const TextInput = React.forwardRef(function TextInput(props, fwd) {
  const { flat } = scaled(props.style, props, false);
  return React.createElement(RNW.TextInput, { ...props, style: flat, ref: fwd });
});
TextInput.displayName = 'TextInput';
export const Animated = { ...RNW.Animated, Text: RNW.Animated.createAnimatedComponent(Text) };
// RNW ignores hitSlop; expose it as data-hitslop so the touch-target checker can count it.
const slop = (h) => (h == null ? null : typeof h === 'number' ? [h, h, h, h] : [h.top || 0, h.right || 0, h.bottom || 0, h.left || 0]).toString?.();
export const Pressable = React.forwardRef(function Pressable(props, ref) {
  const { hitSlop, ...rest } = props;
  const hs = hitSlop == null ? null : slop(hitSlop);
  return React.createElement(RNW.Pressable, { ...rest, dataSet: hs ? { ...(rest.dataSet || {}), hitslop: hs } : rest.dataSet, ref });
});
Pressable.displayName = 'Pressable';
// tel:/sms:/https: links must not navigate the page away from the scene (the real app hands them to the OS).
export const Linking = { ...RNW.Linking, openURL: async () => true, canOpenURL: async () => true };
