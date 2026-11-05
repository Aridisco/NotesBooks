// Firebase web config comes from .env (VITE_FIREBASE_*). It is public by design once built;
// access is protected by Firestore security rules, not by hiding these values.
const e = import.meta.env;
export const FB_CONFIG = {
  apiKey: e.VITE_FIREBASE_API_KEY,
  authDomain: e.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: e.VITE_FIREBASE_PROJECT_ID,
  storageBucket: e.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: e.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: e.VITE_FIREBASE_APP_ID
};
