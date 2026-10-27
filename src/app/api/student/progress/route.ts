import { FieldValue } from "firebase-admin/firestore";
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
export async function POST(request: Request) {
  try {
    const { db, token } = await acceptedStudent(request);
    const raw = await readMutation(request);
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new ApiError(400, "طلب غير صالح.");
    const b = raw as Record<string, unknown>;
    if (
      Object.keys(b).some(
        (k) => !["lessonId", "completed", "consent"].includes(k),
      ) ||
      !safeId(b.lessonId) ||
      typeof b.completed !== "boolean"
    )
      throw new ApiError(400, "بيانات غير صالحة.");
    const { program } = await lessonAccess(db, token.uid, b.lessonId);
    const ref = db.doc(`students/${token.uid}/progress/${b.lessonId}`);
    if (!b.completed) {
      await ref.delete();
      return json({ ok: true });
    }
    if (program.data()?.progressEnabled !== true)
      throw new ApiError(403, "متابعة الدروس غير مفعلة.");
    if (b.consent !== true)
      throw new ApiError(400, "يلزم اختيار الموافقة على حفظ التقدم.");
    await ref.set({
      completed: true,
      consentVersion: "2026-10-27.progress.v1",
      consentedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
