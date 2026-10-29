"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { type User } from "firebase/auth";
import { academySignOut } from "@/lib/firebase/sign-out";
import {
  kinds,
  labels,
  parents,
  type Kind,
  type CatalogEntry,
} from "@/lib/catalog/model";
import { adminCall } from "./client-api";
import { AdminNavigation } from "./navigation";
export async function loadCatalog(user: User) {
  const all: CatalogEntry[] = [];
  for (const kind of ["program", "subject"]) {
    let after: string | null = null;
    do {
      const result: { entries: CatalogEntry[]; next: string | null } =
        await adminCall(
          user,
          `/api/admin/catalog?kind=${kind}${after ? `&after=${after}` : ""}`,
        );
      all.push(...result.entries);
      after = result.next;
    } while (after);
  }
  return all;
}
export function ContentManager({ user }: { user: User }) {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [editor, setEditor] = useState<CatalogEntry | null>(null);
  const [kind, setKind] = useState<Kind>("program");
  const [q, setQ] = useState("");
  const [state, setState] = useState("all");
  const [program, setProgram] = useState("");
  const [sort, setSort] = useState("order");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [zone, setZone] = useState("Asia/Baghdad");
  const reload = useCallback(async () => {
    const result = await loadCatalog(user);
    setEntries(result);
    setReady(true);
  }, [user]);
  useEffect(() => {
    let active = true;
    void loadCatalog(user)
      .then((result) => {
        if (active) {
          setEntries(result);
          setReady(true);
        }
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      });
    void fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setZone(d.timeZone))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user]);
  async function task(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await work();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "تعذّر الحفظ.");
    } finally {
      setBusy(false);
    }
  }
  function fresh() {
    setEditor({
      id: crypto.randomUUID(),
      kind,
      title: "",
      description: "",
      programId: kind === "program" ? "" : program,
      parentId: "",
      order: 0,
      lessonDate: "",
      published: false,
      progressEnabled: false,
      version: "",
    });
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editor) return;
    await task(async () => {
      await adminCall(user, "/api/admin/catalog", editor);
      setEditor(null);
      setMessage("حُفظ المحتوى. حدّث القائمة إذا لم تظهر النتيجة.");
      await reload();
    });
  }
  const rows = entries
    .filter(
      (e) =>
        e.kind === kind &&
        (!program || e.programId === program || e.id === program) &&
        (!q || e.title.includes(q) || e.description.includes(q)) &&
        (state === "all" || e.published === (state === "published")),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title, "ar")
        : a.order - b.order || a.title.localeCompare(b.title, "ar"),
    );
  const programs = entries.filter((e) => e.kind === "program");
  return (
    <div className="container page-space">
      <AdminNavigation />
      <div className="admin-heading">
        <div>
          <span className="eyebrow">المحتوى التعليمي</span>
          <h1>البرامج والمواد العلمية</h1>
          <p>
            أضف المحتوى المعتمد فقط. إخفاء البرنامج أو التصنيف يحجب دروسه عن
            الطالب.
          </p>
        </div>
        <button
          className="button button-outline"
          disabled={busy}
          onClick={() => void task(academySignOut)}
        >
          تسجيل الخروج
        </button>
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {!ready ? (
        <button
          className="button button-outline"
          onClick={() => void task(reload)}
        >
          تحميل المحتوى / إعادة المحاولة
        </button>
      ) : (
        <>
          <div className="catalog-filters">
            <label>
              النوع
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as Kind);
                  setEditor(null);
                }}
              >
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {labels[k]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              البرنامج
              <select
                value={program}
                onChange={(e) => setProgram(e.target.value)}
              >
                <option value="">جميع البرامج</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              البحث
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="عنوان أو وصف"
              />
            </label>
            <label>
              حالة النشر
              <select value={state} onChange={(e) => setState(e.target.value)}>
                <option value="all">الكل</option>
                <option value="published">منشور</option>
                <option value="draft">مسودة / مخفي</option>
              </select>
            </label>
            <label>
              الترتيب
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="order">الترتيب التعليمي</option>
                <option value="title">العنوان</option>
              </select>
            </label>
          </div>
          <div className="catalog-actions">
            <button className="button button-primary" onClick={fresh}>
              إنشاء {labels[kind]}
            </button>
            <button
              className="button button-outline"
              disabled={busy}
              onClick={() => void task(reload)}
            >
              تحديث المحتوى
            </button>
          </div>
          {editor && (
            <form onSubmit={save} className="catalog-editor login-form">
              <h2>
                {editor.version ? "تعديل" : "إنشاء"} {labels[editor.kind]}
              </h2>
              <label>
                العنوان
                <input
                  required
                  minLength={2}
                  maxLength={200}
                  value={editor.title}
                  onChange={(e) =>
                    setEditor({ ...editor, title: e.target.value })
                  }
                />
              </label>
              <label>
                الوصف
                <textarea
                  maxLength={3000}
                  value={editor.description}
                  onChange={(e) =>
                    setEditor({ ...editor, description: e.target.value })
                  }
                />
              </label>
              {editor.kind !== "program" && (
                <label>
                  برنامج المحتوى
                  <select
                    required
                    disabled={!!editor.version}
                    value={editor.programId}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        programId: e.target.value,
                        parentId: "",
                      })
                    }
                  >
                    <option value="">اختر البرنامج</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {parents[editor.kind].length > 0 && (
                <label>
                  التصنيف الأب
                  <select
                    required
                    value={editor.parentId}
                    onChange={(e) =>
                      setEditor({ ...editor, parentId: e.target.value })
                    }
                  >
                    <option value="">اختر التصنيف</option>
                    {entries
                      .filter(
                        (p) =>
                          p.programId === editor.programId &&
                          parents[editor.kind].includes(p.kind),
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {labels[p.kind]}: {p.title}
                          {!p.published ? " (مخفي)" : ""}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <label>
                ترتيب العرض
                <input
                  type="number"
                  min={0}
                  max={100000}
                  required
                  value={editor.order}
                  onChange={(e) =>
                    setEditor({ ...editor, order: Number(e.target.value) })
                  }
                />
              </label>
              {editor.kind === "lesson" && (
                <label>
                  تاريخ الدرس
                  <input
                    type="date"
                    value={editor.lessonDate}
                    onChange={(e) =>
                      setEditor({ ...editor, lessonDate: e.target.value })
                    }
                  />
                </label>
              )}
              <label className="consent-check">
                <input
                  type="checkbox"
                  checked={editor.published}
                  onChange={(e) =>
                    setEditor({ ...editor, published: e.target.checked })
                  }
                />
                منشور — إلغاء التحديد يخفيه دون حذف
              </label>
              {editor.kind === "program" && (
                <label className="consent-check">
                  <input
                    type="checkbox"
                    checked={editor.progressEnabled}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        progressEnabled: e.target.checked,
                      })
                    }
                  />
                  تفعيل متابعة إتمام الدروس
                </label>
              )}
              <div className="catalog-actions">
                <button disabled={busy} className="button button-primary">
                  حفظ المحتوى
                </button>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setEditor(null)}
                >
                  إلغاء
                </button>
              </div>
            </form>
          )}
          <div className="catalog-grid">
            {rows.map((e) => (
              <article className="catalog-card" key={e.id}>
                <span className="eyebrow">
                  {e.published ? "منشور" : "مسودة / مخفي"} · {e.order}
                </span>
                <h2>{e.title}</h2>
                <p>{e.description}</p>
                {e.lessonDate && <time>{e.lessonDate}</time>}
                <button
                  className="button button-outline"
                  onClick={() => setEditor(e)}
                >
                  تعديل {labels[e.kind]}
                </button>
              </article>
            ))}
          </div>
          {!rows.length && (
            <p className="notice">
              لا توجد نتائج. ابدأ بإضافة برنامج ثم مادته وسلسلته ودروسه.
            </p>
          )}
          <details className="catalog-editor">
            <summary>إعدادات العرض والمنطقة الزمنية</summary>
            <form
              className="login-form"
              onSubmit={(e) => {
                e.preventDefault();
                void task(async () => {
                  await adminCall(user, "/api/settings", { timeZone: zone });
                  setMessage(
                    "حُفظت المنطقة الزمنية. أعد فتح لوحة الطلبة لتحديث التوقيت.",
                  );
                });
              }}
            >
              <label>
                المنطقة الزمنية
                <input
                  dir="ltr"
                  required
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  list="timezones"
                />
                <datalist id="timezones">
                  {[
                    "Asia/Baghdad",
                    "Asia/Riyadh",
                    "Asia/Dubai",
                    "Africa/Cairo",
                    "Europe/London",
                    "UTC",
                  ].map((z) => (
                    <option key={z}>{z}</option>
                  ))}
                </datalist>
              </label>
              <button className="button button-outline" disabled={busy}>
                حفظ الإعدادات
              </button>
            </form>
          </details>
        </>
      )}
    </div>
  );
}
