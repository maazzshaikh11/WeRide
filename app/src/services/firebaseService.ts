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
  // TODO: register FCM token for SOS push (Person B triggers via Cloud Function)
}