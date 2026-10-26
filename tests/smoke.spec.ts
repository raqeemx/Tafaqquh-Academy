import { expect, test } from "@playwright/test";

test("Arabic RTL pages and navigation work without Firebase configuration", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "علمٍ راسخ",
  );
  await page
    .getByRole("link", { name: "أنا طالب جديد", exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(/new-student/);
  await page.getByText("كيف أنشئ حسابًا في المنصة؟").click();
  await expect(
    page.getByText("إنشاء الحسابات غير مفعّل", { exact: false }),
  ).toBeVisible();
  await page.getByRole("link", { name: "اطّلع على صفحة الدخول" }).click();
  await expect(page).toHaveURL(/login/);
  expect(errors).toEqual([]);
});

test("login preview validates fields, toggles visibility, and never sends credentials", async ({
  page,
}) => {
  await page.goto("/login");
  const outgoing: string[] = [];
  page.on("request", (req) => {
    if (req.method() !== "GET") outgoing.push(req.url());
  });
  await page.getByRole("button", { name: "معاينة تسجيل الدخول" }).click();
  await expect(page.locator("#email:invalid")).toHaveCount(1);
  await page.getByLabel("البريد الإلكتروني").fill("preview@example.com");
  await page
    .getByLabel("كلمة المرور", { exact: true })
    .fill("preview-only-123");
  await page.getByRole("button", { name: "إظهار كلمة المرور" }).click();
  await expect(page.locator("#password")).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "إخفاء كلمة المرور" }).click();
  await expect(page.locator("#password")).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "معاينة تسجيل الدخول" }).click();
  await expect(page.getByRole("status")).toContainText(
    "لم تُرسل بياناتك أو تُحفظ",
  );
  expect(outgoing).toEqual([]);
});

for (const width of [390, 1280]) {
  test(`pages fit viewport at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/", "/new-student", "/login"]) {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeAttached();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
  });
}

test("unknown routes show an Arabic not-found page", async ({ page }) => {
  const response = await page.goto("/missing-page");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "هذه الصفحة غير موجودة." }),
  ).toBeVisible();
});
