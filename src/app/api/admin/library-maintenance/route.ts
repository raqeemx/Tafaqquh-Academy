import { Timestamp, FieldValue } from "firebase-admin/firestore";
import {
  administrator,
  ApiError,
  failure,
  json,
  readMutation,
} from "@/lib/server/api";
import { SCAN_RETENTION_MS } from "@/lib/drive/policy";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const { db, token } = await administrator(request, true);
    const b = await readMutation(request);
    if (
      !b ||
      typeof b !== "object" ||
      Object.keys(b).length !== 1 ||
      !("action" in b) ||
      b.action !== "cleanup"
    )
      throw new ApiError(400, "طلب تنظيف غير صالح.");
    const now = Date.now();
    const result = await db.runTransaction(async (tx) => {
      const admin = await tx.get(db.doc(`administrators/${token.uid}`));
      if (admin.data()?.active !== true || admin.data()?.role !== "admin")
        throw new ApiError(403, "غير مخوّل.");
      const sessions = await tx.get(
        db.collection("mediaSessions").where("expiresAt", "<=", now).limit(100),
      );
      const usage = await tx.get(
        db.collection("playbackUsage").where("expiresAt", "<=", now).limit(100),
      );
      // Deleting a Firestore parent does not delete its subcollection. Drain it first.
      const scans = await tx.get(
        db
          .collection("driveScans")
          .where(
            "createdAt",
            "<=",
            Timestamp.fromMillis(now - SCAN_RETENTION_MS),
          )
          .limit(1),
      );
      const scan = scans.docs[0];
      const candidates = scan
        ? await tx.get(scan.ref.collection("candidates").limit(201))
        : null;
      for (const d of [
        ...sessions.docs,
        ...usage.docs,
        ...(candidates?.docs.slice(0, 200) ?? []),
      ])
        tx.delete(d.ref);
      if (scan && candidates!.size <= 200) tx.delete(scan.ref);
      const counts = {
        sessions: sessions.size,
        usage: usage.size,
        candidates: Math.min(candidates?.size ?? 0, 200),
        scans: scan && candidates!.size <= 200 ? 1 : 0,
      };
      if (Object.values(counts).some(Boolean))
        tx.create(db.collection("admissionAudit").doc(), {
          action: "library-cleanup",
          actorUid: token.uid,
          actorEmail: token.email ?? "",
          counts,
          at: FieldValue.serverTimestamp(),
        });
      return {
        ...counts,
        mayHaveMore: sessions.size === 100 || usage.size === 100 || !!scan,
      };
    });
    return json(result);
  } catch (e) {
    return failure(e);
  }
}
