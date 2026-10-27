"use client";
import { signOut } from "firebase/auth";
import { getFirebaseServices } from "./client";
export async function academySignOut() {
  try {
    await fetch("/api/student/media-session", { method: "DELETE" });
  } finally {
    await signOut(getFirebaseServices().auth);
  }
}
