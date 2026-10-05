export const firebaseAuth = {
  currentUser: { uid: 'u1', email: 'rider@weride.app' },
  onAuthStateChanged(cb) { setTimeout(() => cb(null), 0); return () => {}; },
  signInWithEmailAndPassword: async () => ({ user: { uid: 'u1' } }),
  createUserWithEmailAndPassword: async () => ({ user: { uid: 'u1' } }),
  signOut: async () => {},
};
export const saveFcmToken = async () => {};
export const initFirebase = async () => {};
