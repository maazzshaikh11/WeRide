const React = require('react');

function AnimatedValue(value) {
  this._value = value || 0;
  this.setValue = function(v) { this._value = v; };
  this.interpolate = function(_config) { return _config; };
  this.addListener = function() {};
  this.removeListener = function() {};
  this.stopAnimation = function() {};
}

const View = function View(props) {
  return React.createElement('View', props, props.children);
};

const Text = function Text(props) {
  return React.createElement('Text', props, props.children);
};

const TouchableOpacity = function TouchableOpacity(props) {
  return React.createElement('TouchableOpacity', props, props.children);
};

const Image = function Image(props) {
  return React.createElement('Image', props, props.children);
};

const Animated = {
  Value: AnimatedValue,
  timing: jest.fn(function(_anim, _config) {
    return {
      start: function(callback) {
        if (callback) callback({ finished: true });
      },
    };
  }),
  loop: jest.fn(function(_animation) {
    return {
      start: function() {},
      stop: function() {},
    };
  }),
  sequence: jest.fn(function(_animations) {
    return {
      start: function() {},
      stop: function() {},
    };
  }),
  diffClamp: jest.fn(),
  View: function AnimatedView(props) {
    return React.createElement('Animated.View', props, props.children);
  },
};

module.exports = {
  __esModule: true,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet: {
    create: function(styles) { return styles; },
    flatten: function(style) { return style; },
    absoluteFill: {},
    absoluteFillObject: {},
    hairlineWidth: 1,
  },
  Animated,
  Platform: {
    OS: 'ios',
    Version: '15.0',
    select: function(obj) { return obj.ios !== undefined ? obj.ios : obj.default; },
  },
  Linking: {
    openURL: jest.fn().mockResolvedValue(true),
    canOpenURL: jest.fn().mockResolvedValue(true),
  },
  Dimensions: {
    get: jest.fn(function() { return { width: 375, height: 667 }; }),
    set: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  AccessibilityInfo: {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    setAccessibilityFocus: jest.fn(),
    announceForAccessibility: jest.fn(),
    isScreenReaderEnabled: jest.fn().mockResolvedValue(false),
    isReduceMotionEnabled: jest.fn().mockResolvedValue(false),
    isReduceTransparencyEnabled: jest.fn().mockResolvedValue(false),
    isBoldTextEnabled: jest.fn().mockResolvedValue(false),
    isGrayscaleEnabled: jest.fn().mockResolvedValue(false),
    isInvertColorsEnabled: jest.fn().mockResolvedValue(false),
  },
  Keyboard: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dismiss: jest.fn(),
    scheduleLayoutAnimation: jest.fn(),
  },
  Alert: {
    alert: jest.fn(function(_title, _message, buttons) {
      if (buttons && buttons.length > 0) {
        buttons[0].onPress?.();
      }
    }),
  },
  BackHandler: {
    addEventListener: jest.fn(),
    removeListener: jest.fn(),
    exitApp: jest.fn(),
  },
  PlatformConstants: {
    forceTouchAvailable: false,
  },
};
