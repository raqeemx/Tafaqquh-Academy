import "server-only";
import type { Firestore, DocumentSnapshot } from "firebase-admin/firestore";
import { ApiError, safeId } from "./api";
import { parents, type Kind } from "@/lib/catalog/model";
import { PRIVACY_VERSION } from "@/lib/privacy/policy";
export async function programAccess(
  db: Firestore,
  uid: string,
  programId: string,
) {
  if (!safeId(programId)) throw new ApiError(400, "برنامج غير صالح.");
  const [profile, program, enrollment] = await db.getAll(
    db.doc(`students/${uid}`),
    db.doc(`programs/${programId}`),
    db.doc(`students/${uid}/enrollments/${programId}`),
  );
  if (
    profile.data()?.status !== "approved" ||
    profile.data()?.consentVersion !== PRIVACY_VERSION ||
    program.data()?.published !== true ||
    enrollment.data()?.active !== true
  )
    throw new ApiError(403, "لا يتاح هذا البرنامج لحسابك حاليًا.");
  return program;
}
export async function visibleEntry(
  db: Firestore,
  doc: DocumentSnapshot,
  programId: string,
  cache = new Map<string, DocumentSnapshot>(),
): Promise<boolean> {
  let current = doc;
  const seen = new Set<string>();
  for (let level = 0; level < 5; level++) {
    const d = current.data();
    if (
      !d ||
      d.published !== true ||
      d.programId !== programId ||
      !parents[d.kind as Kind] ||
      seen.has(current.id)
    )
      return false;
    seen.add(current.id);
    if (d.kind === "subject") return !d.parentId;
    if (!safeId(d.parentId)) return false;
    const parent =
      cache.get(d.parentId) ?? (await db.doc(`catalog/${d.parentId}`).get());
    cache.set(d.parentId, parent);
    if (!parents[d.kind as Kind].includes(parent.data()?.kind)) return false;
    current = parent;
  }
  return false;
}
export async function lessonAccess(db: Firestore, uid: string, id: string) {
  if (!safeId(id)) throw new ApiError(400, "درس غير صالح.");
  const lesson = await db.doc(`catalog/${id}`).get();
  const d = lesson.data();
  if (!d || d.kind !== "lesson" || !safeId(d.programId))
    throw new ApiError(403, "الدرس غير متاح.");
  const program = await programAccess(db, uid, d.programId);
  if (!(await visibleEntry(db, lesson, d.programId)))
    throw new ApiError(403, "الدرس أو أحد تصنيفاته غير منشور.");
  return { lesson, program };
}
