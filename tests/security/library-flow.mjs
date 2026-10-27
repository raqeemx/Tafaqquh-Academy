import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
export async function libraryFlow({
  api,
  studentToken,
  student,
  lessonId,
  page,
  admin,
  origin,
  db,
  auth,
}) {
  const program = db.doc("programs/program-local");
  const profile = db.doc("students/" + student.uid);
  const enrollment = db.doc(
    `students/${student.uid}/enrollments/program-local`,
  );
  await program.update({ progressEnabled: true });
  await profile.update({ status: "approved" });
  await enrollment.set({ active: true });
  await db.doc("catalog/" + lessonId).update({ published: true });
  const original = (await db.doc("catalog/" + lessonId).get()).data();
  await db.doc("catalog/next-lesson").set({
    ...original,
    assetId: "video-fixture",
    title: "الدرس التالي للاختبار",
    order: 10,
  });
  const library = () =>
    api("/api/student/library?programId=program-local", studentToken);
  const list = await (await library()).json();
  assert.ok(list.entries.some((e) => e.id === lessonId));
  assert.ok(!list.entries.some((e) => e.id === "lesson-local"));
  assert.ok(!JSON.stringify(list).includes("drive.google.com"));
  assert.ok(!JSON.stringify(list).includes("mock-audio-01"));
  assert.equal(
    (await api("/api/student/library?programId=beta", studentToken)).status,
    403,
  );
  assert.equal(
    (
      await api("/api/student/progress", studentToken, {
        lessonId,
        completed: true,
        consent: false,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await api("/api/student/progress", studentToken, {
        lessonId,
        completed: true,
        consent: true,
        uid: "other",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await api("/api/student/progress", studentToken, {
        lessonId,
        completed: true,
        consent: true,
      })
    ).status,
    200,
  );
  assert.equal(
    (await db.doc(`students/${student.uid}/progress/${lessonId}`).get()).data()
      .completed,
    true,
  );
  const session = await api("/api/student/media-session", studentToken, {
    lessonId,
  });
  assert.equal(session.status, 200);
  const cookie = session.headers.get("set-cookie");
  assert.ok(cookie.includes("HttpOnly"));
  assert.ok(cookie.includes("SameSite=strict"));
  assert.ok(cookie.includes("Path=/api/student/recordings"));
  const cookieValue = cookie.split(";")[0];
  const stream = (id = lessonId) =>
    fetch(origin + "/api/student/recordings/" + id, {
      headers: { Cookie: cookieValue, Range: "bytes=0-15" },
    });
  await db.doc("driveAssets/video-fixture").set({ mimeType: "video/mp4" });
  assert.equal(
    (await fetch(origin + "/api/student/recordings/" + lessonId)).status,
    401,
  );
  const audio = await stream();
  assert.equal(audio.status, 206);
  assert.equal(audio.headers.get("content-range"), "bytes 0-15/76");
  assert.equal((await audio.arrayBuffer()).byteLength, 16);
  assert.equal((await stream("next-lesson")).status, 401);
  await db.doc("catalog/book-local").update({ published: false });
  assert.equal((await stream()).status, 403);
  assert.ok(
    !(await (await library()).json()).entries.some((e) => e.id === lessonId),
  );
  await db.doc("catalog/book-local").update({ published: true });
  await enrollment.update({ active: false });
  assert.equal((await stream()).status, 403);
  assert.equal((await library()).status, 403);
  await enrollment.update({ active: true });
  await profile.update({ status: "suspended" });
  assert.equal((await stream()).status, 403);
  await profile.update({ status: "approved" });
  await auth.updateUser(student.uid, { disabled: true });
  assert.equal((await stream()).status, 403);
  await auth.updateUser(student.uid, { disabled: false });
  await program.update({ progressEnabled: false });
  assert.equal(
    (
      await api("/api/student/progress", studentToken, {
        lessonId,
        completed: true,
        consent: true,
      })
    ).status,
    403,
  );
  await program.update({ progressEnabled: true });
  await page.goto(origin + "/student/library");
  await page.getByLabel("برامجي المصرح بها").selectOption("program-local");
  await page.getByLabel("ابحث عن درس في البرنامج").fill("عنوان حافظ عليه");
  await page.getByRole("button", { name: "عرض الدرس", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "عنوان حافظ عليه" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "فتح التسجيل / تجديد الإذن" }).click();
  await expect(page.locator("audio")).toHaveAttribute(
    "src",
    /\/api\/student\/recordings\//,
  );
  const playback = page.waitForResponse(
    (r) => r.url().includes("/api/student/recordings/") && r.status() === 206,
  );
  await page.locator("audio").evaluate(async (audio) => {
    await audio.play();
  });
  await playback;
  assert.ok(
    await page.locator("audio").evaluate((audio) => audio.duration > 0),
  );
  await expect(
    page.getByRole("button", { name: "مسح علامة الإتمام" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "الدرس التالي", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "الدرس التالي للاختبار" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "فتح التسجيل / تجديد الإذن" }).click();
  await expect(page.getByLabel("مشغّل الدرس المرئي")).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(0);
  await page.getByRole("button", { name: "الدرس السابق", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  if (process.env.QA_SCREENSHOT_DIR) {
    mkdirSync(process.env.QA_SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({
      path: join(process.env.QA_SCREENSHOT_DIR, "student-library-mobile.png"),
      fullPage: true,
    });
    await admin.screenshot({
      path: join(process.env.QA_SCREENSHOT_DIR, "drive-preview-mobile.png"),
      fullPage: true,
    });
    await admin.goto(origin + "/admin/content");
    await admin.setViewportSize({ width: 1440, height: 1000 });
    await expect(
      admin.getByRole("button", { name: "إنشاء برنامج", exact: true }),
    ).toBeVisible();
    await admin.screenshot({
      path: join(
        process.env.QA_SCREENSHOT_DIR,
        "content-management-desktop.png",
      ),
      fullPage: true,
    });
  }
  // Obtain a live recording cookie, not a token sent in JS or an Authorization header.
  await page.getByRole("button", { name: "فتح التسجيل / تجديد الإذن" }).click();
  await expect(page.locator("audio")).toHaveAttribute("src", `/api/student/recordings/${lessonId}`);
  const oldCookie = (await page.context().cookies()).find(
    (c) => c.name === "academy_media",
  );
  assert.equal(oldCookie.path, "/api/student/recordings");
  assert.equal(oldCookie.httpOnly, true);
  const oldHash = createHash("sha256").update(oldCookie.value).digest("hex");
  const replay = () =>
    fetch(`${origin}/api/student/recordings/${lessonId}`, {
      headers: {
        Cookie: `academy_media=${oldCookie.value}`,
        Range: "bytes=0-15",
      },
    });
  const playable = await replay();
  assert.equal(playable.status, 206);
  await playable.arrayBuffer();
  const forbidden = await fetch(origin + "/api/student/recordings", {
    method: "DELETE",
    headers: {
      Origin: "https://untrusted.example",
      Cookie: `academy_media=${oldCookie.value}`,
    },
  });
  assert.equal(forbidden.status, 403);
  assert.equal((await db.doc(`mediaSessions/${oldHash}`).get()).exists, true);
  // A backend/IAM/network failure must not masquerade as a successful logout.
  await page.route("**/api/student/recordings", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"error":"test-only-unavailable"}',
    }),
  );
  await page.getByRole("button", { name: "تسجيل الخروج", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("لم يكتمل تسجيل الخروج");
  assert.ok(
    (await page.context().cookies()).some((c) => c.name === "academy_media"),
  );
  await page.unroute("**/api/student/recordings");
  await page.getByRole("button", { name: "تسجيل الخروج", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "تسجيل الدخول للمكتبة" }),
  ).toBeVisible();
  assert.ok(
    !(await page.context().cookies()).some((c) => c.name === "academy_media"),
  );
  assert.equal((await db.doc(`mediaSessions/${oldHash}`).get()).exists, false);
  assert.equal(
    (await replay()).status,
    401,
    "A copied pre-logout capability must no longer play",
  );
  const repeated = await fetch(origin + "/api/student/recordings", {
    method: "DELETE",
    headers: { Origin: origin, Cookie: `academy_media=${oldCookie.value}` },
  });
  assert.equal(repeated.status, 200);
  assert.deepEqual(await repeated.json(), { ok: true });
  // Old application tabs still calling /media-session must follow the redirect with scoped cookies.
  const legacy = await api("/api/student/media-session", studentToken, {
    lessonId,
  });
  const legacyValue = legacy.headers
    .get("set-cookie")
    .split(";")[0]
    .split("=")[1];
  await page
    .context()
    .addCookies([
      {
        name: "academy_media",
        value: legacyValue,
        domain: "127.0.0.1",
        path: "/api/student/recordings",
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);
  const redirected = await page.evaluate(async () => {
    const r = await fetch("/api/student/media-session", { method: "DELETE" });
    return { status: r.status, url: r.url, redirected: r.redirected };
  });
  assert.equal(redirected.status, 200);
  assert.equal(redirected.redirected, true);
  assert.equal(redirected.url, origin + "/api/student/recordings");
  assert.equal(
    (
      await db
        .doc(
          `mediaSessions/${createHash("sha256").update(legacyValue).digest("hex")}`,
        )
        .get()
    ).exists,
    false,
  );
}
