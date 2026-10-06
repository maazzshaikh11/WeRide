const { withFallback } = require('./lib.js');
class VoxClient { constructor() {} async start() {} async stop() {} setVoiceActive() {} setTalking() { return false; } }
class FlRoundLogger { constructor() {} getLastRound() { return null; } latest() { return null; } }
class FlClient { constructor() {} async start() {} async stop() {} }
module.exports = withFallback({
  VoxClient, FlRoundLogger, FlClient,
  requestMicrophonePermission: async () => true, checkMicrophonePermission: async () => true,
});
