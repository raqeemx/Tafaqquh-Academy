import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import type { User } from "firebase/auth";
import { getFirebaseServices } from "@/lib/firebase/client";

// Idempotent recovery when Auth succeeds but the profile write is interrupted.
// Existing approval/rejection is never overwritten by a client retry.
export async function ensureStudentProfile(user: User, displayName: string) {
  const name = displayName.trim();
  if (name.length < 2 || name.length > 100 || !user.email)
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
    });
  });
}
