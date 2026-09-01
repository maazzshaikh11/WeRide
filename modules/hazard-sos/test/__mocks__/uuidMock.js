// UUID mock for testing
let counter = 0;
const mockUuid = () => `mock-uuid-${Date.now()}-${++counter}`;

module.exports = {
  __esModule: true,
  v4: mockUuid,
  default: mockUuid,
};