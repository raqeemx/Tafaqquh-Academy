import { createHash, randomBytes } from "node:crypto";
import { acceptedStudent } from "@/lib/server/student";
import {
  ApiError,
  failure,
  json,
  readMutation,
  safeId,
} from "@/lib/server/api";
import { lessonAccess } from "@/lib/server/library";
export const dynamic = "force-dynamic";
const options = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/student/recordings",
  maxAge: 300,
};
export async function POST(request: Request) {
  try {
    const { db, token } = await acceptedStudent(request);
    const b = await readMutation(request);
    if (
      !b ||
      typeof b !== "object" ||
      !("lessonId" in b) ||
      !safeId(b.lessonId)
    )
      throw new ApiError(400, "اختر درسًا.");
    const { lesson } = await lessonAccess(db, token.uid, b.lessonId);
    if (!safeId(lesson.data()?.assetId))
      throw new ApiError(404, "لم يُربط تسجيل بهذا الدرس.");
    const secret = randomBytes(32).toString("hex");
    const hash = createHash("sha256").update(secret).digest("hex");
    await db
      .doc(`mediaSessions/${hash}`)
      .set({
        uid: token.uid,
        lessonId: b.lessonId,
        authTime: token.auth_time,
        expiresAt: Date.now() + 300000,
      });
    const r = json({ url: `/api/student/recordings/${b.lessonId}` });
    r.cookies.set("academy_media", secret, options);
    return r;
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: Request) {
  const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
  if (request.headers.get("origin") !== expected)
    return json({ error: "مصدر غير مسموح." }, 403);
  const r = json({ ok: true });
  r.cookies.set("academy_media", "", { ...options, maxAge: 0 });
  return r;
}
