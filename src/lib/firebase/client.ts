import { getApp, getApps, initializeApp } from "firebase/app";

// Explicit access is required for Next.js to inline public build-time variables.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Lazy browser-only initialization. No services or network calls on import. */
export function getFirebaseClient() {
  if (
    typeof window === "undefined" ||
    Object.values(config).some((value) => !value?.trim())
  )
    return null;
  return getApps().length ? getApp() : initializeApp(config);
}
