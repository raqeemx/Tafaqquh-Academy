import assert from "node:assert/strict";
import { expect } from "@playwright/test";
export async function driveFlow({
  api,
  adminToken,
  studentToken,
  admin,
  origin,
  db,
}) {
  assert.equal((await api("/api/admin/drive", studentToken)).status, 403);
  const roots = await (await api("/api/admin/drive", adminToken)).json();
  assert.equal(roots.roots[0].id, "mock-root");
  assert.equal(
    (
      await api("/api/admin/drive", adminToken, {
        action: "start",
        rootId: "outside-root",
        scanId: crypto.randomUUID(),
      })
    ).status,
    404,
  );
  async function scan() {
    const id = crypto.randomUUID();
    assert.equal(
      (
        await api("/api/admin/drive", adminToken, {
          action: "start",
          rootId: "mock-root",
          scanId: id,
        })
      ).status,
      200,
    );
    let done = false;
    for (let n = 0; n < 20 && !done; n++) {
      const r = await api("/api/admin/drive", adminToken, {
        action: "step",
        scanId: id,
      });
      assert.equal(r.status, 200);
      done = (await r.json()).done;
    }
    assert.equal(done, true);
    const preview = await (
      await api("/api/admin/drive?scan=" + id, adminToken)
    ).json();
    assert.equal(preview.candidates.length, 2);
    assert.equal(preview.candidates[0].number, 1);
    assert.ok(preview.candidates[0].path.includes("مادة تجريبية"));
    return { id, preview };
  }
  const { id, preview } = await scan();
  const candidate = preview.candidates[0];
  const request = {
    action: "approve",
    scanId: id,
    fileId: candidate.id,
    seriesId: "series-local",
    title: "عنوان اختبار يدوي",
    order: 1,
  };
  const first = await (
    await api("/api/admin/drive", adminToken, request)
  ).json();
  assert.equal(first.existing, false);
  const ref = db.doc("catalog/" + first.id);
  assert.equal((await ref.get()).data().published, false);
  await ref.update({ title: "عنوان حافظ عليه", order: 9 });
  const again = await scan();
  const second = await (
    await api("/api/admin/drive", adminToken, { ...request, scanId: again.id })
  ).json();
  assert.equal(second.id, first.id);
  assert.equal(second.existing, true);
  assert.equal((await ref.get()).data().title, "عنوان حافظ عليه");
  assert.equal((await ref.get()).data().order, 9);
  assert.equal((await db.collection("driveAssets").get()).size, 1);
  await admin.goto(origin + "/admin/library");
  await expect(
    admin.getByRole("heading", { name: "المكتبة العلمية — الاستيراد" }),
  ).toBeVisible();
  await admin.getByLabel("معرف المعاينة للاستئناف").fill(id);
  await admin.getByRole("button", { name: "استئناف / عرض المعاينة" }).click();
  await expect(
    admin.getByRole("link", { name: "معاينة المصدر في Drive (للمسؤول)" }),
  ).toHaveCount(2);
  return first.id;
}
