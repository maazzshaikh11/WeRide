// Catch-all stand-in for native-only packages: any property is a callable no-op.
function make() {
  const fn = function () { return make(); };
  return new Proxy(fn, {
    get(_t, p) {
      if (p === '__esModule') return true;
      if (p === 'then') return undefined;
      if (p === Symbol.toPrimitive) return () => '';
      if (p === 'default') return make();
      return make();
    },
    apply() { return make(); },
    construct() { return make(); },
  });
}
module.exports = make();
