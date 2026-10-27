import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { getAdminServices } from "@/lib/firebase/admin";
import { ApiError, failure, safeId } from "@/lib/server/api";
import { lessonAccess } from "@/lib/server/library";
import {
  allowedRoot,
  withinRoot,
  driveFile,
  driveMedia,
} from "@/lib/drive/provider";
import { recordingRange } from "@/lib/drive/range";
import { checkedMedia } from "@/lib/drive/stream";
import { playbackLimits } from "@/lib/drive/policy";
import { chargePlayback } from "@/lib/server/playback-budget";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const secret = request.cookies.get("academy_media")?.value;
    if (!secret || !/^[a-f0-9]{64}$/.test(secret))
      throw new ApiError(401, "يلزم بدء التشغيل من المكتبة.");
    const { db, auth } = getAdminServices();
    const session = await db
      .doc(`mediaSessions/${createHash("sha256").update(secret).digest("hex")}`)
      .get();
    const s = session.data();
    const { id } = await context.params;
    if (
      !s ||
      !Number.isFinite(s.expiresAt) ||
      s.expiresAt <= Date.now() ||
      s.lessonId !== id
    )
      throw new ApiError(401, "انتهى إذن التشغيل. أعد فتح التسجيل.");
    const account = await auth.getUser(s.uid);
    if (
      account.disabled ||
      !account.emailVerified ||
      s.authTime <
        Math.floor(
          Date.parse(account.tokensValidAfterTime ?? "1970-01-01") / 1000,
        )
    )
      throw new ApiError(403, "الحساب غير متاح.");
    const { lesson } = await lessonAccess(db, s.uid, id);
    await chargePlayback(db, s.uid, 0, 1);
    const assetId = lesson.data()?.assetId;
    if (!safeId(assetId)) throw new ApiError(404, "التسجيل غير متاح.");
    const asset = await db.doc(`driveAssets/${assetId}`).get();
    const a = asset.data();
    if (!a || !safeId(a.fileId) || !safeId(a.rootId))
      throw new ApiError(404, "التسجيل غير متاح.");
    await allowedRoot(a.rootId);
    if (!(await withinRoot(a.fileId, a.rootId)))
      throw new ApiError(403, "الملف خارج نطاق المكتبة.");
    const file = await driveFile(a.fileId);
    if (
      !/^(audio|video)\//.test(file.mimeType) ||
      file.capabilities?.canDownload !== true
    )
      throw new ApiError(403, "لا يسمح مصدر التسجيل بالقراءة.");
    const size = Number(file.size);
    if (size > playbackLimits().fileBytes)
      throw new ApiError(
        413,
        "التسجيل يتجاوز حد الحجم المسموح؛ تواصل مع الإدارة.",
      );
    let range;
    try {
      range = recordingRange(request.headers.get("range"), size);
    } catch {
      return new Response(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${Number.isSafeInteger(size) ? size : 0}`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    await chargePlayback(db, s.uid, range.end - range.start + 1, 0);
    const media = await driveMedia(
      a.fileId,
      range.start,
      range.end,
      request.signal,
    );
    const expected = `bytes ${range.start}-${range.end}/${size}`;
    const body = await checkedMedia(media, range.start, range.end, size);
    return new Response(body, {
      status: 206,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(range.end - range.start + 1),
        "Content-Range": expected,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Content-Disposition": "inline",
      },
    });
  } catch (e) {
    const response = failure(e);
    if (e instanceof ApiError && e.status === 429)
      response.headers.set(
        "Retry-After",
        String(3600 - (Math.floor(Date.now() / 1000) % 3600)),
      );
    return response;
  }
}
