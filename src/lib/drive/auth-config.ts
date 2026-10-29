export function driveAuthConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const mode = env.DRIVE_AUTH_MODE ?? "adc";
  if (mode === "adc") return { mode } as const;
  if (mode !== "oauth") throw new Error("Unknown Drive authentication mode");
  const clientId = env.DRIVE_OAUTH_CLIENT_ID;
  const clientSecret = env.DRIVE_OAUTH_CLIENT_SECRET;
  const refreshToken = env.DRIVE_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken)
    throw new Error("Incomplete Drive OAuth configuration");
  return { mode, clientId, clientSecret, refreshToken } as const;
}
