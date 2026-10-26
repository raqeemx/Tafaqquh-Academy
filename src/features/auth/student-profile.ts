import {
  doc,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getFirebaseServices } from "@/lib/firebase/client";
import { PRIVACY_VERSION, isPrivacyApproved } from "@/lib/privacy/policy";

// Idempotent recovery when Auth succeeds but the profile write is interrupted.
// Existing approval/rejection is never overwritten by a client retry.
export async function ensureStudentProfile(
  user: User,
  displayName: string,
  consent: boolean,
) {
  const name = displayName.trim();
  if (
    name.length < 2 ||
    name.length > 100 ||
    !user.email ||
    !consent ||
    !isPrivacyApproved()
  )
    throw new Error("invalid-profile");
  const { db } = getFirebaseServices();
  const ref = doc(db, "students", user.uid);
  await runTransaction(db, async (transaction) => {
    if ((await transaction.get(ref)).exists()) return;
    transaction.set(ref, {
      uid: user.uid,
      email: user.email,
      displayName: name,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      consentVersion: PRIVACY_VERSION,
      consentedAt: serverTimestamp(),
    });
  });
}

export async function renewConsent(user: User, consent: boolean) {
  if (!consent || !isPrivacyApproved()) throw new Error("consent-required");
  await updateDoc(doc(getFirebaseServices().db, "students", user.uid), {
    consentVersion: PRIVACY_VERSION,
    consentedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
