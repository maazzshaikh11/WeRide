const { withFallback } = require('./lib.js');
const store = () => globalThis.__FS__;
module.exports = withFallback({
  subscribeToHazardClusters: (_g, cb) => { setTimeout(() => cb(globalThis.__CLUSTERS__ || []), 0); return () => {}; },
  submitHazardReport: async () => ({ queued: false }),
  triggerClustering: async () => {},
  resolveHazard: async () => {},
  triggerSos: async () => 'sos1',
  triggerSosWithStatus: async () => ({ sosId: 'sos1', queued: false }),
  resolveSos: async () => {},
  subscribeToSosEvents: (_g, cb) => { setTimeout(() => cb && cb(globalThis.__SOS__ || []), 0); return () => {}; },
  getLocalActiveSosEvents: () => globalThis.__SOS__ || [],
  startSyncWorker: () => () => {},
  syncHazardReports: async () => {}, syncSosEvents: async () => {}, mergeSosOnSync: async () => {},
  isOnline: async () => true,
  queuePeek: () => globalThis.__QUEUE__ || [], SOS_QUEUE: 'sos_queue', HAZARD_QUEUE: 'hazard_queue',
});
