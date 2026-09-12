console.log('[MOCK] reactTestRendererMock.js loaded');

// Mock react-test-renderer for testing
console.log('[MOCK] react-test-renderer mock loaded');

const act = function(callback) {
  console.log('[MOCK] act called with:', typeof callback);
  if (typeof callback === 'function') {
    return callback();
  }
  return Promise.resolve();
};

const createRenderer = function(element) {
  const root = {
    findByType: function() { return null; },
    findAllByType: function() { return []; },
    findByProps: function() { return null; },
    findAllByProps: function() { return []; },
    toJSON: function() { return null; },
  };
  return {
    root: root,
    unmount: function() {},
    toJSON: function() { return null; },
    toTree: function() { return null; },
  };
};

const TestRenderer = function(element) {
  return {
    root: {
      findByType: function() { return null; },
      findAllByType: function() { return []; },
      findByProps: function() { return null; },
      findAllByProps: function() { return []; },
      toJSON: function() { return null; },
    },
    unmount: function() {},
    toJSON: function() { return null; },
    toTree: function() { return null; },
  };
};

TestRenderer.create = function(element) {
  const root = {
    findByType: function() { return null; },
    findAllByType: function() { return []; },
    findByProps: function() { return null; },
    findAllByProps: function() { return []; },
    toJSON: function() { return null; },
  };
  return {
    root: root,
    unmount: function() {},
    toJSON: function() { return null; },
    toTree: function() { return null; },
  };
};

TestRenderer.act = function(callback) {
  console.log('[MOCK] TestRenderer.act called with:', typeof callback);
  if (typeof callback === 'function') {
    return callback();
  }
  return Promise.resolve();
};

TestRenderer.ReactTestRenderer = class ReactTestRenderer {};

module.exports = {
  __esModule: true,
  default: {
    create: function(element) {
      const root = {
        findByType: function() { return null; },
        findAllByType: function() { return []; },
        findByProps: function() { return null; },
        findAllByProps: function() { return []; },
        toJSON: function() { return null; },
      };
      return {
        root: root,
        unmount: function() {},
        toJSON: function() { return null; },
        toTree: function() { return null; },
      };
    },
    act: function(callback) {
      console.log('[MOCK] default.act called with:', typeof callback);
      if (typeof callback === 'function') {
        return callback();
      }
      return Promise.resolve();
    },
  },
  TestRenderer: function(element) {
    return {
      root: {
        findByType: function() { return null; },
        findAllByType: function() { return []; },
        findByProps: function() { return null; },
        findAllByProps: function() { return []; },
        toJSON: function() { return null; },
      },
      unmount: function() {},
      toJSON: function() { return null; },
      toTree: function() { return null; },
    };
  },
  act: function(callback) {
    console.log('[MOCK] named act called with:', typeof callback);
    if (typeof callback === 'function') {
      return callback();
    }
    return Promise.resolve();
  },
  ReactTestRenderer: class ReactTestRenderer {},
};