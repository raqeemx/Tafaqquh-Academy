import { createServer } from "node:http";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { writeFile, realpath } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { OAuth2Client } from "google-auth-library";

// This setup helper is separate from the public application. No connection by default.
const args = process.argv.slice(2);
if (!args.includes("--connect")) {
  console.log(
    "Offline preparation only. Owner authorization, OAuth Web client and an external credential output path are required. No Google connection made.",
  );
} else if (process.env.DRIVE_OAUTH_SETUP_AUTHORIZED !== "true") {
  console.error("Explicit owner authorization is required before connecting.");
  process.exitCode = 1;
} else {
  try {
    const clientId = process.env.DRIVE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.DRIVE_OAUTH_CLIENT_SECRET;
    const output = process.env.DRIVE_OAUTH_OUTPUT_FILE;
    if (
      !clientId ||
      !clientSecret ||
      !output ||
      !isAbsolute(output) ||
      !output.endsWith(".credentials.json")
    )
      throw new Error("config");
    const repo = await realpath(
      resolve(dirname(fileURLToPath(import.meta.url)), ".."),
    );
    const parent = await realpath(dirname(output));
    const rel = relative(repo, parent);
    if (
      !rel ||
      (!(rel === ".." || rel.startsWith(`..${sep}`)) && !isAbsolute(rel))
    )
      throw new Error("output must be outside repository");
    const redirect = "http://127.0.0.1:8787/oauth/callback";
    const scope = `https://www.googleapis.com/auth/drive.${args.includes("--read-recordings") ? "readonly" : "metadata.readonly"}`;
    const client = new OAuth2Client({
      clientId,
      clientSecret,
      redirectUri: redirect,
      transporterOptions: { timeout: 25000, retry: false },
    });
    const state = randomBytes(32).toString("hex");
    const verifier = randomBytes(48).toString("base64url");
    let consumed = false;
    const server = createServer(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Referrer-Policy", "no-referrer");
      const u = new URL(req.url ?? "/", redirect);
      const incoming = u.searchParams.get("state") ?? "";
      if (
        req.method !== "GET" ||
        req.headers.host !== "127.0.0.1:8787" ||
        u.pathname !== "/oauth/callback" ||
        !/^[a-f0-9]{64}$/.test(incoming) ||
        !timingSafeEqual(Buffer.from(incoming), Buffer.from(state)) ||
        consumed
      ) {
        res.writeHead(400).end("طلب ربط غير صالح.");
        return;
      }
      consumed = true;
      try {
        const code = u.searchParams.get("code");
        if (u.searchParams.has("error") || !code || code.length > 4096)
          throw new Error("denied");
        const { tokens } = await client.getToken({
          code,
          codeVerifier: verifier,
        });
        const scopes = tokens.scope?.split(" ") ?? [];
        const allowed = [
          "https://www.googleapis.com/auth/drive.readonly",
          "https://www.googleapis.com/auth/drive.metadata.readonly",
        ];
        if (
          !tokens.refresh_token ||
          !scopes.includes(scope) ||
          scopes.some((s) => !allowed.includes(s))
        )
          throw new Error("scope");
        await writeFile(
          output,
          JSON.stringify(
            {
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: tokens.refresh_token,
              scopes,
            },
            null,
            2,
          ),
          { flag: "wx", mode: 0o600 },
        );
        res.end(
          "اكتمل التفويض. أُودع الاعتماد في الملف الخاص؛ يمكنك إغلاق النافذة.",
        );
        console.log(
          "Credential file created outside the repository. No token or authorization code logged. Application Drive access remains disabled until configured separately.",
        );
      } catch {
        res
          .writeHead(400)
          .end("تعذّر إكمال الربط. راجع الإعدادات والموافقة، ثم أعد المحاولة.");
        console.error("OAuth setup failed. No credential details logged.");
        process.exitCode = 1;
      } finally {
        clearTimeout(timer);
        server.close();
      }
    });
    const timer = setTimeout(() => {
      server.close();
      console.error("OAuth setup timed out.");
      process.exitCode = 1;
    }, 600000);
    server.on("error", () => {
      clearTimeout(timer);
      console.error("Cannot open the local callback port.");
      process.exitCode = 1;
    });
    server.listen(8787, "127.0.0.1", () => {
      console.log(
        "Open this consent URL yourself. Only the callback listens on loopback:",
      );
      console.log(
        client.generateAuthUrl({
          access_type: "offline",
          prompt: "consent",
          scope: [scope],
          state,
          code_challenge: createHash("sha256")
            .update(verifier)
            .digest("base64url"),
          code_challenge_method: "S256",
        }),
      );
    });
  } catch {
    console.error(
      "Missing OAuth setup configuration or unsafe output location. No connection made.",
    );
    process.exitCode = 1;
  }
}
