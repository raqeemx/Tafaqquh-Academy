import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import {
  administrator,
  ApiError,
  failure,
  json,
  readMutation,
  safeId,
} from "@/lib/server/api";
import { studentRow, version } from "@/lib/server/serialize";
import { PRIVACY_VERSION } from "@/lib/privacy/policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ uid: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const { db, auth } = await administrator(request);
    const { uid } = await context.params;
    if (!safeId(uid)) throw new ApiError(400, "معرّف غير صالح.");
    const [profile, enrollments, administration] = await Promise.all([
      db.doc(`students/${uid}`).get(),
      db.collection(`students/${uid}/enrollments`).get(),
      db.doc(`studentAdministration/${uid}`).get(),
    ]);
    if (!profile.exists) throw new ApiError(404, "الطلب غير موجود.");
    let emailVerified = false;
    let disabled = true;
    try {
      const account = await auth.getUser(uid);
      emailVerified = account.emailVerified;
      disabled = account.disabled;
    } catch (error) {
      if ((error as { code?: string }).code !== "auth/user-not-found")
        throw error;
    }
    return json({
      student: studentRow(profile),
      emailVerified,
      disabled,
      administrativeReason: administration.data()?.reason ?? "",
      enrollments: enrollments.docs
        .filter((doc) => doc.data().active === true)
        .map((doc) => doc.id),
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    const { db, auth, token } = await administrator(request, true);
    const { uid } = await context.params;
    if (!safeId(uid)) throw new ApiError(400, "معرّف غير صالح.");
    const raw = await readMutation(request);
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new ApiError(400, "طلب غير صالح.");
    const body = raw as Record<string, unknown>;
    if (
      Object.keys(body).some(
        (key) =>
          ![
            "action",
            "reason",
            "programId",
            "expectedVersion",
            "requestId",
          ].includes(key),
      )
    )
      throw new ApiError(400, "حقول غير مسموحة.");
    const { action, expectedVersion, requestId } = body;
    if (
      typeof action !== "string" ||
      !["approve", "reject", "suspend", "enroll", "unenroll"].includes(
        action,
      ) ||
      typeof expectedVersion !== "string" ||
      !/^\d+:\d+$/.test(expectedVersion) ||
      !safeId(requestId) ||
      requestId.length < 16
    )
      throw new ApiError(400, "بيانات القرار غير صالحة.");
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (
      (body.reason !== undefined && typeof body.reason !== "string") ||
      reason.length > 1000
    )
      throw new ApiError(400, "السبب الإداري غير صالح.");
    const programId = body.programId || null;
    if (
      (programId !== null && !safeId(programId)) ||
      (["enroll", "unenroll"].includes(action) && !programId) ||
      (["reject", "suspend"].includes(action) && programId)
    )
      throw new ApiError(400, "اختر برنامجًا صالحًا لهذا الإجراء.");
    if (action === "approve" || action === "enroll") {
      const account = await auth.getUser(uid);
      if (!account.emailVerified || account.disabled)
        throw new ApiError(
          409,
          "يلزم حساب فعّال وبريد موثّق قبل القبول أو إتاحة برنامج.",
        );
    }
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({ uid, action, reason, programId, expectedVersion }),
      )
      .digest("hex");
    const result = await db.runTransaction(async (tx) => {
      const adminRef = db.doc(`administrators/${token.uid}`);
      const studentRef = db.doc(`students/${uid}`);
      const auditRef = db.doc(`admissionAudit/${requestId}`);
      const [admin, student, audit] = await tx.getAll(
        adminRef,
        studentRef,
        auditRef,
      );
      if (admin.data()?.active !== true || admin.data()?.role !== "admin")
        throw new ApiError(403, "لم تعد لديك صلاحية الإدارة.");
      if (audit.exists) {
        if (
          audit.data()?.actorUid !== token.uid ||
          audit.data()?.fingerprint !== fingerprint
        )
          throw new ApiError(409, "معرّف عملية مستخدم مسبقًا.");
        return { replayed: true };
      }
      if (!student.exists) throw new ApiError(404, "الطلب غير موجود.");
      if (version(student) !== expectedVersion)
        throw new ApiError(
          409,
          "تغيّر الطلب منذ فتحه. حدّث البيانات قبل اتخاذ القرار.",
        );
      const from = String(student.data()!.status);
      const transitions: Record<string, string[]> = {
        approve: ["pending", "suspended", "rejected"],
        reject: ["pending"],
        suspend: ["approved"],
        enroll: ["approved"],
        unenroll: ["approved", "suspended"],
      };
      if (!transitions[action].includes(from))
        throw new ApiError(409, "هذا الإجراء غير مناسب لحالة الطلب الحالية.");
      if (
        ["approve", "enroll"].includes(action) &&
        student.data()?.consentVersion !== PRIVACY_VERSION
      )
        throw new ApiError(
          409,
          "يجب أن يؤكد الطالب موافقته على إصدار سياسة الخصوصية الحالي.",
        );
      if (programId) {
        const program = await tx.get(db.doc(`programs/${programId}`));
        if (
          !program.exists ||
          (action !== "unenroll" && program.data()?.published !== true)
        )
          throw new ApiError(409, "البرنامج غير متاح للتسجيل.");
      }
      const to =
        action === "approve"
          ? "approved"
          : action === "reject"
            ? "rejected"
            : action === "suspend"
              ? "suspended"
              : from;
      tx.update(studentRef, {
        status: to,
        updatedAt: FieldValue.serverTimestamp(),
        reviewedAt: FieldValue.serverTimestamp(),
      });
      if (programId)
        tx.set(db.doc(`students/${uid}/enrollments/${programId}`), {
          active: action !== "unenroll",
          programId,
          updatedAt: FieldValue.serverTimestamp(),
          changedBy: token.uid,
        });
      tx.set(db.doc(`studentAdministration/${uid}`), {
        reason,
        updatedAt: FieldValue.serverTimestamp(),
        actorUid: token.uid,
      });
      tx.create(auditRef, {
        studentUid: uid,
        actorUid: token.uid,
        actorEmail: token.email ?? "",
        action,
        from,
        to,
        reason,
        programId,
        fingerprint,
        at: FieldValue.serverTimestamp(),
      });
      return { replayed: false };
    });
    return json({ ok: true, ...result });
  } catch (error) {
    return failure(error);
  }
}
