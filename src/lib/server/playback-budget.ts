import "server-only";
import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { playbackLimits, USAGE_RETENTION_MS } from "@/lib/drive/policy";
import { ApiError } from "./api";
export async function chargePlayback(
  db: Firestore,
  uid: string,
  bytes: number,
  requests: number,
) {
  const now = Date.now();
  const hour = Math.floor(now / 3600000);
  const id = createHash("sha256").update(`${uid}:${hour}`).digest("hex");
  const ref = db.doc(`playbackUsage/${id}`);
  const limits = playbackLimits();
  await db.runTransaction(async (tx) => {
    const old = (await tx.get(ref)).data();
    const nextBytes = (old?.bytes ?? 0) + bytes;
    const nextRequests = (old?.requests ?? 0) + requests;
    if (nextBytes > limits.hourlyBytes || nextRequests > limits.hourlyRequests)
      throw new ApiError(
        429,
        "بلغت حد التشغيل لهذه الساعة. حاول بعد بداية الساعة التالية.",
      );
    tx.set(ref, {
      bytes: nextBytes,
      requests: nextRequests,
      expiresAt: (hour + 1) * 3600000 + USAGE_RETENTION_MS,
    });
  });
}
