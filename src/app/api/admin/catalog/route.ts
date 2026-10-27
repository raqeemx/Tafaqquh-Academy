import { FieldValue, FieldPath } from "firebase-admin/firestore";
import {
  administrator,
  ApiError,
  failure,
  json,
  readMutation,
  safeId,
} from "@/lib/server/api";
import { catalogRow, parseEntry, validateParent } from "@/lib/server/catalog";
import { collectionFor, kinds, type Kind } from "@/lib/catalog/model";
import { version } from "@/lib/server/serialize";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { db } = await administrator(request);
    const params = new URL(request.url).searchParams;
    const kind = params.get("kind") as Kind;
    if (!kinds.includes(kind)) throw new ApiError(400, "نوع غير صالح.");
    let query = db
      .collection(collectionFor(kind))
      .orderBy(FieldPath.documentId())
      .limit(101);
    const after = params.get("after");
    if (after) {
      if (!safeId(after)) throw new ApiError(400, "مؤشر غير صالح.");
      query = query.startAfter(after);
    }
    const result = await query.get();
    const docs = result.docs.slice(0, 100);
    return json({
      entries: docs.map((d) =>
        catalogRow(d, kind === "program" ? "program" : undefined),
      ),
      next: result.size > 100 ? docs.at(-1)!.id : null,
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const { db, token } = await administrator(request, true);
    const entry = parseEntry(await readMutation(request));
    const ref = db.doc(`${collectionFor(entry.kind)}/${entry.id}`);
    await db.runTransaction(async (tx) => {
      const [admin, current] = await tx.getAll(
        db.doc(`administrators/${token.uid}`),
        ref,
      );
      if (admin.data()?.role !== "admin" || admin.data()?.active !== true)
        throw new ApiError(403, "انتهت صلاحية الإدارة.");
      if (version(current) !== entry.version)
        throw new ApiError(409, "تغيّرت البيانات؛ حدّث القائمة وأعد المراجعة.");
      if (
        current.exists &&
        ((current.data()?.kind ?? "program") !== entry.kind ||
          (current.data()?.programId ?? "") !== entry.programId)
      )
        throw new ApiError(
          409,
          "لا يمكن تغيير نوع السجل أو برنامجه بعد إنشائه.",
        );
      await validateParent(tx, db, entry);
      const { id, version: unused, ...data } = entry;
      void unused;
      tx.set(
        ref,
        {
          ...data,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: token.uid,
          ...(!current.exists
            ? { createdAt: FieldValue.serverTimestamp() }
            : {}),
        },
        { merge: true },
      );
      tx.create(db.collection("admissionAudit").doc(), {
        action: current.exists ? "catalog-update" : "catalog-create",
        actorUid: token.uid,
        actorEmail: token.email ?? "",
        studentUid: "",
        programId: entry.kind === "program" ? id : entry.programId,
        from: current.data()?.published ? "published" : "draft",
        to: entry.published ? "published" : "draft",
        reason: `${entry.kind}: ${entry.title}`,
        targetId: id,
        at: FieldValue.serverTimestamp(),
      });
    });
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
