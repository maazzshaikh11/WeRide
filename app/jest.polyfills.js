// Test-environment polyfills — run after RN preset setup.
// Fix Easing crash in test environment: bezier.js uses ESM export default
// which resolves without .default when required from Easing.js. Mock the
// bezier module directly so cubic-bezier easing works everywhere (module
// registry copies included). Easing curve values are irrelevant in tests.
jest.mock('react-native/Libraries/Animated/bezier', () => ({
  __esModule: true,
  default: () => (t: number) => t,
}));
require('react-native/Libraries/Animated/Easing');

// Polyfill missing Animated combinators in the RN jest mock.
try {
  const Animated = require('react-native').Animated;
  if (Animated) {
    const makeNoopValue = () => {
      class NoopValue {
        interpolate(cfg) { return this; }
        setValue() {}
        stopAnimation() {}
        addListener() { return { remove() {} }; }
        removeListener() {}
      }
      return new NoopValue();
    };
    if (typeof Animated.loop !== 'function') {
      Animated.loop = (anim) => ({
        start: (cb) => { try { anim?.start?.(cb); } catch { /* noop */ } },
        stop: () => { try { anim?.stop?.(); } catch { /* noop */ } },
        reset: () => undefined,
      });
    }
    if (typeof Animated.sequence !== 'function') {
      Animated.sequence = (...anims) => ({
        start: (cb) => { try { anims.forEach((a) => a?.start?.()); } catch { /* noop */ } cb?.({ finished: true }); },
        stop: () => anims.forEach((a) => a?.stop?.()),
        stopAnimation: () => undefined,
      });
    }
    if (typeof Animated.parallel !== 'function') {
      Animated.parallel = (...anims) => ({
        start: (cb) => { try { anims.forEach((a) => a?.start?.()); } catch { /* noop */ } cb?.({ finished: true }); },
        stop: () => anims.forEach((a) => a?.stop?.()),
      });
    }
    if (typeof Animated.timing !== 'function') {
      Animated.timing = () => ({ start: (cb) => cb?.({ finished: true }), stop: () => undefined });
    }
    if (typeof Animated.spring !== 'function') {
      Animated.spring = () => ({ start: (cb) => cb?.({ finished: true }), stop: () => undefined });
    }
    if (typeof Animated.Value !== 'function') {
      Animated.Value = makeNoopValue;
    }
  }
} catch {
  // Animated unavailable — ignore
}

// Also patch the live Easing object so default-eased Animated.timing calls
// work even in post-teardown timer callbacks (leaked animation timers).
try {
  const Easing = require('react-native/Libraries/Animated/Easing');
  const linear = (t: number) => t;
  if (Easing) {
    Easing.bezier = () => linear;
    Easing.ease = linear;
    Easing.linear = linear;
    if (typeof Easing.poly === 'function') Easing.poly = () => linear;
    if (typeof Easing.quad === 'function') Easing.quad = linear;
    if (typeof Easing.cubic === 'function') Easing.cubic = linear;
  }
} catch {
  // Easing unavailable — ignore
}
