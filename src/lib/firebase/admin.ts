import "server-only";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export function getAdminServices() {
  if (
    process.env.FIREBASE_ADMIN_ENABLED !== "true" ||
    process.env.FIREBASE_PROJECT_ID !== "tafaqquh-academy"
  ) {
    throw new Error("firebase/admin-not-configured");
  }
  const emulated = process.env.FIREBASE_USE_EMULATORS === "true";
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
  if (
    emulated
      ? process.env.NODE_ENV === "production" ||
        authHost !== "127.0.0.1:9099" ||
        firestoreHost !== "127.0.0.1:8080"
      : Boolean(authHost || firestoreHost)
  ) {
    throw new Error("firebase/invalid-emulator-configuration");
  }
  const app =
    getApps().find((item) => item.name === "academy-server") ??
    initializeApp(
      {
        projectId: process.env.FIREBASE_PROJECT_ID,
        ...(emulated ? {} : { credential: applicationDefault() }),
      },
      "academy-server",
    );
  return { auth: getAuth(app), db: getFirestore(app) };
}
