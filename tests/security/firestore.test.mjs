import { before, after, beforeEach, test } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
let env;
before(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080")
    throw new Error("Local emulator required.");
  env = await initializeTestEnvironment({
    projectId: "tafaqquh-academy",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});
after(async () => env?.cleanup());
beforeEach(async () => env.clearFirestore());
const student = (uid = "student-a", verified = true) =>
  env
    .authenticatedContext(uid, {
      email: `${uid}@example.test`,
      email_verified: verified,
    })
    .firestore();
const profile = (uid = "student-a", status = "pending") => ({
  uid,
  email: `${uid}@example.test`,
  displayName: "طالب اختبار محلي",
  status,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});
async function seed(status = "pending") {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "students/student-a"), profile("student-a", status));
    await setDoc(doc(db, "restrictedContent/lesson"), {
      title: "اختبار محلي",
      body: "محتوى اصطناعي للاختبار",
      published: true,
    });
    await setDoc(doc(db, "restrictedContent/draft"), { published: false });
  });
}
test("anonymous access is denied everywhere", async () => {
  await seed();
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, "students/student-a")));
  await assertFails(getDoc(doc(db, "restrictedContent/lesson")));
  await assertFails(setDoc(doc(db, "students/student-a"), profile()));
});
test("student creates only own pending application and reads it", async () => {
  const db = student();
  await assertSucceeds(setDoc(doc(db, "students/student-a"), profile()));
  await assertSucceeds(getDoc(doc(db, "students/student-a")));
  await assertFails(getDocs(collection(db, "students")));
  await assertFails(getDoc(doc(student("student-b"), "students/student-a")));
});
test("forged status, identity, email, role and timestamps are denied", async () => {
  const db = student();
  const ref = doc(db, "students/student-a");
  for (const changes of [
    { status: "approved" },
    { uid: "student-b" },
    { email: "other@example.test" },
    { role: "admin" },
    { createdAt: new Date(0) },
    { displayName: "" },
  ]) {
    await assertFails(setDoc(ref, { ...profile(), ...changes }));
  }
  await assertFails(
    setDoc(doc(db, "students/student-b"), profile("student-b")),
  );
});
test("client cannot approve, change or delete an application even with forged admin claim", async () => {
  await seed();
  const db = student();
  await assertFails(
    updateDoc(doc(db, "students/student-a"), { status: "approved" }),
  );
  await assertFails(
    updateDoc(doc(db, "students/student-a"), { displayName: "اسم بديل" }),
  );
  await assertFails(deleteDoc(doc(db, "students/student-a")));
  const admin = env
    .authenticatedContext("student-a", { admin: true })
    .firestore();
  await assertFails(
    updateDoc(doc(admin, "students/student-a"), { status: "approved" }),
  );
});
for (const status of ["pending", "rejected", "suspended"]) {
  test(`${status} student cannot read restricted content`, async () => {
    await seed(status);
    await assertFails(getDoc(doc(student(), "restrictedContent/lesson")));
  });
}
test("missing profile and unverified email fail closed", async () => {
  await seed("approved");
  await assertFails(
    getDoc(doc(student("missing"), "restrictedContent/lesson")),
  );
  await assertFails(
    getDoc(doc(student("student-a", false), "restrictedContent/lesson")),
  );
});
test("approved verified student reads only published content and cannot write", async () => {
  await seed("approved");
  const db = student();
  await assertSucceeds(getDoc(doc(db, "restrictedContent/lesson")));
  await assertSucceeds(
    getDocs(
      query(
        collection(db, "restrictedContent"),
        where("published", "==", true),
      ),
    ),
  );
  await assertFails(getDocs(collection(db, "restrictedContent")));
  await assertFails(getDoc(doc(db, "restrictedContent/draft")));
  await assertFails(
    setDoc(doc(db, "restrictedContent/injected"), { published: true }),
  );
  await assertFails(getDoc(doc(db, "admissionAudit/private")));
});
test("revoking approval denies subsequent reads using the same auth context", async () => {
  await seed("approved");
  const db = student();
  await assertSucceeds(getDoc(doc(db, "restrictedContent/lesson")));
  await env.withSecurityRulesDisabled(async (c) =>
    updateDoc(doc(c.firestore(), "students/student-a"), {
      status: "suspended",
    }),
  );
  await assertFails(getDoc(doc(db, "restrictedContent/lesson")));
});
