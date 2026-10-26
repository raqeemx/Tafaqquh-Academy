import { defineConfig } from "@playwright/test";
if (process.env.STAGING_APPROVED !== "true")
  throw new Error(
    "Staging smoke tests require explicit STAGING_APPROVED=true after deployment approval.",
  );
const url = process.env.STAGING_URL;
if (!url || new URL(url).protocol !== "https:")
  throw new Error("Set the actual approved HTTPS STAGING_URL.");
export default defineConfig({
  testDir: "./tests/staging",
  use: { baseURL: url },
  workers: 1,
  retries: 0,
});
