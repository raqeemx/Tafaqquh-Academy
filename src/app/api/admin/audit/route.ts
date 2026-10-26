import {
  administrator,
  failure,
  json,
  ApiError,
  safeId,
} from "@/lib/server/api";
import { iso } from "@/lib/server/serialize";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { db } = await administrator(request);
    let query = db.collection("admissionAudit").orderBy("at", "desc").limit(51);
    const after = new URL(request.url).searchParams.get("after");
    if (after) {
      if (!safeId(after)) throw new ApiError(400, "مؤشر غير صالح.");
      const cursor = await db.doc(`admissionAudit/${after}`).get();
      if (!cursor.exists) throw new ApiError(409, "حدّث السجل.");
      query = query.startAfter(cursor);
    }
    const result = await query.get();
    const docs = result.docs.slice(0, 50);
    return json({
      entries: docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          studentUid: d.studentUid ?? "",
          actorUid: d.actorUid ?? "",
          actorEmail: d.actorEmail ?? "مشغّل موثوق سابق",
          action: d.action ?? d.status ?? "",
          from: d.from ?? "",
          to: d.to ?? d.status ?? "",
          reason: d.reason ?? "",
          programId: d.programId ?? null,
          at: iso(d.at),
        };
      }),
      next: result.size > 50 ? docs.at(-1)!.id : null,
    });
  } catch (error) {
    return failure(error);
  }
}
