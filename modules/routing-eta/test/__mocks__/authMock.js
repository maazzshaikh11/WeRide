// Auth mock for testing

let mockCurrentUser = { uid: 'test-user-123' };

const authFactory = () => ({
  currentUser: mockCurrentUser,
});

module.exports = authFactory;
module.exports.default = authFactory;
