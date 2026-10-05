// Auth mock for testing

let mockCurrentUser = { uid: 'test-user-123' };

const authFactory = () => ({
  currentUser: mockCurrentUser,
});

module.exports = authFactory;
module.exports.default = authFactory;

// Test helper: act as a different signed-in user.
module.exports.__setUid = (uid) => {
  mockCurrentUser.uid = uid;
};
