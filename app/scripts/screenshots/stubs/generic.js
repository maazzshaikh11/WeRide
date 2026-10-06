// Catch-all stand-in for native-only packages: any property is a callable no-op.
const { noop } = require('./lib.js');
module.exports = noop();
