export class Ekf { constructor() {} }
export class SensorStream { constructor() {} }
export class TrackingService { constructor() {} async start() { return true; } async stop() {} }
export class LocationPublisher {
  constructor(p) { this.riderId = p.riderId; this.groupId = p.groupId; }
  async fetchGroupLastKnown() { return []; }
  publish() {}
}
export const loadHlc = () => ({ now: () => '0:0' });
