// Production wiring: firebase-admin ID-token verification + Firestore group
// membership. Loaded lazily (dynamic import) so tests and dev never touch it.
// Credentials come from the environment, never from the repo:
//   FIREBASE_PROJECT_ID (or GOOGLE_CLOUD_PROJECT)
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
//     | FIREBASE_SERVICE_ACCOUNT_JSON='{...}'
//     | FIREBASE_USE_ADC=1  (Cloud Run / GCE attached service account)

import { isValidGroupId } from './auth.js';

export async function createFirebaseAuthDeps(env = process.env) {
  const projectId = env.FIREBASE_PROJECT_ID || env.GOOGLE_CLOUD_PROJECT || env.GCLOUD_PROJECT;
  if (!projectId) {
    throw new Error('Firebase Admin not configured: set FIREBASE_PROJECT_ID. Refusing to start.');
  }
  if (!env.GOOGLE_APPLICATION_CREDENTIALS && !env.FIREBASE_SERVICE_ACCOUNT_JSON && env.FIREBASE_USE_ADC !== '1') {
    throw new Error(
      'Firebase Admin credentials missing: set GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_SERVICE_ACCOUNT_JSON ' +
        'or FIREBASE_USE_ADC=1. Refusing to start.'
    );
  }

  const { initializeApp, applicationDefault, cert, getApps } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  const { getFirestore } = await import('firebase-admin/firestore');

  const credential = env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON))
    : applicationDefault();
  const app = getApps().find((a) => a.name === 'weride-server') || initializeApp({ credential, projectId }, 'weride-server');
  const auth = getAuth(app);
  const db = getFirestore(app);

  return {
    verifier: async (idToken) => {
      const d = await auth.verifyIdToken(idToken);
      return { uid: d.uid, exp: d.exp };
    },
    fetchMembers: async (groupId) => {
      if (!isValidGroupId(groupId)) return [];
      const snap = await db.collection('groups').doc(groupId).get();
      if (!snap.exists) return [];
      const ids = snap.get('member_ids');
      return Array.isArray(ids) ? ids.filter((x) => typeof x === 'string') : [];
    },
  };
}
