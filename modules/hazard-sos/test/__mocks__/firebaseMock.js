// Mock Firestore for Phase 4/5 testing
const firestoreData = {};
let shouldFailWrites = false;

const mockFirestore = () => {
  const createQuery = (path, whereClauses = []) => {
    const queryMethods = {
      where: jest.fn((field, op, value) => {
        return createQuery(path, [...whereClauses, { field, op, value }]);
      }),
      get: jest.fn(async () => {
        const allDocs = Object.entries(firestoreData[path] || {}).map(([id, data]) => ({
          id,
          data: () => data,
        }));

        // Filter by all where clauses
        const filtered = allDocs.filter(doc => {
          const data = doc.data();
          return whereClauses.every(({ field, op, value }) => {
            if (op === '==') {
              return data[field] === value;
            }
            return true;
          });
        });

        return { docs: filtered, empty: filtered.length === 0 };
      }),
      onSnapshot: jest.fn((callback, errorCallback) => {
        // Simulate immediate callback with current data
        const allDocs = Object.entries(firestoreData[path] || {}).map(([id, data]) => ({
          id,
          data: () => data,
        }));

        const filtered = allDocs.filter(doc => {
          const data = doc.data();
          return whereClauses.every(({ field, op, value }) => {
            if (op === '==') {
              return data[field] === value;
            }
            return true;
          });
        });

        const snapshot = {
          docs: filtered,
          empty: filtered.length === 0,
        };
        setTimeout(() => callback(snapshot), 0);

        // Return unsubscribe function
        return () => {};
      }),
    };
    return queryMethods;
  };

  const collection = (path) => {
    const collectionMethods = {
      doc: (id) => {
        const fullPath = `${path}/${id}`;
        const docRef = {
          _path: fullPath,
          _collectionPath: path,
          _id: id,
          set: jest.fn(async (data, options) => {
            if (shouldFailWrites) {
              throw new Error('Firestore write failed (mock)');
            }
            if (!firestoreData[path]) {
              firestoreData[path] = {};
            }
            firestoreData[path][id] = data;
            return { id };
          }),
          update: jest.fn(async (data) => {
            if (shouldFailWrites) {
              throw new Error('Firestore update failed (mock)');
            }
            if (!firestoreData[path]) {
              firestoreData[path] = {};
            }
            if (!firestoreData[path][id]) {
              throw new Error('Document does not exist');
            }
            firestoreData[path][id] = { ...firestoreData[path][id], ...data };
            return { id };
          }),
          get: jest.fn(async () => {
            const data = firestoreData[path]?.[id];
            return {
              exists: !!data,
              id,
              data: () => data,
            };
          }),
          collection: (subPath) => collection(`${path}/${id}/${subPath}`),
        };
        return docRef;
      },
      where: jest.fn((field, op, value) => {
        return createQuery(path, [{ field, op, value }]);
      }),
      get: jest.fn(async () => {
        const allDocs = Object.entries(firestoreData[path] || {}).map(([id, data]) => ({
          id,
          data: () => data,
        }));
        return { docs: allDocs, empty: allDocs.length === 0 };
      }),
      onSnapshot: jest.fn((callback, errorCallback) => {
        const allDocs = Object.entries(firestoreData[path] || {}).map(([id, data]) => ({
          id,
          data: () => data,
        }));
        const snapshot = { docs: allDocs, empty: allDocs.length === 0 };
        setTimeout(() => callback(snapshot), 0);
        return () => {};
      }),
    };
    return collectionMethods;
  };

  const batch = () => {
    const operations = [];
    return {
      set: jest.fn((ref, data) => {
        operations.push({ type: 'set', ref, data });
      }),
      update: jest.fn((ref, data) => {
        operations.push({ type: 'update', ref, data });
      }),
      commit: jest.fn(async () => {
        if (shouldFailWrites) {
          throw new Error('Firestore batch commit failed (mock)');
        }
        for (const op of operations) {
          if (op.type === 'set' && op.ref._collectionPath && op.ref._id) {
            const path = op.ref._collectionPath;
            const id = op.ref._id;
            if (!firestoreData[path]) {
              firestoreData[path] = {};
            }
            firestoreData[path][id] = op.data;
          }
        }
        return operations;
      }),
    };
  };

  return {
    collection,
    batch,
  };
};

// Test helpers
mockFirestore._getData = () => firestoreData;
mockFirestore._clearData = () => {
  Object.keys(firestoreData).forEach(key => delete firestoreData[key]);
};
mockFirestore._setFailWrites = (shouldFail) => {
  shouldFailWrites = shouldFail;
};

module.exports = {
  __esModule: true,
  default: mockFirestore,
};