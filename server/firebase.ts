import * as admin from 'firebase-admin';

let firebaseInitialized = false;

export function initializeFirebaseAdmin() {
  if (firebaseInitialized) return;

  try {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID;

    if (!projectId) {
      console.log('Firebase Admin SDK not initialized: Missing VITE_FIREBASE_PROJECT_ID');
      return;
    }

    if (serviceAccountKey) {
      try {
        const serviceAccount = JSON.parse(serviceAccountKey);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId,
        });
        firebaseInitialized = true;
        console.log('Firebase Admin SDK initialized with service account');
        return;
      } catch (parseError) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', parseError);
      }
    }

    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
        projectId,
      });
      firebaseInitialized = true;
      console.log('Firebase Admin SDK initialized with individual credentials');
      return;
    }

    console.log('Firebase Admin SDK not initialized: Missing service account credentials');
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
  }
}

export function isFirebaseAdminInitialized() {
  return firebaseInitialized;
}

export async function verifyFirebaseToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
  if (!firebaseInitialized) {
    throw new Error('Firebase Admin SDK not initialized');
  }
  return admin.auth().verifyIdToken(idToken);
}

export { admin };
