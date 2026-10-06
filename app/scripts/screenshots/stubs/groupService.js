const { withFallback } = require('./lib.js');
const doc = (id) => (globalThis.__FS__ || new Map()).get(`groups/${id}`);
class GroupService {
  myGroups(cb) { setTimeout(() => cb([]), 0); return () => {}; }
  async createGroup() { return 'new'; }
  async getGroup(id) { const d = doc(id); return d ? { id, ...d } : { name: 'Ride', join_code: 'K7M2QX' }; }
  async getRidePlan() { return null; }
  async joinGroup() {}
  async leaveGroup() {}
}
module.exports = withFallback({ GroupService, RIDE_TYPES: ['Casual', 'Touring', 'Sport', 'Off-road'], generateJoinCode: () => 'K7M2QX', isJoinCode: (s) => /^[A-Z0-9]{6}$/i.test(String(s).trim()) });
