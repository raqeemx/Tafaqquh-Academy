import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCloudBuild, validateProduction } from "../../scripts/check-staging.mjs";

const base = {
  APP_ENV: "production",
  NEXT_PUBLIC_APP_ENV: "production",
  VERCEL: "1",
  VERCEL_ENV: "production",
  VERCEL_GIT_COMMIT_REF: "main",
  APP_ORIGIN: "https://tafaqquh-academy.vercel.app",
  FIREBASE_PROJECT_ID: "tafaqquh-academy",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "tafaqquh-academy",
  NEXT_PUBLIC_FIREBASE_AUTH_ENABLED: "false",
  FIREBASE_ADMIN_ENABLED: "false",
  DRIVE_ENABLED: "false",
  DRIVE_MEDIA_ENABLED: "false",
};
const web = {
  NEXT_PUBLIC_FIREBASE_AUTH_ENABLED: "true",
  NEXT_PUBLIC_FIREBASE_API_KEY: "public-test-value",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "tafaqquh-academy.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "tafaqquh-academy.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "1030580627418",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:1030580627418:web:unit-test",
};
test("ordinary local and CI build remain allowed without cloud credentials", () => {
  assert.deepEqual(validateCloudBuild({}), []);
});
test("explicit Vercel production build accepts disabled live services", () => {
  assert.deepEqual(validateCloudBuild(base), []);
});
test("correct public Firebase web configuration passes structural validation", () => {
  assert.deepEqual(validateCloudBuild({ ...base, ...web }), []);
});
for (const [title, change] of [
  ["wrong Firebase project", { FIREBASE_PROJECT_ID: "other-project" }],
  ["wrong origin", { APP_ORIGIN: "https://other.example" }],
  ["preview target", { VERCEL_ENV: "preview" }],
  ["incorrect source branch", { VERCEL_GIT_COMMIT_REF: "untrusted" }],
  ["no project mode", { APP_ENV: "local" }],
  ["mismatched public mode", { NEXT_PUBLIC_APP_ENV: "local" }],
  ["emulator override", { FIREBASE_USE_EMULATORS: "true" }],
  ["unreviewed Google Drive", { DRIVE_ENABLED: "true" }],
  ["App Hosting", { K_SERVICE: "unexpected" }],
  ["wrong Auth domain", { ...web, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "evil.example" }],
  ["wrong app ID", { ...web, NEXT_PUBLIC_FIREBASE_APP_ID: "1:000:web:fake" }],
  ["missing public config", { ...web, NEXT_PUBLIC_FIREBASE_API_KEY: "" }],
  ["unapproved privacy data", { NEXT_PUBLIC_PRIVACY_POLICY_APPROVED: "true" }],
]) {
  test("production rejects " + title, () => {
    assert.notDeepEqual(validateCloudBuild({ ...base, ...change }), []);
  });
}
test("Firebase-enabled production cannot masquerade as local or preview", () => {
  assert.notDeepEqual(
    validateCloudBuild({ ...base, ...web, APP_ENV: "local" }),
    [],
  );
  assert.notDeepEqual(
    validateCloudBuild({ ...base, ...web, VERCEL_ENV: "preview" }),
    [],
  );
});
test("production validator does not alter staging validation behavior", () => {
  assert.deepEqual(validateProduction({ APP_ENV: "staging", NEXT_PUBLIC_APP_ENV: "staging" }), []);
});
