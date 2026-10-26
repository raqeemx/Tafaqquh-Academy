import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateStaging,
  verifyStagingWebApp,
} from "../../scripts/check-staging.mjs";
const config = {
  APP_ENV: "staging",
  NEXT_PUBLIC_APP_ENV: "staging",
  APP_ORIGIN: "https://test.example",
  FIREBASE_PROJECT_ID: "academy-stage-test",
  FIREBASE_STAGING_PROJECT_ID: "academy-stage-test",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "academy-stage-test",
  NEXT_PUBLIC_FIREBASE_STAGING_PROJECT_ID: "academy-stage-test",
  NEXT_PUBLIC_FIREBASE_API_KEY: "unit-test-only",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "academy-stage-test.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "academy-stage-test.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456:web:test",
};
test("valid isolated staging configuration passes offline checks", () =>
  assert.deepEqual(validateStaging(config), []));
for (const changes of [
  { FIREBASE_PROJECT_ID: "tafaqquh-academy" },
  { NEXT_PUBLIC_FIREBASE_PROJECT_ID: "tafaqquh-academy" },
  { FIREBASE_STAGING_PROJECT_ID: "tafaqquh-academy" },
  { NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "1030580627418" },
  { NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "tafaqquh-academy.firebaseapp.com" },
  { NEXT_PUBLIC_FIREBASE_API_KEY: "" },
  { NEXT_PUBLIC_APP_ENV: "production" },
  { NEXT_PUBLIC_FIREBASE_USE_EMULATORS: "true" },
  { FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" },
  { GOOGLE_APPLICATION_CREDENTIALS: "key.json" },
  { GOOGLE_CLOUD_PROJECT: "tafaqquh-academy" },
  { APP_ORIGIN: "http://localhost:3000" },
  { NEXT_PUBLIC_PRIVACY_POLICY_APPROVED: "true" },
]) {
  test(`staging rejects unsafe ${Object.keys(changes)[0]}`, () =>
    assert.ok(validateStaging({ ...config, ...changes }).length));
}
test("web config verification rejects a production or mismatched API key", async () => {
  await assert.rejects(
    verifyStagingWebApp(config, async () => ({
      ok: true,
      json: async () => ({
        projectId: "1030580627418",
        authorizedDomains: ["tafaqquh-academy.firebaseapp.com"],
      }),
    })),
  );
});
test("web config verification confirms matching project number and domain without writes", async () => {
  await verifyStagingWebApp(config, async (url, options) => {
    assert.match(
      url,
      /^https:\/\/identitytoolkit.googleapis.com\/v1\/projects\?key=/,
    );
    assert.equal(options.method, undefined);
    return {
      ok: true,
      json: async () => ({
        projectId: "123456",
        authorizedDomains: [config.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN],
      }),
    };
  });
});
test("ordinary local build needs no staging configuration", () =>
  assert.deepEqual(validateStaging({}), []));
