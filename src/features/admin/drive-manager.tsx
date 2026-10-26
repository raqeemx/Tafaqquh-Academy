"use client";
import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import type { CatalogEntry } from "@/lib/catalog/model";
import { adminCall } from "./client-api";
import { loadCatalog } from "./content-manager";
import { AdminNavigation } from "./navigation";
type Candidate = {
  id: string;
  name: string;
  title: string;
  path: string;
  category: string;
  number: number | null;
  webViewLink: string;
  approved: boolean;
};
type Preview = {
  scan: { id: string; done: boolean; count: number; rootId: string };
  candidates: Candidate[];
  next: string | null;
};
export function DriveManager({ user }: { user: User }) {
  const [roots, setRoots] = useState<{ id: string; name: string }[]>([]);
  const [rootId, setRootId] = useState("");
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [scanId, setScanId] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const stop = useRef(false);
  useEffect(() => {
    let active = true;
    void Promise.all([
      adminCall<{ roots: { id: string; name: string }[] }>(
        user,
        "/api/admin/drive",
      ),
      loadCatalog(user),
    ])
      .then(([r, c]) => {
        if (active) {
          setRoots(r.roots);
          setRootId(r.roots[0]?.id ?? "");
          setEntries(c);
          setScanId(sessionStorage.getItem(`drive-scan-${user.uid}`) ?? "");
        }
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      });
    return () => {
      active = false;
      stop.current = true;
    };
  }, [user]);
  async function load(id: string, after?: string) {
    const data = await adminCall<Preview>(
      user,
      `/api/admin/drive?scan=${id}${after ? `&after=${after}` : ""}`,
    );
    setPreview(data);
    setSelected([]);
    return data;
  }
  async function task(work: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await work();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "تعذّرت العملية.");
    } finally {
      setBusy(false);
    }
  }
  async function scan(fresh: boolean) {
    await task(async () => {
      stop.current = false;
      const id = fresh ? crypto.randomUUID() : scanId;
      if (fresh) {
        await adminCall(user, "/api/admin/drive", {
          action: "start",
          scanId: id,
          rootId,
        });
        setScanId(id);
        sessionStorage.setItem(`drive-scan-${user.uid}`, id);
      }
      let done = (await load(id)).scan.done;
      let batches = 0;
      while (!done && !stop.current) {
        const r = await adminCall<{ done: boolean }>(user, "/api/admin/drive", {
          action: "step",
          scanId: id,
        });
        done = r.done;
        setMessage(`قراءة المجلدات — الدفعة ${++batches}`);
      }
      await load(id);
      setMessage(
        done
          ? "اكتملت المعاينة. راجع العناوين والتصنيفات ثم اعتمد المحدد كمسودات."
          : "توقفت القراءة مؤقتًا؛ يمكنك استئنافها.",
      );
    });
  }
  async function approve() {
    if (!preview) return;
    await task(async () => {
      let count = 0;
      for (const c of preview.candidates.filter((c) =>
        selected.includes(c.id),
      )) {
        const seriesId = mapping[c.category];
        if (!seriesId) throw new Error("اختر سلسلة لكل تصنيف محدد أولًا.");
        await adminCall(user, "/api/admin/drive", {
          action: "approve",
          scanId,
          fileId: c.id,
          seriesId,
          title: c.title,
          order: c.number ?? 0,
        });
        count++;
      }
      await load(scanId);
      setMessage(
        `اعتمد ${count} تسجيلًا. الموجود سابقًا يحتفظ بعنوانه وتصنيفه وحالة نشره؛ تُحدّث بيانات المصدر فقط.`,
      );
    });
  }
  return (
    <div className="container page-space">
      <AdminNavigation />
      <span className="eyebrow">فهرسة دون نقل الملفات</span>
      <h1>المكتبة العلمية — الاستيراد</h1>
      <p>
        نقرأ المجلدات والتسجيلات فقط. لا نحذف الملفات ولا ننقلها ولا نغير
        صلاحياتها. جميع الدروس الجديدة مسودات حتى تعتمد نشرها.
      </p>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <div className="catalog-editor login-form">
        <label>
          المجلد الرئيسي
          <select value={rootId} onChange={(e) => setRootId(e.target.value)}>
            {roots.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          معرف مجلد فرعي اختياري داخل النطاق
          <input
            dir="ltr"
            value={rootId}
            onChange={(e) => setRootId(e.target.value)}
          />
        </label>
        <div className="catalog-actions">
          <button
            disabled={busy || !rootId}
            className="button button-primary"
            onClick={() => void scan(true)}
          >
            بدء معاينة جديدة
          </button>
          {busy && (
            <button
              className="button button-outline"
              onClick={() => {
                stop.current = true;
              }}
            >
              إيقاف بعد الدفعة الحالية
            </button>
          )}
        </div>
        <label>
          معرف المعاينة للاستئناف
          <input
            dir="ltr"
            value={scanId}
            onChange={(e) => setScanId(e.target.value)}
          />
        </label>
        <button
          disabled={busy || !scanId}
          className="button button-outline"
          onClick={() => void scan(false)}
        >
          استئناف / عرض المعاينة
        </button>
      </div>
      {preview && (
        <>
          <p>
            التسجيلات المكتشفة: {preview.scan.count} ·{" "}
            {preview.scan.done ? "اكتملت القراءة" : "القراءة غير مكتملة"}
          </p>
          <div className="catalog-grid">
            {preview.candidates.map((c) => (
              <article className="catalog-card login-form" key={c.id}>
                <span className="eyebrow">
                  {c.approved ? "اعتمد سابقًا" : "بانتظار المراجعة"}
                </span>
                <p>{c.path}</p>
                <label>
                  عنوان التسجيل
                  <input
                    maxLength={200}
                    value={c.title}
                    onChange={(e) =>
                      setPreview({
                        ...preview,
                        candidates: preview.candidates.map((x) =>
                          x.id === c.id ? { ...x, title: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  رقم الدرس
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    value={c.number ?? ""}
                    onChange={(e) =>
                      setPreview({
                        ...preview,
                        candidates: preview.candidates.map((x) =>
                          x.id === c.id
                            ? {
                                ...x,
                                number:
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                              }
                            : x,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  سلسلة التصنيف: {c.category}
                  <select
                    value={mapping[c.category] ?? ""}
                    onChange={(e) =>
                      setMapping({ ...mapping, [c.category]: e.target.value })
                    }
                  >
                    <option value="">
                      اختر سلسلة أنشأتها في إدارة المحتوى
                    </option>
                    {entries
                      .filter((e) => e.kind === "series")
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {entries.find((p) => p.id === s.programId)?.title} /{" "}
                          {s.title}
                        </option>
                      ))}
                  </select>
                </label>
                <a
                  href={c.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  معاينة المصدر في Drive (للمسؤول)
                </a>
                <label className="consent-check">
                  <input
                    type="checkbox"
                    checked={selected.includes(c.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, c.id]
                          : selected.filter((id) => id !== c.id),
                      )
                    }
                  />
                  راجعت التسجيل وأوافق على فهرسته
                </label>
              </article>
            ))}
          </div>
          <div className="catalog-actions">
            <button
              disabled={busy || !preview.scan.done || !selected.length}
              className="button button-primary"
              onClick={() => void approve()}
            >
              اعتماد المحدد كمسودات
            </button>
            <button
              disabled={busy}
              className="button button-outline"
              onClick={() =>
                void task(async () => {
                  await load(scanId);
                })
              }
            >
              أول صفحة
            </button>
            {preview.next && (
              <button
                disabled={busy}
                className="button button-outline"
                onClick={() =>
                  void task(async () => {
                    await load(scanId, preview.next!);
                  })
                }
              >
                الصفحة التالية
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
