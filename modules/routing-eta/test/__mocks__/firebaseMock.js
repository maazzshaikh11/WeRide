// Firebase mocks for testing (Phase 2 T-05).
//
// A tiny in-memory Firestore that also plays the part of the security rules for the two things the group flow depends on
// (see infra/firebase/firestore.rules):
//   - `groups/{id}` is readable by its members only (a stranger's get() rejects with permission-denied);
//   - a non-member's update must add exactly themselves AND carry join_proof === "<join_code>:<uid>", changing nothing else.
// `join_codes/{CODE}` can be read by id by anyone and is create-only (an existing code cannot be overwritten).

let mockDocs = {}; // 'collection/id' -> data
const authFactoryForUid = require('./authMock');

const currentUid = () => authFactoryForUid().currentUser.uid;

const denied = (msg) => {
  const error = new Error(msg || 'permission-denied');
  error.code = 'permission-denied';
  return error;
};

const idOf = (key) => key.split('/')[1];

function applyUpdate(data, updates) {
  const next = { ...data };
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
  return next;
}

function checkRulesOnUpdate(coll, before, updates, uid) {
  if (coll !== 'groups') return;
  const members = before.member_ids || [];
  if (members.includes(uid)) return;
  const keys = Object.keys(updates);
  const ok =
    keys.every((k) => k === 'member_ids' || k === 'join_proof') &&
    updates.member_ids && updates.member_ids.type === 'arrayUnion' && updates.member_ids.value === uid &&
    before.join_code && updates.join_proof === `${before.join_code}:${uid}`;
  if (!ok) throw denied();
}

function docRef(coll, id) {
  const key = `${coll}/${id}`;
  return {
    id,
    set: async (data) => {
      if (coll === 'join_codes' && mockDocs[key]) throw denied('a join code cannot be overwritten');
      mockDocs[key] = { id, ...data };
    },
    update: async (updates) => {
      if (!mockDocs[key]) {
        const error = new Error('Group not found');
        error.code = 'not-found';
        throw error;
      }
      checkRulesOnUpdate(coll, mockDocs[key], updates, currentUid());
      mockDocs[key] = applyUpdate(mockDocs[key], updates);
    },
    get: async () => {
      if (coll === 'groups' && mockDocs[key] && !(mockDocs[key].member_ids || []).includes(currentUid())) throw denied();
      return { exists: !!mockDocs[key], id, data: () => mockDocs[key] };
    },
  };
}

const firestoreFactory = () => ({
  collection: (name) => ({
    doc: (id) => docRef(name, id),
    where: (field, op, value) => ({
      limit: (n) => ({
        get: async () => {
          const results = Object.entries(mockDocs)
            .filter(([key, doc]) => key.startsWith(`${name}/`) && doc[field] === value)
            .slice(0, n)
            .map(([, doc]) => doc);
          return {
            empty: results.length === 0,
            docs: results.map((doc) => ({ id: doc.id, data: () => doc })),
          };
        },
      }),
      onSnapshot: (onSuccess, onError) => {
        try {
          const results = Object.entries(mockDocs)
            .filter(([key]) => key.startsWith(`${name}/`))
            .map(([, doc]) => doc)
            .filter((group) => (op === 'array-contains' ? group[field]?.includes(value) : group[field] === value));
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
  // A write batch applies all or nothing (the rules are checked per write, like Firestore).
  batch: () => {
    const writes = [];
    return {
      set: (ref, data) => { writes.push([ref, data]); },
      commit: async () => {
        const snapshot = { ...mockDocs };
        try {
          for (const [ref, data] of writes) await ref.set(data);
        } catch (e) {
          mockDocs = snapshot;
          throw e;
        }
      },
    };
  },
  FieldValue: {
    serverTimestamp: () => new Date(),
    arrayUnion: (value) => ({ type: 'arrayUnion', value }),
    arrayRemove: (value) => ({ type: 'arrayRemove', value }),
  },
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
  mockDocs = {};
};
// Test helper: read a raw document ('groups/id', 'join_codes/CODE') bypassing the rules.
module.exports.__peek = (path) => mockDocs[path];
// Test helper: put a raw document in place bypassing the rules.
module.exports.__put = (path, data) => { mockDocs[path] = { id: idOf(path), ...data }; };
