/**
 * SessionBootstrap — keeps the app's session state in step with Firebase auth, for the whole app lifetime:
 * who is signed in, their profile + private settings listeners, the push token, and a clean slate on sign-out.
 * Renders nothing.
 */
import { useEffect } from 'react';
import { firebaseAuth, saveFcmToken } from '../services/firebaseService';
import { resetRideSession } from '../store/rideSession';
import { useAppStore } from '../store/appStore';
import { usePrefsStore } from '../store/prefsStore';
import { useCrewsStore } from '../store/crewsStore';
import { useProfileStore } from '../store/profileStore';
import { useRidesStore } from '../store/ridesStore';
import { useSessionStore } from '../store/sessionStore';

export default function SessionBootstrap() {
  useEffect(() => {
    let stopProfile: (() => void) | null = null;
    let stopPrefs: (() => void) | null = null;
    let stopCrews: (() => void) | null = null;
    let stopRides: (() => void) | null = null;
    const stop = () => {
      stopProfile?.();
      stopPrefs?.();
      stopCrews?.();
      stopRides?.();
      stopProfile = stopPrefs = stopCrews = stopRides = null;
    };
    const unsubscribe = firebaseAuth.onAuthStateChanged((user: { uid: string } | null) => {
      stop();
      if (user) {
        useAppStore.getState().setUserId(user.uid);
        stopProfile = useProfileStore.getState().watchMe(user.uid);
        stopPrefs = usePrefsStore.getState().watch(user.uid);
        stopCrews = useCrewsStore.getState().watch(user.uid);
        stopRides = useRidesStore.getState().watch(user.uid);
        Promise.resolve().then(() => saveFcmToken(user.uid)).catch(() => undefined);
        useSessionStore.getState().setAuth(user.uid);
      } else {
        useAppStore.getState().setUserId(null);
        useAppStore.getState().setGroupId(null);
        useProfileStore.getState().clear();
        usePrefsStore.getState().reset();
        useCrewsStore.getState().clear();
        useRidesStore.getState().clear();
        resetRideSession();
        useSessionStore.getState().setAuth(null);
      }
    });
    return () => {
      stop();
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);
  return null;
}
