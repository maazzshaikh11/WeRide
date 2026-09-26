const mockGet = jest.fn().mockResolvedValue({ exists: false, data: () => ({}) });
const mockSet = jest.fn().mockResolvedValue(undefined);
// Collection query: collection(...).get() -> QuerySnapshot-like { empty, docs }
const mockGetAll = jest.fn().mockResolvedValue({ empty: true, docs: [] });

const mockDocRef = jest.fn();
const mockColRef = jest.fn();

mockDocRef.mockImplementation(() => ({
  get: mockGet,
  set: mockSet,
  collection: mockColRef, // subcollections
}));

mockColRef.mockImplementation(() => ({
  doc: mockDocRef,
  get: mockGetAll, // subcollection / collection query
}));

const mockFirestore = jest.fn(() => ({ collection: mockColRef }));


mockFirestore._mockGet = mockGet;
mockFirestore._mockSet = mockSet;
mockFirestore._mockGetAll = mockGetAll;

module.exports = mockFirestore;
module.exports.default = mockFirestore;
