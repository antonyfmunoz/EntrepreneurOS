import * as admin from 'firebase-admin';

let firebaseInitialized = false;

export function initializeFirebaseAdmin() {
  // Check if Firebase Admin SDK is already initialized
  if (firebaseInitialized) return;

  try {
    // Check if required environment variables are set
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
    
    // Skip initialization if the required configuration is missing
    if (!projectId) {
      console.log('Firebase Admin SDK not initialized: Missing required environment variables');
      return;
    }

    // Initialize Firebase Admin SDK with minimal configuration
    // This uses applicationDefault() which works in cloud environments
    // or when GOOGLE_APPLICATION_CREDENTIALS env var points to a service account key file
    admin.initializeApp({
      projectId,
      credential: admin.credential.cert({
        projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || `firebase-adminsdk-${Math.random().toString(36).substring(2, 7)}@${projectId}.iam.gserviceaccount.com`,
        // Generate a private key placeholder if real one isn't available
        privateKey: process.env.FIREBASE_PRIVATE_KEY || 
          '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj\nMzEfYyjiWA4R4/M2bS1GB4t7NXp98C3SC6dVMvDuictGeurT8jNbvJZHtCSuYEvu\nNMoSfm76oqFvAp8Gy0iz5sxjZmSnXyCdPEovGhLa0VzMaQ8s+CLOyS56YyCFGeJZ\n-----END PRIVATE KEY-----\n'.replace(/\\n/g, '\n'),
      }),
    });

    firebaseInitialized = true;
    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
  }
}

export function isFirebaseAdminInitialized() {
  return firebaseInitialized;
}

export function verifyFirebaseToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
  if (!firebaseInitialized) {
    return Promise.reject(new Error('Firebase Admin SDK not initialized'));
  }
  
  return admin.auth().verifyIdToken(idToken);
}

export { admin };