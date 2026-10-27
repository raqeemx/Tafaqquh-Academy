import "server-only";
import type {
  DocumentSnapshot,
  Firestore,
  Transaction,
} from "firebase-admin/firestore";
import { ApiError, safeId } from "./api";
import { version } from "./serialize";
import {
  kinds,
  parents,
  type CatalogEntry,
  type Kind,
} from "@/lib/catalog/model";
export function catalogRow(doc: DocumentSnapshot, kind?: Kind): CatalogEntry {
  const d = doc.data()!;
  return {
    id: doc.id,
    kind: kind ?? d.kind,
    title: d.title ?? "",
    description: d.description ?? "",
    programId: d.programId ?? "",
    parentId: d.parentId ?? "",
    order: d.order ?? 0,
    lessonDate: d.lessonDate ?? "",
    published: d.published === true,
    progressEnabled: d.progressEnabled === true,
    version: version(doc),
  };
}
export function parseEntry(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new ApiError(400, "بيانات غير صالحة.");
  const b = raw as Record<string, unknown>;
  if (
    Object.keys(b).some(
      (k) =>
        ![
          "id",
          "kind",
          "title",
          "description",
          "programId",
          "parentId",
          "order",
          "lessonDate",
          "published",
          "progressEnabled",
          "version",
        ].includes(k),
    )
  )
    throw new ApiError(400, "حقول غير مسموحة.");
  if (
    !safeId(b.id) ||
    !kinds.includes(b.kind as Kind) ||
    typeof b.version !== "string" ||
    b.version.length > 80
  )
    throw new ApiError(400, "معرّف غير صالح.");
  const kind = b.kind as Kind;
  if (
    typeof b.title !== "string" ||
    b.title.trim().length < 2 ||
    b.title.length > 200 ||
    typeof b.description !== "string" ||
    b.description.length > 3000 ||
    !Number.isInteger(b.order) ||
    Number(b.order) < 0 ||
    Number(b.order) > 100000 ||
    typeof b.published !== "boolean" ||
    typeof b.progressEnabled !== "boolean"
  )
    throw new ApiError(400, "راجع العنوان والوصف والترتيب وحالة النشر.");
  if (
    typeof b.lessonDate !== "string" ||
    (b.lessonDate !== "" &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(b.lessonDate) ||
        !Number.isFinite(Date.parse(b.lessonDate)) ||
        new Date(b.lessonDate).toISOString().slice(0, 10) !== b.lessonDate))
  )
    throw new ApiError(400, "تاريخ غير صالح.");
  if (
    typeof b.programId !== "string" ||
    typeof b.parentId !== "string" ||
    (kind !== "program" && !safeId(b.programId)) ||
    (parents[kind].length > 0 && !safeId(b.parentId)) ||
    (!parents[kind].length && b.parentId !== "") ||
    (kind === "program" && b.programId !== "")
  )
    throw new ApiError(400, "اختر البرنامج والتصنيف الأب الصحيح.");
  return {
    id: b.id,
    kind,
    title: b.title.trim(),
    description: b.description.trim(),
    programId: b.programId,
    parentId: b.parentId,
    order: Number(b.order),
    lessonDate: kind === "lesson" ? b.lessonDate : "",
    published: b.published,
    progressEnabled: kind === "program" && b.progressEnabled,
    version: b.version,
  };
}
export async function validateParent(
  tx: Transaction,
  db: Firestore,
  entry: CatalogEntry,
) {
  if (entry.kind === "program") return;
  const program = await tx.get(db.doc(`programs/${entry.programId}`));
  if (!program.exists) throw new ApiError(409, "البرنامج غير موجود.");
  if (parents[entry.kind].length) {
    const parent = await tx.get(db.doc(`catalog/${entry.parentId}`));
    if (
      !parent.exists ||
      !parents[entry.kind].includes(parent.data()?.kind) ||
      parent.data()?.programId !== entry.programId
    )
      throw new ApiError(
        409,
        "التصنيف الأب لا ينتمي إلى البرنامج أو نوعه غير مناسب.",
      );
  }
}
