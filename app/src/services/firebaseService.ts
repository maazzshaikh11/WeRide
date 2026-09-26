/**
 * Shared Firebase service. Wraps @react-native-firebase modules.
 * Replaces firebase_service.dart.
 */
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import messaging from '@react-native-firebase/messaging';

export const firebaseAuth = auth();
export const firebaseFirestore = firestore();
export const firebaseMessaging = messaging();

export async function initFirebase(): Promise<void> {
  await firebaseMessaging.requestPermission();

  // Keep the SOS push target fresh: whenever FCM rotates the token,
  // persist it if someone is signed in (the Cloud Function
  // `onSosCreate` reads users/{uid}.fcm_token to fan out SOS alerts).
  firebaseMessaging.onTokenRefresh(async (token) => {
    try {
      const uid = firebaseAuth.currentUser?.uid;
      if (uid) await saveFcmToken(uid, token);
    } catch (e) {
      console.warn('[firebaseService] FCM token refresh save failed:', e);
    }
  });
}

/**
 * Persist this device's FCM token on the user's profile so the SOS
 * Cloud Function can reach them. Safe to call repeatedly (merge write).
 */
export async function saveFcmToken(uid: string, token?: string): Promise<void> {
  const fcmToken = token ?? (await firebaseMessaging.getToken());
  if (!fcmToken) return;
  await firebaseFirestore
    .collection('users')
    .doc(uid)
    .set({ fcm_token: fcmToken }, { merge: true });
}