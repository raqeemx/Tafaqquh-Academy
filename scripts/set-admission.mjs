import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
// Trusted operator only. This is not an HTTP endpoint or a student-facing action.
const [uid, status, confirm] = process.argv.slice(2);
if (
  !uid ||
  uid.includes("/") ||
  !["approved", "rejected", "suspended"].includes(status)
) {
  throw new Error(
    "Usage: node scripts/set-admission.mjs <uid> approved|rejected|suspended [--apply]",
  );
}
if (process.env.FIREBASE_PROJECT_ID !== "tafaqquh-academy")
  throw new Error("Set FIREBASE_PROJECT_ID=tafaqquh-academy explicitly.");
if (
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||
  process.env.FIRESTORE_EMULATOR_HOST
)
  throw new Error("Operator script does not accept emulator overrides.");
if (confirm !== "--apply") {
  console.log(
    "Dry run: would set the selected student to",
    status,
    "in tafaqquh-academy. No connection or write performed.",
  );
  process.exit(0);
}
const app = initializeApp({
  projectId: "tafaqquh-academy",
  credential: applicationDefault(),
});
const user = await getAuth(app).getUser(uid);
if (status === "approved" && (!user.emailVerified || user.disabled))
  throw new Error("Approval requires a verified, enabled Auth account.");
const db = getFirestore(app);
await db.runTransaction(async (tx) => {
  const ref = db.doc(`students/${uid}`);
  if (!(await tx.get(ref)).exists)
    throw new Error("Student application does not exist.");
  tx.update(ref, {
    status,
    updatedAt: FieldValue.serverTimestamp(),
    reviewedAt: FieldValue.serverTimestamp(),
  });
  tx.create(db.collection("admissionAudit").doc(), {
    studentUid: uid,
    status,
    at: FieldValue.serverTimestamp(),
  });
});
console.log("Admission status updated.");
