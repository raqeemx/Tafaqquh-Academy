import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { getAdminServices } from "@/lib/firebase/admin";
import { failure, json } from "@/lib/server/api";
export const dynamic = "force-dynamic";
// The cookie is deliberately scoped to this path, not /media-session.
export async function DELETE(request: NextRequest) {
  const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
  if (request.headers.get("origin") !== expected)
    return json({ error: "مصدر غير مسموح." }, 403);
  try {
    const secret = request.cookies.get("academy_media")?.value;
    if (secret && /^[a-f0-9]{64}$/.test(secret)) {
      const { db } = getAdminServices();
      const hash = createHash("sha256").update(secret).digest("hex");
      // A holder may revoke only this opaque capability. No UID or document ID is accepted.
      // Delete first: a failed write must not be reported as a successful logout.
      await db.doc(`mediaSessions/${hash}`).delete();
    }
    const r = json({ ok: true });
    r.cookies.set("academy_media", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/student/recordings",
      maxAge: 0,
    });
    return r;
  } catch (e) {
    return failure(e);
  }
}
