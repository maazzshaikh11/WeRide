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
        const next = { ...mockGroups[id] };
        for (const [k, v] of Object.entries(updates)) {
          if (v && v.type === 'arrayUnion') {
            const cur = next[k] || [];
            next[k] = cur.includes(v.value) ? cur : [...cur, v.value];
          } else if (v && v.type === 'arrayRemove') {
            next[k] = (next[k] || []).filter((x) => x !== v.value);
          } else {
            next[k] = v;
          }
        }
        mockGroups[id] = next;
      },
      get: async () => ({
        exists: !!mockGroups[id],
        id,
        data: () => mockGroups[id],
      }),
    }),
    where: (field, op, value) => ({
      limit: (n) => ({
        get: async () => {
          const results = Object.values(mockGroups)
            .filter((group) => group[field] === value)
            .slice(0, n);
          return {
            empty: results.length === 0,
            docs: results.map((doc) => ({ id: doc.id, data: () => doc })),
          };
        },
      }),
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
    arrayRemove: (value) => ({ type: 'arrayRemove', value }),
  },
});

const authFactory = () => ({
  currentUser: mockCurrentUser,
});

module.exports = firestoreFactory;
module.exports.default = firestoreFactory;
// Static FieldValue on the module (matches @react-native-firebase/firestore API)
module.exports.FieldValue = {
  serverTimestamp: () => new Date(),
  arrayUnion: (value) => ({ type: 'arrayUnion', value }),
  arrayRemove: (value) => ({ type: 'arrayRemove', value }),
};
// Test helper: wipe the in-memory store between tests.
module.exports.__reset = () => {
  mockGroups = {};
};