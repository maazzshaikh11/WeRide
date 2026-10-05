export const RIDE_TYPES = ['Casual', 'Touring', 'Sport', 'Off-road'];
export const generateJoinCode = () => 'K7M2QX';
export const isJoinCode = (s) => /^[A-Z0-9]{6}$/i.test(String(s).trim());
export class GroupService {
  myGroups(cb) { setTimeout(() => cb(globalThis.__GROUPS__ || []), 0); return () => {}; }
  async createGroup() { return 'new'; }
  async getGroup() { return { name: 'Sunday Ghat Ride', join_code: 'K7M2QX' }; }
  async getRidePlan() { return null; }
  async joinGroup() {}
  async leaveGroup() {}
}
