import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, Auth } from "firebase/auth";

// Check if all required Firebase configuration values are available
const hasAllConfig = 
  !!import.meta.env.VITE_FIREBASE_API_KEY &&
  !!import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  !!import.meta.env.VITE_FIREBASE_APP_ID;

// Log configuration status for debugging
console.log("Firebase configuration status:", { 
  hasApiKey: !!import.meta.env.VITE_FIREBASE_API_KEY,
  hasProjectId: !!import.meta.env.VITE_FIREBASE_PROJECT_ID,  
  hasAppId: !!import.meta.env.VITE_FIREBASE_APP_ID
});

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID || 'placeholder'}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID || 'placeholder'}.appspot.com`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

// Initialize with null values that will be populated if config is available
let firebaseApp: FirebaseApp | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;

// Only initialize Firebase if we have all required config
if (hasAllConfig) {
  try {
    // Initialize Firebase
    firebaseApp = initializeApp(firebaseConfig);
    
    // Initialize Firebase Authentication
    auth = getAuth(firebaseApp);
    
    // Google Auth Provider
    googleProvider = new GoogleAuthProvider();
    
    console.log("Firebase initialized successfully");
  } catch (error) {
    console.error("Firebase initialization error:", error);
    // Reset variables in case of error
    firebaseApp = null;
    auth = null;
    googleProvider = null;
  }
} else {
  console.warn("Firebase not initialized due to missing configuration");
}

// Export Firebase objects (possibly null)
export { firebaseApp, auth, googleProvider };

// Check if Firebase is properly configured
export const isFirebaseConfigured = (): boolean => {
  return hasAllConfig && firebaseApp !== null && auth !== null;
};