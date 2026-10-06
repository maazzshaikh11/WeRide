/** Who is signed in (set by SessionBootstrap from Firebase auth). `authKnown` is false until Firebase reports once. */
import { create } from 'zustand';

interface SessionState {
  authKnown: boolean;
  uid: string | null;
  setAuth: (uid: string | null) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  authKnown: false,
  uid: null,
  setAuth: (uid) => set({ authKnown: true, uid }),
}));
