import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
const [uid, flag] = process.argv.slice(2);
const projectId = process.env.FIREBASE_PROJECT_ID;
if (!uid || !/^[A-Za-z0-9_-]{1,128}$/.test(uid))
  throw new Error("Provide the verified account UID, never an email.");
if (
  !projectId ||
  !["tafaqquh-academy", process.env.FIREBASE_STAGING_PROJECT_ID]
    .filter(Boolean)
    .includes(projectId)
)
  throw new Error("Explicit trusted FIREBASE_PROJECT_ID is required.");
if (
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||
  process.env.FIRESTORE_EMULATOR_HOST
)
  throw new Error(
    "This bootstrap is for an explicitly selected cloud project only.",
  );
if (flag !== "--apply") {
  console.log(
    "Dry run only. No connection or change. Confirm UID and project before --apply.",
  );
  process.exit(0);
}
const app = initializeApp({ projectId, credential: applicationDefault() });
const account = await getAuth(app).getUser(uid);
if (!account.emailVerified || account.disabled)
  throw new Error("First administrator must have a verified, enabled account.");
const db = getFirestore(app);
await db.runTransaction(async (tx) => {
  const marker = db.doc("system/administratorBootstrap");
  const [existing, administrators] = await Promise.all([
    tx.get(marker),
    tx.get(db.collection("administrators").limit(1)),
  ]);
  if (existing.exists || !administrators.empty)
    throw new Error(
      "Administrator bootstrap has already happened. Use the trusted IAM owner process for subsequent changes.",
    );
  tx.create(db.doc(`administrators/${uid}`), {
    role: "admin",
    active: true,
    createdAt: FieldValue.serverTimestamp(),
    provisionedBy: "trusted-iam-bootstrap",
  });
  tx.create(marker, { uid, at: FieldValue.serverTimestamp() });
  tx.create(db.collection("admissionAudit").doc(), {
    studentUid: "",
    actorUid: "trusted-iam-bootstrap",
    actorEmail: "",
    action: "bootstrap-admin",
    from: "",
    to: uid,
    reason:
      "First administrator; credential principal is recorded by Cloud Audit Logs when enabled.",
    programId: null,
    at: FieldValue.serverTimestamp(),
  });
});
console.log("First administrator provisioned. Sign in at /admin.");
