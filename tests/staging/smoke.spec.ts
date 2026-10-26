import { test, expect } from "@playwright/test";
test("approved staging serves isolated public pages and rejects anonymous administration", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("بيئة تجريبية — لا تستخدم بيانات طلاب حقيقية"),
  ).toBeVisible();
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "إدارة الأكاديمية" }),
  ).toBeVisible();
  expect((await request.get("/api/admin/overview")).status()).toBe(401);
  expect(
    (await request.get("/api/student/content?programId=not-enrolled")).status(),
  ).toBe(401);
});
