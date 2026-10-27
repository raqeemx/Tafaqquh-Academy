export const SCAN_RETENTION_MS = 7 * 86400000;
export const MEDIA_SESSION_MS = 5 * 60000;
export const USAGE_RETENTION_MS = 86400000;
export function scanExpiresAt(
  data:
    { createdAt?: { toMillis?: () => number }; expiresAt?: number } | undefined,
) {
  const created = data?.createdAt?.toMillis?.();
  if (!Number.isFinite(created)) return 0;
  const fixed = created! + SCAN_RETENTION_MS;
  return Number.isFinite(data?.expiresAt)
    ? Math.min(fixed, data!.expiresAt!)
    : fixed;
}
export function playbackLimits(
  env: Record<string, string | undefined> = process.env,
) {
  function value(key: string, fallback: number, max: number) {
    const n =
      env[key] === undefined || env[key] === "" ? fallback : Number(env[key]);
    if (!Number.isSafeInteger(n) || n < 1 || n > max)
      throw new Error("Invalid playback limit");
    return n;
  }
  return {
    fileBytes: value("DRIVE_MAX_FILE_BYTES", 10 * 1024 ** 3, 100 * 1024 ** 3),
    hourlyBytes: value("PLAYBACK_HOURLY_BYTES", 2 * 1024 ** 3, 20 * 1024 ** 3),
    hourlyRequests: value("PLAYBACK_HOURLY_REQUESTS", 600, 3600),
  };
}
