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
    projectId: "demo-tafaqquh",
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
  consentVersion: "2026-10-26.v1",
  consentedAt: serverTimestamp(),
});
async function seed(status = "pending") {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "students/student-a"), profile("student-a", status));
    await setDoc(doc(db, "restrictedContent/lesson"), {
      title: "اختبار محلي",
      body: "محتوى اصطناعي للاختبار",
      published: true,
      programId: "alpha",
    });
    await setDoc(doc(db, "restrictedContent/draft"), {
      published: false,
      programId: "alpha",
    });
    await setDoc(doc(db, "programs/alpha"), {
      published: true,
      title: "برنامج اختبار",
    });
    await setDoc(doc(db, "students/student-a/enrollments/alpha"), {
      active: true,
      programId: "alpha",
    });
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
    { consentVersion: "forged" },
    { consentedAt: new Date(0) },
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
        where("programId", "==", "alpha"),
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

test("approval alone does not grant another program or legacy unscoped content", async () => {
  await seed("approved");
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, "programs/beta"), { published: true });
    await setDoc(doc(db, "restrictedContent/beta"), {
      published: true,
      programId: "beta",
    });
    await setDoc(doc(db, "restrictedContent/legacy"), { published: true });
  });
  const db = student();
  await assertFails(getDoc(doc(db, "restrictedContent/beta")));
  await assertFails(getDoc(doc(db, "restrictedContent/legacy")));
  await assertFails(getDoc(doc(db, "programs/beta")));
  await assertFails(
    setDoc(doc(db, "students/student-a/enrollments/beta"), { active: true }),
  );
  await assertFails(
    updateDoc(doc(db, "students/student-a/enrollments/alpha"), {
      active: true,
    }),
  );
  await assertFails(
    getDoc(doc(student("student-b"), "students/student-a/enrollments/alpha")),
  );
});
test("enrollment revocation and unpublishing a program immediately deny new reads", async () => {
  await seed("approved");
  const db = student();
  await assertSucceeds(getDoc(doc(db, "restrictedContent/lesson")));
  await env.withSecurityRulesDisabled(async (c) =>
    updateDoc(doc(c.firestore(), "students/student-a/enrollments/alpha"), {
      active: false,
    }),
  );
  await assertFails(getDoc(doc(db, "restrictedContent/lesson")));
  await env.withSecurityRulesDisabled(async (c) => {
    await updateDoc(
      doc(c.firestore(), "students/student-a/enrollments/alpha"),
      { active: true },
    );
    await updateDoc(doc(c.firestore(), "programs/alpha"), { published: false });
  });
  await assertFails(getDoc(doc(db, "restrictedContent/lesson")));
});
test("consent renewal preserves status and cannot elevate privileges", async () => {
  await seed("approved");
  const db = student();
  await env.withSecurityRulesDisabled(async (c) =>
    updateDoc(doc(c.firestore(), "students/student-a"), {
      consentVersion: "legacy",
    }),
  );
  await assertFails(getDoc(doc(db, "restrictedContent/lesson")));
  await assertSucceeds(
    updateDoc(doc(db, "students/student-a"), {
      consentVersion: "2026-10-26.v1",
      consentedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
  await assertSucceeds(getDoc(doc(db, "restrictedContent/lesson")));
  await assertFails(
    updateDoc(doc(db, "students/student-a"), {
      consentVersion: "2026-10-26.v1",
      consentedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: "suspended",
    }),
  );
});
test("administrator registry, private reasons and audit cannot be read or written by clients", async () => {
  await seed();
  const db = student();
  for (const path of [
    "administrators/student-a",
    "studentAdministration/student-a",
    "admissionAudit/event",
    "system/administratorBootstrap",
    "catalog/private-lesson",
    "settings/public",
    "driveScans/private",
    "driveAssets/private",
  ]) {
    await assertFails(setDoc(doc(db, path), { active: true, role: "admin" }));
    await assertFails(getDoc(doc(db, path)));
  }
});
