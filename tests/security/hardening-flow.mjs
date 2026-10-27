import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
export async function hardeningFlow({
  api,
  adminToken,
  studentToken,
  student,
  lessonId,
  db,
  origin,
}) {
  const session = await api("/api/student/media-session", studentToken, {
    lessonId,
  });
  assert.equal(session.status, 200);
  const cookie = session.headers.get("set-cookie").split(";")[0];
  const hash = createHash("sha256").update(cookie.split("=")[1]).digest("hex");
  const stream = (range = "bytes=0-15") =>
    fetch(`${origin}/api/student/recordings/${lessonId}`, {
      headers: { Cookie: cookie, Range: range },
    });
  assert.equal((await stream("bytes=0-1,4-5")).status, 416);
  const assetRef = db.doc(`driveAssets/${lessonId}`);
  const asset = (await assetRef.get()).data();
  await assetRef.update({
    fileId: "mock-large",
    privateCredential: "fixture-private-marker",
  });
  assert.equal((await stream()).status, 413);
  const library = await (
    await api("/api/student/library?programId=program-local", studentToken)
  ).json();
  for (const value of [
    "mock-large",
    "mock-root",
    "drive.google.com",
    "fixture-private-marker",
    "refresh_token",
    "sourcePath",
  ])
    assert.equal(JSON.stringify(library).includes(value), false);
  assert.equal(
    library.entries.find((e) => e.id === lessonId).mediaKind,
    "audio",
  );
  await assetRef.set(asset);
  await db.doc(`catalog/${lessonId}`).update({ published: false });
  assert.equal((await stream()).status, 403);
  await db.doc(`catalog/${lessonId}`).update({ published: true });
  const hour = Math.floor(Date.now() / 3600000);
  const usageId = createHash("sha256")
    .update(`${student.uid}:${hour}`)
    .digest("hex");
  const usage = db.doc(`playbackUsage/${usageId}`);
  await usage.set({
    requests: 599,
    bytes: 0,
    expiresAt: Date.now() + 86400000,
  });
  const concurrent = await Promise.all(
    [1, 2].map(() =>
      api("/api/student/media-session", studentToken, { lessonId }),
    ),
  );
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 429]);
  assert.equal((await stream()).status, 429);
  await usage.set({
    requests: 0,
    bytes: 2147483648,
    expiresAt: Date.now() + 86400000,
  });
  assert.equal((await stream()).status, 429);
  await usage.delete();
  await db.doc(`mediaSessions/${hash}`).update({ expiresAt: Date.now() - 1 });
  assert.equal((await stream()).status, 401);

  const expired = db.doc("driveScans/expired-local");
  const active = db.doc("driveScans/active-local");
  await expired.set({
    actorUid: (await db.collection("administrators").get()).docs[0].id,
    createdAt: Timestamp.fromMillis(Date.now() - 8 * 86400000),
    rootId: "mock-root",
    done: true,
  });
  await active.set({ createdAt: Timestamp.now() });
  const batch = db.batch();
  for (let i = 0; i < 201; i++)
    batch.set(expired.collection("candidates").doc(String(i)), {
      fileId: "fixture",
    });
  await batch.commit();
  await db
    .doc("mediaSessions/expired-local")
    .set({ expiresAt: Date.now() - 1 });
  await db
    .doc("mediaSessions/active-local")
    .set({ expiresAt: Date.now() + 300000 });
  await db
    .doc("playbackUsage/expired-local")
    .set({ expiresAt: Date.now() - 1 });
  assert.equal(
    (await api("/api/admin/drive?scan=expired-local", adminToken)).status,
    410,
  );
  for (const action of ["step", "approve"])
    assert.equal(
      (
        await api("/api/admin/drive", adminToken, {
          action,
          scanId: "expired-local",
        })
      ).status,
      410,
    );
  assert.equal(
    (
      await api("/api/admin/library-maintenance", studentToken, {
        action: "cleanup",
      })
    ).status,
    403,
  );
  const before = (await db.doc(`catalog/${lessonId}`).get()).data();
  const first = await api("/api/admin/library-maintenance", adminToken, {
    action: "cleanup",
  });
  assert.equal(first.status, 200);
  assert.equal((await first.json()).candidates, 200);
  assert.equal((await expired.get()).exists, true);
  assert.equal((await expired.collection("candidates").get()).size, 1);
  assert.equal(
    (
      await api("/api/admin/library-maintenance", adminToken, {
        action: "cleanup",
      })
    ).status,
    200,
  );
  assert.equal((await expired.get()).exists, false);
  assert.equal((await expired.collection("candidates").get()).size, 0);
  assert.equal((await active.get()).exists, true);
  assert.equal((await db.doc("mediaSessions/active-local").get()).exists, true);
  assert.equal(
    (await db.doc("mediaSessions/expired-local").get()).exists,
    false,
  );
  assert.equal(
    (await db.doc("playbackUsage/expired-local").get()).exists,
    false,
  );
  assert.deepEqual((await db.doc(`catalog/${lessonId}`).get()).data(), before);
  assert.ok(
    (
      await db
        .collection("admissionAudit")
        .where("action", "==", "library-cleanup")
        .get()
    ).size >= 2,
  );
}
