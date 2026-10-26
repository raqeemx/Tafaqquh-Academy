import "server-only";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { validFirebaseTarget } from "./environment";
export function getAdminServices() {
  const environment = process.env.APP_ENV ?? "local";
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const emulated = process.env.FIREBASE_USE_EMULATORS === "true";
  if (
    process.env.FIREBASE_ADMIN_ENABLED !== "true" ||
    !validFirebaseTarget(
      environment,
      projectId,
      emulated,
      process.env.FIREBASE_STAGING_PROJECT_ID,
    ) ||
    projectId !== process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    environment !== (process.env.NEXT_PUBLIC_APP_ENV ?? "local") ||
    emulated !== (process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true") ||
    (environment === "staging" &&
      process.env.GOOGLE_CLOUD_PROJECT &&
      process.env.GOOGLE_CLOUD_PROJECT !== projectId)
  ) {
    throw new Error("firebase/admin-environment-mismatch");
  }
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
  if (
    emulated
      ? process.env.NODE_ENV === "production" ||
        authHost !== "127.0.0.1:9099" ||
        firestoreHost !== "127.0.0.1:8080"
      : Boolean(authHost || firestoreHost)
  )
    throw new Error("firebase/invalid-emulator-configuration");
  const app =
    getApps().find((item) => item.name === "academy-server") ??
    initializeApp(
      {
        projectId,
        ...(emulated ? {} : { credential: applicationDefault() }),
      },
      "academy-server",
    );
  return { auth: getAuth(app), db: getFirestore(app) };
}
