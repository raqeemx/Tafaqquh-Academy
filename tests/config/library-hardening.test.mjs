import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { checkedMedia } from "../../src/lib/drive/stream.ts";
import {
  playbackLimits,
  scanExpiresAt,
  SCAN_RETENTION_MS,
} from "../../src/lib/drive/policy.ts";
import { driveAuthConfig } from "../../src/lib/drive/auth-config.ts";
import { recordingRange } from "../../src/lib/drive/range.ts";
test("retention is fixed from creation and old or malformed scans fail closed", () => {
  const createdAt = { toMillis: () => 1000 };
  assert.equal(scanExpiresAt({ createdAt }), 1000 + SCAN_RETENTION_MS);
  assert.equal(
    scanExpiresAt({ createdAt, expiresAt: 999999999999 }),
    1000 + SCAN_RETENTION_MS,
  );
  assert.equal(scanExpiresAt(undefined), 0);
  assert.throws(() => playbackLimits({ PLAYBACK_HOURLY_REQUESTS: "0" }));
  assert.throws(() => playbackLimits({ DRIVE_MAX_FILE_BYTES: "Infinity" }));
});
test("large file ranges remain bounded, unsafe integers fail", () => {
  const size = 10 * 1024 ** 3;
  assert.equal(recordingRange("bytes=9000000000-", size).start, 9000000000);
  assert.equal(recordingRange(null, size).end, 8388607);
  assert.throws(() => recordingRange("bytes=-999999999999999999999", size));
});
test("provider ranges reject ignored, malformed, overflowing and truncated bodies", async () => {
  for (const response of [
    new Response("abcd"),
    new Response("abcd", {
      status: 206,
      headers: { "Content-Range": "bytes 4-7/8" },
    }),
  ])
    await assert.rejects(checkedMedia(response, 0, 3, 8));
  for (const body of ["abc", "abcde"]) {
    const stream = await checkedMedia(
      new Response(body, {
        status: 206,
        headers: { "Content-Range": "bytes 0-3/8" },
      }),
      0,
      3,
      8,
    );
    await assert.rejects(new Response(stream).arrayBuffer());
  }
  const stream = await checkedMedia(
    new Response("abcd", {
      status: 206,
      headers: { "Content-Range": "bytes 0-3/8" },
    }),
    0,
    3,
    8,
  );
  assert.equal(await new Response(stream).text(), "abcd");
});
test("OAuth preparation is offline by default and cannot silently fall back to ADC", () => {
  assert.equal(driveAuthConfig({}).mode, "adc");
  assert.throws(() => driveAuthConfig({ DRIVE_AUTH_MODE: "oauth" }));
  assert.throws(() => driveAuthConfig({ DRIVE_AUTH_MODE: "unknown" }));
  assert.equal(
    driveAuthConfig({
      DRIVE_AUTH_MODE: "oauth",
      DRIVE_OAUTH_CLIENT_ID: "fixture",
      DRIVE_OAUTH_CLIENT_SECRET: "fixture",
      DRIVE_OAUTH_REFRESH_TOKEN: "fixture",
    }).mode,
    "oauth",
  );
  const env = { ...process.env, DRIVE_OAUTH_SETUP_AUTHORIZED: "false" };
  assert.match(
    execFileSync(process.execPath, ["scripts/prepare-drive-oauth.mjs"], {
      env,
      encoding: "utf8",
    }),
    /No Google connection/,
  );
  const r = spawnSync(
    process.execPath,
    ["scripts/prepare-drive-oauth.mjs", "--connect"],
    { env, encoding: "utf8", timeout: 5000 },
  );
  assert.equal(r.status, 1);
  assert.match(r.stderr, /authorization is required/);
});
