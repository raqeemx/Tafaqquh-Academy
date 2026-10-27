import "server-only";
import { GoogleAuth, OAuth2Client } from "google-auth-library";
import { driveAuthConfig } from "./auth-config";
import { ApiError } from "@/lib/server/api";
let oauth: OAuth2Client | undefined;
const adc = new Map<string, GoogleAuth>();
export async function driveAccessToken(media: boolean) {
  try {
    const config = driveAuthConfig();
    if (config.mode === "oauth") {
      if (!oauth) {
        oauth = new OAuth2Client({
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          transporterOptions: { timeout: 25000, retry: false },
        });
        oauth.setCredentials({ refresh_token: config.refreshToken });
      }
      const token = await oauth.getAccessToken();
      if (!token.token) throw new Error("No token");
      return token.token;
    }
    const scope = `https://www.googleapis.com/auth/drive.${media ? "readonly" : "metadata.readonly"}`;
    if (!adc.has(scope))
      adc.set(
        scope,
        new GoogleAuth({
          scopes: [scope],
          clientOptions: {
            transporterOptions: { timeout: 25000, retry: false },
          },
        }),
      );
    const token = await (await adc.get(scope)!.getClient()).getAccessToken();
    if (!token.token) throw new Error("No token");
    return token.token;
  } catch {
    // Never forward OAuth response bodies, tokens, file identifiers or credential errors.
    throw new ApiError(
      503,
      "اعتماد Drive غير متاح؛ يلزم مراجعة الربط من المشغّل الموثوق.",
    );
  }
}
