const mockGet = jest.fn().mockResolvedValue({ exists: false, data: () => ({}) });
const mockSet = jest.fn().mockResolvedValue(undefined);

const mockDocRef = jest.fn();
const mockColRef = jest.fn();

mockDocRef.mockImplementation(() => ({
  get: mockGet,
  set: mockSet,
  collection: mockColRef, // subcollections
}));

mockColRef.mockImplementation(() => ({
  doc: mockDocRef,
}));

const mockFirestore = jest.fn(() => ({ collection: mockColRef }));


mockFirestore._mockGet = mockGet;
mockFirestore._mockSet = mockSet;

module.exports = mockFirestore;
module.exports.default = mockFirestore;
