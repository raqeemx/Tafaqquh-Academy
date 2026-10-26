import { FieldPath, type Query } from "firebase-admin/firestore";
import {
  administrator,
  ApiError,
  failure,
  json,
  safeId,
} from "@/lib/server/api";
import { studentRow } from "@/lib/server/serialize";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { db } = await administrator(request);
    const params = new URL(request.url).searchParams;
    const status = params.get("status") || "pending";
    if (
      !["all", "pending", "approved", "rejected", "suspended"].includes(status)
    )
      throw new ApiError(400, "حالة غير صالحة.");
    const search = (params.get("q") || "").trim();
    if (search.length > 100) throw new ApiError(400, "نص البحث طويل جدًا.");
    const field = params.get("field") === "email" ? "email" : "displayName";
    const sort = params.get("sort") === "oldest" ? "asc" : "desc";
    let query: Query = db.collection("students");
    if (status !== "all") query = query.where("status", "==", status);
    query = search
      ? query
          .where(field, ">=", search)
          .where(field, "<=", search + "\uf8ff")
          .orderBy(field)
          .orderBy(FieldPath.documentId())
      : query.orderBy("createdAt", sort).orderBy(FieldPath.documentId(), sort);
    const after = params.get("after");
    if (after) {
      if (!safeId(after)) throw new ApiError(400, "مؤشر الصفحة غير صالح.");
      const cursor = await db.doc(`students/${after}`).get();
      if (!cursor.exists)
        throw new ApiError(409, "تغيّرت القائمة. حدّث النتائج.");
      query = query.startAfter(cursor);
    }
    const result = await query.limit(26).get();
    const docs = result.docs.slice(0, 25);
    return json({
      students: docs.map(studentRow),
      next: result.size > 25 ? docs.at(-1)!.id : null,
    });
  } catch (error) {
    return failure(error);
  }
}
