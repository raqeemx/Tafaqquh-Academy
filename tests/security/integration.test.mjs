import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { chromium, expect } from "@playwright/test";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

test(
  "registration, verification, approval, rejection and protected API with local emulators",
  { timeout: 180000 },
  async () => {
    assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:9099");
    assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080");
    const projectId = "tafaqquh-academy";
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
    let browser;
    const app = initializeApp({ projectId }, "integration-test");
    const adminAuth = getAuth(app);
    const db = getFirestore(app);
    try {
      let started = false;
      for (let i = 0; i < 90; i++) {
        try {
          if ((await fetch("http://127.0.0.1:3100/login")).ok) {
            started = true;
            break;
          }
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      assert.ok(started, "Next dev should start");
      browser = await chromium.launch(
        process.env.PLAYWRIGHT_CHANNEL
          ? { channel: process.env.PLAYWRIGHT_CHANNEL }
          : {},
      );
      const page = await browser.newPage();
      // The browser is prohibited from making external requests during integration tests.
      await page.route("**/*", (route) => {
        const host = new URL(route.request().url()).hostname;
        return ["localhost", "127.0.0.1"].includes(host)
          ? route.continue()
          : route.abort();
      });
      const email = `test-${Date.now()}@example.test`;
      const password = "Local-test-only-123!";
      await page.goto("http://127.0.0.1:3100/register");
      await page.getByLabel("الاسم الكامل").fill("طالب اختبار محلي");
      await page.getByLabel("البريد الإلكتروني").fill(email);
      await page.getByLabel("كلمة المرور", { exact: true }).fill(password);
      await page.getByLabel("تأكيد كلمة المرور").fill(password);
      await page.getByRole("button", { name: "إنشاء حساب طالب" }).click();
      await expect(page).toHaveURL(/student/, { timeout: 30000 });
      await expect(
        page.getByRole("heading", { name: "طلبك قيد المراجعة" }),
      ).toBeVisible({ timeout: 15000 });
      const account = await adminAuth.getUserByEmail(email);
      const profile = db.doc(`students/${account.uid}`);
      assert.equal((await profile.get()).data().status, "pending");
      await db
        .doc("restrictedContent/integration")
        .set({
          published: true,
          title: "درس محلي للاختبار",
          body: "محتوى اصطناعي غير حقيقي",
        });
      async function token() {
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
      const api = (idToken) =>
        fetch("http://127.0.0.1:3100/api/student/content", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
      assert.equal((await api("forged-token")).status, 401);
      assert.equal((await api(await token())).status, 403);
      await adminAuth.updateUser(account.uid, { emailVerified: true });
      await page.getByRole("button", { name: "تحقّقت من بريدي" }).click();
      const verifiedToken = await token();
      assert.equal((await api(verifiedToken)).status, 403);
      await profile.update({ status: "approved" });
      await expect(
        page.getByRole("heading", { name: "درس محلي للاختبار" }),
      ).toBeVisible({ timeout: 20000 });
      const response = await api(verifiedToken);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("cache-control"), /no-store/);
      await profile.update({ status: "suspended" });
      await expect(
        page.getByRole("heading", { name: "الوصول معلّق" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "درس محلي للاختبار" }),
      ).toHaveCount(0);
      assert.equal((await api(verifiedToken)).status, 403);
      await page.getByRole("button", { name: "تسجيل الخروج" }).click();
      await expect(
        page.getByRole("link", { name: "دخول الطالب", exact: true }).last(),
      ).toBeVisible();
      // Auth succeeds without Firestore profile: the UI offers safe, idempotent recovery.
      await profile.delete();
      await page.goto("http://127.0.0.1:3100/login");
      await page.getByLabel("البريد الإلكتروني").fill(email);
      await page.getByLabel("كلمة المرور", { exact: true }).fill(password);
      await page
        .getByRole("button", { name: "تسجيل الدخول", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "إكمال طلب التسجيل" }),
      ).toBeVisible({ timeout: 15000 });
      await page.getByRole("button", { name: "إكمال طلب التسجيل" }).click();
      await expect(
        page.getByRole("heading", { name: "طلبك قيد المراجعة" }),
      ).toBeVisible();
      await adminAuth.deleteUser(account.uid);
    } catch (error) {
      console.error(logs.slice(-6000));
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
