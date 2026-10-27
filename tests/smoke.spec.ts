import { expect, test } from "@playwright/test";
test("Arabic RTL pages and student navigation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page
    .getByRole("link", { name: "أنا طالب جديد", exact: true })
    .last()
    .click();
  await page.getByText("كيف أنشئ حسابًا في المنصة؟").click();
  await expect(
    page.getByText("أنشئ حسابًا من صفحة التسجيل", { exact: false }),
  ).toBeVisible();
  await page.getByRole("link", { name: "اطّلع على صفحة الدخول" }).click();
  await expect(page).toHaveURL(/login/);
  await page.getByRole("link", { name: "طالب جديد؟ أنشئ حسابًا" }).click();
  await expect(page).toHaveURL(/register/);
  expect(errors).toEqual([]);
});
test("unconfigured auth fails closed without collecting credentials", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.getByLabel("البريد الإلكتروني")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "تسجيل الدخول", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("لن تُرسل بياناتك", { exact: false }),
  ).toBeVisible();
  await page.goto("/register");
  await expect(
    page.getByRole("button", { name: "إنشاء حساب طالب" }),
  ).toBeDisabled();
  await page.goto("/student");
  await expect(
    page.getByText("الخدمة غير مهيأة بعد", { exact: false }),
  ).toBeVisible();
});
test("protected API rejects anonymous requests and never caches", async ({
  request,
}) => {
  const response = await request.get("/api/student/content");
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toContain("no-store");
});
for (const width of [390, 1280]) {
  test(`pages fit viewport at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/",
      "/new-student",
      "/login",
      "/register",
      "/student",
      "/admin",
      "/privacy",
      "/admin/content",
      "/admin/library",
      "/student/library",
    ]) {
      expect((await page.goto(route))?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
  });
}
test("admin endpoints reject anonymous users", async ({ request }) => {
  for (const path of [
    "/api/admin/overview",
    "/api/admin/students",
    "/api/admin/audit",
    "/api/admin/students/unknown",
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
  expect(
    (
      await request.post("/api/admin/students/unknown", {
        data: { action: "approve" },
      })
    ).status(),
  ).toBe(401);
});
test("unknown routes show an Arabic not-found page", async ({ page }) => {
  expect((await page.goto("/missing-page"))?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "هذه الصفحة غير موجودة." }),
  ).toBeVisible();
});
