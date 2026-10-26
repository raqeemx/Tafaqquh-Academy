import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { validFirebaseTarget } from "./environment";

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
export function isFirebaseConfigured() {
  return (
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_ENABLED === "true" &&
    Object.values(config).every((value) => Boolean(value?.trim())) &&
    validFirebaseTarget(
      process.env.NEXT_PUBLIC_APP_ENV ?? "local",
      config.projectId,
      process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true",
      process.env.NEXT_PUBLIC_FIREBASE_STAGING_PROJECT_ID,
    )
  );
}

export function getFirebaseClient() {
  if (typeof window === "undefined" || !isFirebaseConfigured()) return null;
  return getApps().length ? getApp() : initializeApp(config);
}

let services: ReturnType<typeof initializeServices> | undefined;
function initializeServices() {
  const app = getFirebaseClient();
  if (!app) throw new Error("firebase/not-configured");
  const auth = getAuth(app);
  const db = getFirestore(app);
  auth.languageCode = "ar";
  if (process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true") {
    if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      throw new Error("firebase/emulator-local-only");
    }
    connectAuthEmulator(auth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  return { auth, db };
}
export function getFirebaseServices() {
  return (services ??= initializeServices());
}
