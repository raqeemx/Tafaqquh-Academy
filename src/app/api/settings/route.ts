import { getAdminServices } from "@/lib/firebase/admin";
import {
  administrator,
  ApiError,
  failure,
  json,
  readMutation,
} from "@/lib/server/api";
import { FieldValue } from "firebase-admin/firestore";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { db } = getAdminServices();
    const doc = await db.doc("settings/public").get();
    return json({ timeZone: doc.data()?.timeZone ?? "Asia/Baghdad" });
  } catch {
    return json({ timeZone: "Asia/Baghdad" });
  }
}
export async function POST(request: Request) {
  try {
    const { db, token } = await administrator(request, true);
    const raw = await readMutation(request);
    if (
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw) ||
      Object.keys(raw).length !== 1 ||
      !("timeZone" in raw) ||
      typeof raw.timeZone !== "string" ||
      raw.timeZone.length > 80
    )
      throw new ApiError(400, "منطقة زمنية غير صالحة.");
    const zone = raw.timeZone;
    try {
      new Intl.DateTimeFormat("ar", { timeZone: zone });
    } catch {
      throw new ApiError(
        400,
        "استخدم اسم منطقة زمنية معتمدًا مثل Asia/Baghdad.",
      );
    }
    await db.runTransaction(async (tx) => {
      const admin = await tx.get(db.doc(`administrators/${token.uid}`));
      if (admin.data()?.role !== "admin" || admin.data()?.active !== true)
        throw new ApiError(403, "غير مخوّل.");
      tx.set(db.doc("settings/public"), {
        timeZone: zone,
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.create(db.collection("admissionAudit").doc(), {
        action: "settings-update",
        actorUid: token.uid,
        actorEmail: token.email ?? "",
        reason: zone,
        at: FieldValue.serverTimestamp(),
      });
    });
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
