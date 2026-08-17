// Firebase mocks for testing (Phase 2 T-05)

let mockGroups = {};
let mockCurrentUser = { uid: 'test-user-123' };

const firestoreFactory = () => ({
  collection: (name) => ({
    doc: (id) => ({
      set: async (data) => {
        mockGroups[id] = { id, ...data };
      },
      update: async (updates) => {
        if (!mockGroups[id]) {
          const error = new Error('Group not found');
          error.code = 'not-found';
          throw error;
        }
        mockGroups[id] = { ...mockGroups[id], ...updates };
      },
      get: async () => ({
        exists: !!mockGroups[id],
        id,
        data: () => mockGroups[id],
      }),
    }),
    where: (field, op, value) => ({
      onSnapshot: (onSuccess, onError) => {
        try {
          const results = Object.values(mockGroups).filter((group) => {
            if (op === 'array-contains') {
              return group[field]?.includes(value);
            }
            return group[field] === value;
          });
          onSuccess({
            docs: results.map((doc) => ({
              id: doc.id,
              data: () => doc,
            })),
          });
        } catch (e) {
          onError?.(e);
        }
        return () => {}; // unsubscribe function
      },
    }),
  }),
  FieldValue: {
    serverTimestamp: () => new Date(),
    arrayUnion: (value) => ({ type: 'arrayUnion', value }),
  },
});

const authFactory = () => ({
  currentUser: mockCurrentUser,
});

module.exports = firestoreFactory;
module.exports.default = firestoreFactory;