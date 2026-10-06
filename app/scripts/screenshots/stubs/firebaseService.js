import auth from './auth.js';
import firestore from './firestore.js';
import messaging from './messaging.js';
export const firebaseAuth = auth();
export const firebaseFirestore = firestore();
export const firebaseMessaging = messaging();
export const saveFcmToken = async () => {};
export const initFirebase = async () => {};
