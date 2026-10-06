// Stand-in for @react-native-firebase/auth. currentUser comes from globalThis.__AUTH_UID__ (default teamDSY's uid).
const listeners = new Set();
const user = () => (globalThis.__AUTH_UID__ ? { uid: globalThis.__AUTH_UID__, phoneNumber: '+919876543210', email: 'teamdsy@weride.app', displayName: 'teamDSY' } : null);
const inst = {
  get currentUser() { return user(); },
  onAuthStateChanged(cb) { listeners.add(cb); setTimeout(() => cb(user()), 0); return () => listeners.delete(cb); },
  onIdTokenChanged(cb) { setTimeout(() => cb(user()), 0); return () => {}; },
  signInWithPhoneNumber: async () => ({ confirm: async () => ({ user: user() }) }),
  signInWithEmailAndPassword: async () => ({ user: user() }),
  createUserWithEmailAndPassword: async () => ({ user: user() }),
  signOut: async () => {},
};
const auth = () => inst;
auth.PhoneAuthState = {};
export default auth;
