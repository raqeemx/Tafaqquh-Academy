import {driveFlow} from "./drive-flow.mjs";
import {catalogFlow} from "./catalog-flow.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
const origin = "http://127.0.0.1:3100";

test(
  "full student/admin admission lifecycle, program authorization, audit and replay protection",
  { timeout: 300000 },
  async () => {
    assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:9099");
    assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080");
    const projectId = "demo-tafaqquh";
    await fetch(
      `http://127.0.0.1:8080/emulator/v1/projects/${projectId}/databases/(default)/documents`,
      { method: "DELETE" },
    );
    await fetch(
      `http://127.0.0.1:9099/emulator/v1/projects/${projectId}/accounts`,
      { method: "DELETE" },
    );
    const server = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "dev",
        "--hostname",
        "127.0.0.1",
        "--port",
        "3100",
      ],
      {
        env: {
          ...process.env,
          NODE_ENV: "development",
          DRIVE_PROVIDER: "mock",
          APP_ENV: "local",
          NEXT_PUBLIC_APP_ENV: "local",
          APP_ORIGIN: origin,
          NEXT_PUBLIC_FIREBASE_API_KEY: "emulator-only-test-key",
          NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "localhost",
          NEXT_PUBLIC_FIREBASE_PROJECT_ID: projectId,
          NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "emulator-only",
          NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "emulator-only",
          NEXT_PUBLIC_FIREBASE_APP_ID: "emulator-only",
          NEXT_PUBLIC_FIREBASE_AUTH_ENABLED: "true",
          NEXT_PUBLIC_FIREBASE_USE_EMULATORS: "true",
          FIREBASE_PROJECT_ID: projectId,
          FIREBASE_ADMIN_ENABLED: "true",
          FIREBASE_USE_EMULATORS: "true",
          NEXT_PUBLIC_PRIVACY_POLICY_APPROVED: "true",
          NEXT_PUBLIC_PRIVACY_CONTROLLER: "جهة اختبار محلية",
          NEXT_PUBLIC_PRIVACY_CONTACT: "privacy@example.test",
          NEXT_PUBLIC_PRIVACY_RETENTION:
            "سياسة اختبار محلي؛ بيانات اصطناعية تُحذف بعد الاختبار.",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let logs = "";
    server.stdout.on("data", (data) => {
      logs += data;
    });
    server.stderr.on("data", (data) => {
      logs += data;
    });
    const app = initializeApp(
      {
        projectId,
      },
      "integration-test",
    );
    const auth = getAuth(app);
    const db = getFirestore(app);
    let browser;
    const password = "Local-test-only-123!";
    async function signInToken(email) {
      const response = await fetch(
        "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-only",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, returnSecureToken: true }),
        },
      );
      const data = await response.json();
      assert.ok(data.idToken);
      return data.idToken;
    }
    const api = (path, token, body, customOrigin = origin) =>
      fetch(origin + path, {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body
            ? { "Content-Type": "application/json", Origin: customOrigin }
            : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    try {
      let started = false;
      for (let i = 0; i < 100; i++) {
        try {
          if ((await fetch(origin + "/login")).ok) {
            started = true;
            break;
          }
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      assert.ok(started);
      const administrator = await auth.createUser({
        email: "admin@example.test",
        password,
        emailVerified: true,
        displayName: "مسؤول اختبار",
      });
      await db
        .doc(`administrators/${administrator.uid}`)
        .set({ active: true, role: "admin" });
      await db
        .doc("programs/alpha")
        .set({ published: true, title: "برنامج محلي ألف — للاختبار فقط" });
      await db
        .doc("programs/beta")
        .set({ published: true, title: "برنامج محلي باء — للاختبار فقط" });
      await db
        .doc("restrictedContent/alpha")
        .set({
          programId: "alpha",
          published: true,
          title: "مادة اختبار ألف",
          body: "نص اصطناعي للاختبار، ليس مادة للشيخ.",
        });
      await db
        .doc("restrictedContent/beta")
        .set({
          programId: "beta",
          published: true,
          title: "مادة اختبار باء",
          body: "نص اصطناعي.",
        });
      browser = await chromium.launch(
        process.env.PLAYWRIGHT_CHANNEL
          ? { channel: process.env.PLAYWRIGHT_CHANNEL }
          : {},
      );
      const studentContext = await browser.newContext();
      const adminContext = await browser.newContext();
      for (const context of [studentContext, adminContext])
        await context.route("**/*", (route) =>
          ["localhost", "127.0.0.1"].includes(
            new URL(route.request().url()).hostname,
          )
            ? route.continue()
            : route.abort(),
        );
      const page = await studentContext.newPage();
      const admin = await adminContext.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      admin.on("pageerror", (error) => errors.push(error.message));
      const email = "student@example.test";
      await page.goto(origin + "/new-student");
      await page
        .getByRole("link", { name: "إنشاء حساب طالب", exact: true })
        .click();
      await page.getByLabel("الاسم الكامل").fill("طالب اختبار محلي");
      await page.getByLabel("البريد الإلكتروني").fill(email);
      await page.getByLabel("كلمة المرور", { exact: true }).fill(password);
      await page.getByLabel("تأكيد كلمة المرور").fill(password);
      await page.getByRole("button", { name: "إنشاء حساب طالب" }).click();
      await expect(page).toHaveURL(/register/); // native required consent prevents submission
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "إنشاء حساب طالب" }).click();
      await expect(page).toHaveURL(/student/, { timeout: 30000 });
      await expect(
        page.getByRole("heading", { name: "طلبك قيد المراجعة" }),
      ).toBeVisible({ timeout: 15000 });
      const student = await auth.getUserByEmail(email);
      const profile = db.doc(`students/${student.uid}`);
      const data = (await profile.get()).data();
      assert.equal(data.status, "pending");
      assert.equal(data.consentVersion, "2026-10-26.v1");
      assert.ok(data.consentedAt.toMillis() > 0);
      let studentToken = await signInToken(email);
      assert.equal(
        (await api("/api/student/content?programId=alpha", studentToken))
          .status,
        403,
      );
      assert.equal(
        (await api("/api/admin/overview", studentToken)).status,
        403,
      );
      assert.equal(
        (await api("/api/admin/overview", "forged-token")).status,
        401,
      );
      await auth.updateUser(student.uid, { emailVerified: true });
      await page.getByRole("button", { name: "تحقّقت من بريدي" }).click();
      await auth.setCustomUserClaims(student.uid, { admin: true }); // irrelevant: no trusted registry record
      studentToken = await signInToken(email);
      for (const path of [
        "/api/admin/overview",
        "/api/admin/students",
        "/api/admin/audit",
        `/api/admin/students/${student.uid}`,
      ])
        assert.equal((await api(path, studentToken)).status, 403);
      assert.equal(
        (await api(`/api/admin/students/${student.uid}`, studentToken, {}))
          .status,
        403,
      );
      assert.equal(
        (await api("/api/student/content?programId=alpha", studentToken))
          .status,
        403,
      );
      await admin.goto(origin + "/admin");
      await admin.getByLabel("البريد الإلكتروني").fill("admin@example.test");
      await admin.getByLabel("كلمة المرور", { exact: true }).fill(password);
      await admin
        .getByRole("button", { name: "تسجيل الدخول", exact: true })
        .click();
      await expect(
        admin.getByRole("heading", { name: "إدارة الطلبة" }),
      ).toBeVisible({ timeout: 30000 });
      await expect(
        admin.getByRole("button", { name: "مراجعة طلب طالب اختبار محلي" }),
      ).toBeVisible({ timeout: 20000 });
      async function screenshot(name, target = admin) {
        if (process.env.QA_SCREENSHOT_DIR) {
          mkdirSync(process.env.QA_SCREENSHOT_DIR, { recursive: true });
          await target.screenshot({
            path: join(process.env.QA_SCREENSHOT_DIR, name),
            fullPage: true,
          });
        }
      }
      await admin.setViewportSize({ width: 1440, height: 1000 });
      await screenshot("admin-desktop.png");
      await admin.setViewportSize({ width: 390, height: 844 });
      assert.equal(
        await admin.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await screenshot("admin-mobile.png");
      await admin
        .getByRole("button", { name: "مراجعة طلب طالب اختبار محلي" })
        .click();
      await expect(admin.getByRole("dialog")).toBeVisible();
      await screenshot("admin-review-mobile.png");
      await admin.getByRole("dialog").getByRole("checkbox").check();
      await admin.getByRole("button", { name: "تأكيد القرار" }).click();
      await expect(
        page.getByRole("heading", { name: "تم قبول تسجيلك" }),
      ).toBeVisible();
      assert.equal(
        (await api("/api/student/content?programId=alpha", studentToken))
          .status,
        403,
      ); // approval != enrollment
      const adminToken = await signInToken("admin@example.test");
      assert.equal(
        (
          await api(
            `/api/admin/students/${student.uid}`,
            adminToken,
            {},
            "https://untrusted.example",
          )
        ).status,
        403,
      );
      async function findStudent(status) {
        await admin.getByLabel("حالة الطلب").selectOption(status);
        await admin.getByLabel("البحث بحسب").selectOption("email");
        await admin.getByLabel("البحث", { exact: true }).fill("student@");
        await admin.getByRole("button", { name: "تطبيق البحث" }).click();
        await admin
          .getByRole("button", { name: "مراجعة طلب طالب اختبار محلي" })
          .click();
        await expect(admin.getByRole("dialog")).toBeVisible();
      }
      await findStudent("approved");
      await admin.getByLabel("القرار", { exact: true }).selectOption("enroll");
      await admin.getByLabel("البرنامج", { exact: true }).selectOption("alpha");
      await admin.getByRole("dialog").getByRole("checkbox").check();
      await admin.getByRole("button", { name: "تأكيد القرار" }).click();
      await expect(page.getByLabel("اختر البرنامج")).toBeVisible({
        timeout: 15000,
      });
      await page.getByLabel("اختر البرنامج").selectOption("alpha");
      await expect(
        page.getByRole("heading", { name: "مادة اختبار ألف" }),
      ).toBeVisible();
      await expect(page.getByRole("option", { name: /باء/ })).toHaveCount(0);
      assert.equal(
        (await api("/api/student/content?programId=alpha", studentToken))
          .status,
        200,
      );
      assert.equal(
        (await api("/api/student/content?programId=beta", studentToken)).status,
        403,
      );
      await screenshot("student-program.png", page);
      // Revoking a single enrollment clears the visible content and denies subsequent HTTP reads.
      await findStudent("approved");
      await admin
        .getByLabel("القرار", { exact: true })
        .selectOption("unenroll");
      await admin.getByLabel("البرنامج", { exact: true }).selectOption("alpha");
      await admin.getByRole("dialog").getByRole("checkbox").check();
      await admin.getByRole("button", { name: "تأكيد القرار" }).click();
      await expect(
        page.getByRole("heading", { name: "مادة اختبار ألف" }),
      ).toHaveCount(0);
      assert.equal(
        (await api("/api/student/content?programId=alpha", studentToken))
          .status,
        403,
      );
      await findStudent("approved");
      await admin.getByLabel("القرار", { exact: true }).selectOption("enroll");
      await admin.getByLabel("البرنامج", { exact: true }).selectOption("alpha");
      await admin.getByRole("dialog").getByRole("checkbox").check();
      await admin.getByRole("button", { name: "تأكيد القرار" }).click();
      await findStudent("approved");
      await admin.getByLabel("القرار", { exact: true }).selectOption("suspend");
      await admin
        .getByLabel("سبب أو ملاحظة إدارية (اختياري)")
        .fill("ملاحظة اختبار خاصة بالإدارة");
      await admin.getByRole("dialog").getByRole("checkbox").check();
      await admin.getByRole("button", { name: "تأكيد القرار" }).click();
      await expect(
        page.getByRole("heading", { name: "الوصول معلّق" }),
      ).toBeVisible();
      assert.equal(
        (await api("/api/student/content?programId=alpha", studentToken))
          .status,
        403,
      );
      assert.equal((await profile.get()).data().reason, undefined);
      await admin
        .getByRole("button", { name: "سجل التدقيق", exact: true })
        .click();
      await expect(
        admin.getByText("سبب إداري: ملاحظة اختبار خاصة بالإدارة"),
      ).toBeVisible();
      const events = await db
        .collection("admissionAudit")
        .where("studentUid", "==", student.uid)
        .get();
      assert.equal(events.size, 5);
      for (const event of events.docs) {
        assert.equal(event.data().actorUid, administrator.uid);
        assert.ok(event.data().at);
      }
      await screenshot("admin-audit-mobile.png");
      // Idempotency and optimistic concurrency: the same decision is not applied twice.
      const before = await (
        await api(`/api/admin/students/${student.uid}`, adminToken)
      ).json();
      const decision = {
        action: "approve",
        expectedVersion: before.student.version,
        requestId: crypto.randomUUID(),
        reason: "",
      };
      assert.equal(
        (await api(`/api/admin/students/${student.uid}`, adminToken, decision))
          .status,
        200,
      );
      const replay = await api(
        `/api/admin/students/${student.uid}`,
        adminToken,
        decision,
      );
      assert.equal(replay.status, 200);
      assert.equal((await replay.json()).replayed, true);
      assert.equal(
        (
          await api(`/api/admin/students/${student.uid}`, adminToken, {
            ...decision,
            action: "suspend",
            requestId: crypto.randomUUID(),
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await db
            .collection("admissionAudit")
            .where("studentUid", "==", student.uid)
            .get()
        ).size,
        6,
      );
      // A disabled/revoked administrator immediately loses API access with the same token.
      await db
        .doc(`administrators/${administrator.uid}`)
        .update({ active: false });
      assert.equal((await api("/api/admin/students", adminToken)).status, 403);
      assert.equal(
        (await api(`/api/admin/students/${student.uid}`, adminToken, decision))
          .status,
        403,
      );
      await db
        .doc(`administrators/${administrator.uid}`)
        .update({ active: true });
      // Reject a separate application and keep the administrative reason private.
      const second = await auth.createUser({
        email: "second@example.test",
        password,
        emailVerified: true,
      });
      await db
        .doc(`students/${second.uid}`)
        .set({
          uid: second.uid,
          email: second.email,
          displayName: "طلب اختبار آخر",
          status: "pending",
          consentVersion: "2026-10-26.v1",
          consentedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      const secondDetail = await (
        await api(`/api/admin/students/${second.uid}`, adminToken)
      ).json();
      const secondDecision = {
        action: "reject",
        expectedVersion: secondDetail.student.version,
        requestId: crypto.randomUUID(),
        reason: "سبب رفض للاختبار",
      };
      const outcomes = await Promise.all([
        api(`/api/admin/students/${second.uid}`, adminToken, secondDecision),
        api(`/api/admin/students/${second.uid}`, adminToken, {
          ...secondDecision,
          action: "approve",
          requestId: crypto.randomUUID(),
        }),
      ]);
      assert.deepEqual(
        outcomes.map((result) => result.status).sort(),
        [200, 409],
      );
      assert.equal(
        (
          await db
            .collection("admissionAudit")
            .where("studentUid", "==", second.uid)
            .get()
        ).size,
        1,
      );
      // Existing Auth account with an interrupted profile write still recovers safely with explicit consent.
      await page
        .getByRole("button", { name: "تسجيل الخروج", exact: true })
        .click();
      await profile.delete();
      await page.goto(origin + "/login");
      await page.getByLabel("البريد الإلكتروني").fill(email);
      await page.getByLabel("كلمة المرور", { exact: true }).fill(password);
      await page
        .getByRole("button", { name: "تسجيل الدخول", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "إكمال طلب التسجيل" }),
      ).toBeVisible();
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "إكمال طلب التسجيل" }).click();
      await expect(
        page.getByRole("heading", { name: "طلبك قيد المراجعة" }),
      ).toBeVisible();
      await catalogFlow({api,adminToken,studentToken:await signInToken(email),admin,origin,db});
      await driveFlow({api,adminToken,studentToken:await signInToken(email),admin,origin,db});
      assert.deepEqual(errors, []);
    } catch (error) {
      console.error(logs.slice(-7000));
      throw error;
    } finally {
      await browser?.close();
      await db.terminate();
      await deleteApp(app);
      if (process.platform === "win32") {
        try {
          execFileSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], {
            stdio: "ignore",
          });
        } catch {}
      } else server.kill("SIGTERM");
    }
  },
);
