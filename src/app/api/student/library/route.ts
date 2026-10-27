import { FieldPath } from "firebase-admin/firestore";
import { acceptedStudent } from "@/lib/server/student";
import { ApiError, failure, json, safeId } from "@/lib/server/api";
import { programAccess, visibleEntry } from "@/lib/server/library";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { db, token } = await acceptedStudent(request);
    const params = new URL(request.url).searchParams;
    const id = params.get("programId");
    if (!safeId(id)) throw new ApiError(400, "اختر برنامجًا.");
    const program = await programAccess(db, token.uid, id);
    let q = db
      .collection("catalog")
      .where("programId", "==", id)
      .orderBy(FieldPath.documentId())
      .limit(101);
    const after = params.get("after");
    if (after) {
      if (!safeId(after)) throw new ApiError(400, "مؤشر غير صالح.");
      q = q.startAfter(after);
    }
    const result = await q.get();
    const docs = result.docs.slice(0, 100);
    const cache = new Map(docs.map((d) => [d.id, d]));
    const entries = [];
    for (const doc of docs) {
      if (!(await visibleEntry(db, doc, id, cache))) continue;
      const d = doc.data();
      let completed = false;
      if (d.kind === "lesson" && program.data()?.progressEnabled === true) {
        const p = await db
          .doc(`students/${token.uid}/progress/${doc.id}`)
          .get();
        completed = p.data()?.completed === true;
      }
      entries.push({
        id: doc.id,
        kind: d.kind,
        title: d.title,
        description: d.description ?? "",
        parentId: d.parentId ?? "",
        order: d.order ?? 0,
        lessonDate: d.lessonDate ?? "",
        hasRecording: !!d.assetId,
        completed,
      });
    }
    return json({
      entries,
      progressEnabled: program.data()?.progressEnabled === true,
      next: result.size > 100 ? docs.at(-1)!.id : null,
    });
  } catch (e) {
    return failure(e);
  }
}
