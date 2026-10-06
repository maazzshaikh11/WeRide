// Helpers for stub modules: anything not defined explicitly resolves to a harmless no-op (callable, awaitable).
function noop() {
  const fn = function () { return noop(); };
  return new Proxy(fn, {
    get(_t, p) { if (p === '__esModule') return false; if (p === 'then') return undefined; if (p === Symbol.toPrimitive) return () => ''; return noop(); },
    apply() { return noop(); }, construct() { return {}; },
  });
}
function withFallback(obj) {
  return new Proxy(obj, { get(t, p) { if (p in t) return t[p]; if (p === '__esModule' || p === 'then' || typeof p === 'symbol') return undefined; return noop(); } });
}
module.exports = { noop, withFallback };
