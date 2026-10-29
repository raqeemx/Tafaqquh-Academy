import { pathToFileURL } from "node:url";
const productionProject = "tafaqquh-academy";
const productionNumber = "1030580627418";
const publicKeys = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];
export function validateStaging(env) {
  if (env.APP_ENV !== "staging" && env.NEXT_PUBLIC_APP_ENV !== "staging")
    return [];
  const errors = [];
  if (env.APP_ENV !== "staging" || env.NEXT_PUBLIC_APP_ENV !== "staging")
    errors.push("Both APP_ENV and NEXT_PUBLIC_APP_ENV must be staging.");
  const project = env.FIREBASE_STAGING_PROJECT_ID;
  if (
    !project ||
    !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project) ||
    project === productionProject ||
    project.startsWith("demo-")
  )
    errors.push(
      "Use a separately created staging project, never production or an emulator ID.",
    );
  for (const key of [
    "FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STAGING_PROJECT_ID",
  ])
    if (!env[key] || env[key] !== project)
      errors.push(`${key} must match FIREBASE_STAGING_PROJECT_ID.`);
  if (env.GOOGLE_CLOUD_PROJECT && env.GOOGLE_CLOUD_PROJECT !== project)
    errors.push("The hosting identity must belong to the staging project.");
  for (const key of publicKeys)
    if (!env[key]?.trim()) errors.push(`Missing build-time ${key}.`);
  if (env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN !== `${project}.firebaseapp.com`)
    errors.push("Use the staging web app default authDomain.");
  if (
    ![`${project}.firebasestorage.app`, `${project}.appspot.com`].includes(
      env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    )
  )
    errors.push(
      "Use the staging web app bucket identifier; Storage need not be enabled.",
    );
  const number = env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  if (
    !/^\d+$/.test(number ?? "") ||
    number === productionNumber ||
    !env.NEXT_PUBLIC_FIREBASE_APP_ID?.startsWith(`1:${number}:web:`)
  )
    errors.push("App ID and sender ID must belong to staging, not production.");
  if (
    ["NEXT_PUBLIC_FIREBASE_USE_EMULATORS", "FIREBASE_USE_EMULATORS"].some(
      (key) => env[key] === "true",
    ) ||
    env.FIREBASE_AUTH_EMULATOR_HOST ||
    env.FIRESTORE_EMULATOR_HOST
  )
    errors.push("Remove every emulator override from staging.");
  if (env.GOOGLE_APPLICATION_CREDENTIALS)
    errors.push(
      "Use the managed App Hosting service identity, not a service-account file.",
    );
  try {
    const origin = new URL(env.APP_ORIGIN);
    if (
      origin.protocol !== "https:" ||
      origin.origin !== env.APP_ORIGIN ||
      origin.username ||
      origin.password
    )
      throw new Error();
  } catch {
    errors.push(
      "APP_ORIGIN must be the exact HTTPS staging origin without a path or trailing slash.",
    );
  }
  if (
    env.NEXT_PUBLIC_PRIVACY_POLICY_APPROVED === "true" &&
    [
      "NEXT_PUBLIC_PRIVACY_CONTROLLER",
      "NEXT_PUBLIC_PRIVACY_CONTACT",
      "NEXT_PUBLIC_PRIVACY_RETENTION",
    ].some((key) => !env[key]?.trim())
  )
    errors.push(
      "Approved privacy text requires controller, contact and retention values.",
    );
  return errors;
}
// Production may be built only for the explicitly approved Vercel project.
// This does not activate real auth, authorize Firebase Rules deployment, or
// provision server credentials; each requires its own owner-controlled step.
export function validateProduction(env) {
  if (env.APP_ENV !== "production" && env.NEXT_PUBLIC_APP_ENV !== "production")
    return [];
  const errors = [];
  if (env.APP_ENV !== "production" || env.NEXT_PUBLIC_APP_ENV !== "production")
    errors.push("Both APP_ENV and NEXT_PUBLIC_APP_ENV must be production.");
  if (env.VERCEL !== "1" || env.VERCEL_ENV !== "production")
    errors.push("Production builds are allowed only in Vercel's production target.");
  if (env.VERCEL_GIT_COMMIT_REF && env.VERCEL_GIT_COMMIT_REF !== "main")
    errors.push("Production builds must originate from main.");
  for (const key of ["FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_PROJECT_ID"])
    if (env[key] !== productionProject)
      errors.push(key + " must match the reviewed production Firebase project.");
  if (env.GOOGLE_CLOUD_PROJECT && env.GOOGLE_CLOUD_PROJECT !== productionProject)
    errors.push("The Google Cloud project must match production.");
  if (env.APP_ORIGIN !== "https://tafaqquh-academy.vercel.app")
    errors.push("APP_ORIGIN must match the reviewed production site origin.");
  if (
    env.FIREBASE_USE_EMULATORS === "true" ||
    env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true" ||
    env.FIREBASE_AUTH_EMULATOR_HOST ||
    env.FIRESTORE_EMULATOR_HOST
  )
    errors.push("Production must never use Firebase emulators.");
  if (env.GOOGLE_APPLICATION_CREDENTIALS)
    errors.push("Do not deploy a service-account key file on Vercel.");
  if (env.DRIVE_ENABLED === "true" || env.DRIVE_MEDIA_ENABLED === "true")
    errors.push("Live Google Drive remains disabled pending separate approval.");
  if (
    env.FIREBASE_ADMIN_ENABLED === "true" &&
    env.NEXT_PUBLIC_FIREBASE_AUTH_ENABLED !== "true"
  )
    errors.push("Admin APIs require the reviewed web Auth configuration.");

  // The Firebase web config is public, but every value must match this app.
  if (env.NEXT_PUBLIC_FIREBASE_AUTH_ENABLED === "true") {
    for (const key of publicKeys)
      if (!env[key]?.trim()) errors.push("Missing " + key + " at build time.");
    if (env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN !== productionProject + ".firebaseapp.com")
      errors.push("Unexpected Firebase Auth domain.");
    if (
      ![
        productionProject + ".firebasestorage.app",
        productionProject + ".appspot.com",
      ].includes(env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)
    )
      errors.push("Unexpected Firebase Storage bucket identifier.");
    if (
      env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID !== productionNumber ||
      !env.NEXT_PUBLIC_FIREBASE_APP_ID?.startsWith(
        "1:" + productionNumber + ":web:",
      )
    )
      errors.push("The Firebase web app must belong to this project.");
  }
  if (
    env.NEXT_PUBLIC_PRIVACY_POLICY_APPROVED === "true" &&
    [
      "NEXT_PUBLIC_PRIVACY_CONTROLLER",
      "NEXT_PUBLIC_PRIVACY_CONTACT",
      "NEXT_PUBLIC_PRIVACY_RETENTION",
    ].some((key) => !env[key]?.trim())
  )
    errors.push("Do not approve an incomplete privacy policy.");
  return errors;
}

export function validateCloudBuild(env) {
  const errors = [...validateStaging(env), ...validateProduction(env)];
  if (
    env.K_SERVICE ||
    env.FIREBASE_APP_HOSTING === "true" ||
    env.APP_ENV === "staging" ||
    env.NEXT_PUBLIC_APP_ENV === "staging" ||
    (env.APP_ENV && !["local", "production"].includes(env.APP_ENV)) ||
    (env.NEXT_PUBLIC_APP_ENV &&
      !["local", "production"].includes(env.NEXT_PUBLIC_APP_ENV))
  )
    errors.push("App Hosting/Staging and unreviewed cloud builds remain blocked.");
  if (
    env.VERCEL === "1" &&
    env.VERCEL_ENV === "production" &&
    (env.NEXT_PUBLIC_FIREBASE_AUTH_ENABLED === "true" ||
      env.FIREBASE_ADMIN_ENABLED === "true") &&
    (env.APP_ENV !== "production" || env.NEXT_PUBLIC_APP_ENV !== "production")
  )
    errors.push("Live Firebase requires the explicit production environment.");
  if (
    env.VERCEL === "1" &&
    env.VERCEL_ENV === "preview" &&
    (env.NEXT_PUBLIC_FIREBASE_AUTH_ENABLED === "true" ||
      env.FIREBASE_ADMIN_ENABLED === "true")
  )
    errors.push("Do not connect Git previews to the live Firebase project.");
  return errors;
}

export async function verifyStagingWebApp(env, fetcher = fetch) {
  const response = await fetcher(
    `https://identitytoolkit.googleapis.com/v1/projects?key=${encodeURIComponent(env.NEXT_PUBLIC_FIREBASE_API_KEY)}`,
    { signal: AbortSignal.timeout(15000) },
  );
  if (!response.ok)
    throw new Error(
      "Could not verify staging web app configuration (read-only check).",
    );
  const config = await response.json();
  if (
    String(config.projectId) !== env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    String(config.projectId) === productionNumber ||
    !config.authorizedDomains?.includes(env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN)
  )
    throw new Error(
      "The API key does not match the staging project number and authDomain.",
    );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const errors = validateCloudBuild(process.env);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else if (process.env.APP_ENV === "staging") {
    try {
      await verifyStagingWebApp(process.env);
      console.log(
        "Staging isolation and public web configuration verified. No resources created.",
      );
    } catch (error) {
      console.error(
        error instanceof Error ? error.message : "Staging verification failed.",
      );
      process.exitCode = 1;
    }
  }
}
