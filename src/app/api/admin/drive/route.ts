import { createHash } from "node:crypto";
import {
  FieldValue,
  FieldPath,
  type DocumentData,
} from "firebase-admin/firestore";
import {
  administrator,
  ApiError,
  failure,
  json,
  readMutation,
  safeId,
} from "@/lib/server/api";
import { version } from "@/lib/server/serialize";
import {
  driveRoots,
  driveFile,
  driveChildren,
  allowedRoot,
  withinRoot,
  folderMime,
} from "@/lib/drive/provider";
import { lessonNumber, titleFromFile } from "@/lib/drive/names";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { db, token } = await administrator(request);
    const params = new URL(request.url).searchParams;
    const id = params.get("scan");
    if (!id) {
      const roots = await Promise.all(driveRoots().map(driveFile));
      return json({ roots: roots.map((r) => ({ id: r.id, name: r.name })) });
    }
    if (!safeId(id)) throw new ApiError(400, "معرف غير صالح.");
    const scan = await db.doc(`driveScans/${id}`).get();
    if (scan.data()?.actorUid !== token.uid)
      throw new ApiError(403, "المعاينة خاصة بالمسؤول الذي أنشأها.");
    let q = db
      .collection(`driveScans/${id}/candidates`)
      .orderBy(FieldPath.documentId())
      .limit(11);
    const after = params.get("after");
    if (after) {
      if (!safeId(after)) throw new ApiError(400, "مؤشر غير صالح.");
      q = q.startAfter(after);
    }
    const result = await q.get();
    const docs = result.docs.slice(0, 10);
    return json({
      scan: {
        id,
        done: scan.data()?.done,
        count: scan.data()?.count,
        rootId: scan.data()?.rootId,
      },
      candidates: docs.map((d) => ({ id: d.id, ...d.data() })),
      next: result.size > 10 ? docs.at(-1)!.id : null,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const { db, token } = await administrator(request, true);
    const raw = await readMutation(request);
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new ApiError(400, "طلب غير صالح.");
    const b = raw as Record<string, unknown>;
    if (!["start", "step", "approve"].includes(String(b.action)))
      throw new ApiError(400, "إجراء غير صالح.");
    if (b.action === "start") {
      if (!safeId(b.rootId) || !safeId(b.scanId))
        throw new ApiError(400, "اختر المجلد.");
      await allowedRoot(b.rootId);
      const root = await driveFile(b.rootId);
      if (root.mimeType !== folderMime) throw new ApiError(400, "اختر مجلدًا.");
      await db.runTransaction(async (tx) => {
        const [admin, old] = await tx.getAll(
          db.doc(`administrators/${token.uid}`),
          db.doc(`driveScans/${b.scanId}`),
        );
        if (admin.data()?.active !== true || admin.data()?.role !== "admin")
          throw new ApiError(403, "غير مخوّل.");
        if (old.exists) throw new ApiError(409, "المعاينة موجودة مسبقًا.");
        tx.create(db.doc(`driveScans/${b.scanId}`), {
          actorUid: token.uid,
          rootId: b.rootId,
          queue: [
            { id: b.rootId, path: root.name.slice(0, 200), pageToken: "" },
          ],
          seen: [b.rootId],
          done: false,
          count: 0,
          createdAt: FieldValue.serverTimestamp(),
        });
      });
      return json({ ok: true, scanId: b.scanId });
    }
    if (!safeId(b.scanId)) throw new ApiError(400, "معاينة غير صالحة.");
    const scanRef = db.doc(`driveScans/${b.scanId}`);
    const scan = await scanRef.get();
    const s = scan.data();
    if (!s || s.actorUid !== token.uid)
      throw new ApiError(403, "معاينة غير متاحة.");
    await allowedRoot(s.rootId);
    if (b.action === "step") {
      if (s.done) return json({ ok: true, done: true });
      const folder = s.queue[0] as {
        id: string;
        path: string;
        pageToken: string;
      };
      if (!(await withinRoot(folder.id, s.rootId)))
        throw new ApiError(409, "نُقل المجلد؛ ابدأ معاينة جديدة.");
      const page = await driveChildren(
        folder.id,
        folder.pageToken || undefined,
      );
      if (page.incompleteSearch)
        throw new ApiError(
          503,
          "أعاد Drive بحثًا غير مكتمل. أعد المحاولة دون اعتماد نتائج ناقصة.",
        );
      const queue = [...s.queue];
      const seen = [...s.seen];
      const candidates: DocumentData[] = [];
      if (page.nextPageToken)
        queue[0] = { ...folder, pageToken: page.nextPageToken };
      else queue.shift();
      for (const file of page.files) {
        if (!safeId(file.id) || file.trashed) continue;
        const path = `${folder.path}/${file.name}`;
        if (path.length > 1000)
          throw new ApiError(400, "المسار أطول من الحد؛ اختر مجلدًا أصغر.");
        if (file.mimeType === folderMime && !seen.includes(file.id)) {
          seen.push(file.id);
          queue.push({ id: file.id, path, pageToken: "" });
        } else if (/^(audio|video)\//.test(file.mimeType)) {
          candidates.push({
            fileId: file.id,
            name: file.name.slice(0, 300),
            title: titleFromFile(file.name),
            path,
            category: folder.path,
            number: lessonNumber(file.name),
            mimeType: file.mimeType,
            size: file.size ?? "",
            modifiedTime: file.modifiedTime ?? "",
            webViewLink: `https://drive.google.com/file/d/${file.id}/view`,
            approved: false,
          });
        }
      }
      if (seen.length > 250 || s.count + candidates.length > 10000)
        throw new ApiError(
          400,
          "تجاوزت المعاينة 250 مجلدًا أو 10000 تسجيل. اختر مجلدًا فرعيًا أصغر.",
        );
      await db.runTransaction(async (tx) => {
        const [admin, current] = await tx.getAll(
          db.doc(`administrators/${token.uid}`),
          scanRef,
        );
        if (admin.data()?.active !== true || admin.data()?.role !== "admin")
          throw new ApiError(403, "غير مخوّل.");
        if (version(current) !== version(scan))
          throw new ApiError(409, "تقدمت المعاينة؛ حدّثها.");
        for (const item of candidates)
          tx.set(scanRef.collection("candidates").doc(item.fileId), item);
        tx.update(scanRef, {
          queue,
          seen,
          count: s.count + candidates.length,
          done: queue.length === 0,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      return json({ ok: true, done: queue.length === 0 });
    }
    if (!s.done) throw new ApiError(409, "أكمل قراءة المجلدات قبل الاعتماد.");
    if (
      !safeId(b.fileId) ||
      !safeId(b.seriesId) ||
      typeof b.title !== "string" ||
      b.title.trim().length < 2 ||
      b.title.length > 200 ||
      !Number.isInteger(b.order) ||
      Number(b.order) < 0 ||
      Number(b.order) > 100000
    )
      throw new ApiError(400, "راجع العنوان والسلسلة والترتيب.");
    if (!(await withinRoot(b.fileId, s.rootId)))
      throw new ApiError(403, "لم يعد الملف ضمن المجلد المحدد.");
    const key = "drive_" + createHash("sha256").update(b.fileId).digest("hex");
    let existing = false;
    await db.runTransaction(async (tx) => {
      const [admin, current, candidate, series, asset, lesson] =
        await tx.getAll(
          db.doc(`administrators/${token.uid}`),
          scanRef,
          scanRef.collection("candidates").doc(String(b.fileId)),
          db.doc(`catalog/${b.seriesId}`),
          db.doc(`driveAssets/${key}`),
          db.doc(`catalog/${key}`),
        );
      if (admin.data()?.active !== true || admin.data()?.role !== "admin")
        throw new ApiError(403, "غير مخوّل.");
      if (
        current.data()?.actorUid !== token.uid ||
        !current.data()?.done ||
        !candidate.exists
      )
        throw new ApiError(409, "معاينة غير مكتملة.");
      if (series.data()?.kind !== "series")
        throw new ApiError(400, "اختر سلسلة معتمدة من الفهرس.");
      const d = candidate.data()!;
      existing = lesson.exists;
      if (asset.exists && asset.data()?.fileId !== b.fileId)
        throw new ApiError(409, "تعارض معرف الملف.");
      tx.set(db.doc(`driveAssets/${key}`), {
        fileId: b.fileId,
        rootId: s.rootId,
        sourceName: d.name,
        sourcePath: d.path,
        mimeType: d.mimeType,
        webViewLink: d.webViewLink,
        size: d.size,
        modifiedTime: d.modifiedTime,
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (!lesson.exists)
        tx.create(db.doc(`catalog/${key}`), {
          kind: "lesson",
          title: String(b.title).trim(),
          description: "",
          programId: series.data()!.programId,
          parentId: b.seriesId,
          order: b.order,
          lessonDate: "",
          published: false,
          progressEnabled: false,
          assetId: key,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: token.uid,
        });
      tx.update(candidate.ref, { approved: true, lessonId: key });
      tx.create(db.collection("admissionAudit").doc(), {
        action: existing ? "drive-sync" : "drive-import",
        actorUid: token.uid,
        actorEmail: token.email ?? "",
        reason: d.name,
        targetId: key,
        programId: lesson.data()?.programId ?? series.data()!.programId,
        at: FieldValue.serverTimestamp(),
      });
    });
    return json({ ok: true, existing, id: key });
  } catch (e) {
    return failure(e);
  }
}
