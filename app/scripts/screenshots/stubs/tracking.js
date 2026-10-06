const { withFallback } = require('./lib.js');
class Ekf { constructor() {} }
class SensorStream { constructor() {} }
class TrackingService { constructor() {} async start() { return true; } async stop() {} }
class LocationPublisher {
  constructor(p) { this.riderId = p && p.riderId; this.groupId = p && p.groupId; }
  async fetchGroupLastKnown() { return []; }
  publish() {}
}
module.exports = withFallback({ Ekf, SensorStream, TrackingService, LocationPublisher, loadHlc: () => ({ now: () => `${Date.now()}:0` }) });
