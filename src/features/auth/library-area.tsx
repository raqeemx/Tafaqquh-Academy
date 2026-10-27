"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, collection, onSnapshot } from "firebase/firestore";
import {
  getFirebaseServices,
  isFirebaseConfigured,
} from "@/lib/firebase/client";
import { labels, type Kind } from "@/lib/catalog/model";
import { adminCall as request } from "@/features/admin/client-api";
import { RecordingPlayer } from "./recording-player";
type Item = {
  id: string;
  kind: Kind;
  title: string;
  description: string;
  parentId: string;
  order: number;
  lessonDate: string;
  hasRecording: boolean;
  mediaKind: "audio" | "video" | null;
  completed: boolean;
};
export function LibraryArea() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured());
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    return onAuthStateChanged(getFirebaseServices().auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);
  return (
    <div className="container page-space">
      <span className="eyebrow">دراسة بإذن واضح</span>
      <h1>المكتبة العلمية</h1>
      {loading ? (
        <p role="status">جارٍ التحقق من الحساب…</p>
      ) : user ? (
        <LibraryView key={user.uid} user={user} />
      ) : (
        <div className="notice">
          <p>سجّل الدخول بحساب طالب موثّق ومقبول للاطلاع على برامجك.</p>
          <Link className="button button-primary" href="/login">
            تسجيل الدخول للمكتبة
          </Link>
        </div>
      )}
    </div>
  );
}
function LibraryView({ user }: { user: User }) {
  const [programs, setPrograms] = useState<{ id: string; title: string }[]>([]);
  const [programId, setProgramId] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [parent, setParent] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [progress, setProgress] = useState(false);
  const [consent, setConsent] = useState(false);
  const [url, setUrl] = useState("");
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const { db } = getFirebaseServices();
    const reset = () => {
      setItems([]);
      setSelected(null);
      setUrl("");
      setProgramId("");
      setRevision((v) => v + 1);
    };
    const a = onSnapshot(doc(db, "students", user.uid), reset, reset);
    const b = onSnapshot(
      collection(db, "students", user.uid, "enrollments"),
      reset,
      reset,
    );
    return () => {
      a();
      b();
    };
  }, [user]);
  useEffect(() => {
    let active = true;
    void request<{ programs: { id: string; title: string }[] }>(
      user,
      "/api/student/programs",
    )
      .then((d) => {
        if (active) {
          setPrograms(d.programs);
          setLoading(false);
          setError("");
        }
      })
      .catch((e) => {
        if (active) {
          setPrograms([]);
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [user, revision]);
  useEffect(() => {
    if (!programId) return;
    let active = true;
    async function load() {
      let after: string | null = null;
      const all: Item[] = [];
      let enabled = false;
      do {
        const r: {
          entries: Item[];
          next: string | null;
          progressEnabled: boolean;
        } = await request(
          user,
          `/api/student/library?programId=${programId}${after ? `&after=${after}` : ""}`,
        );
        all.push(...r.entries);
        after = r.next;
        enabled = r.progressEnabled;
      } while (after && active);
      if (active) {
        setItems(all);
        setProgress(enabled);
        setError("");
      }
    }
    void load().catch((e) => {
      if (active) {
        setItems([]);
        setSelected(null);
        setUrl("");
        setError(e.message);
      }
    });
    return () => {
      active = false;
    };
  }, [user, programId, revision]);
  useEffect(() => {
    if (!url || !selected) return;
    const timer = setInterval(() => {
      void request(user, "/api/student/media-session", {
        lessonId: selected,
      }).catch((e) => {
        setUrl("");
        setError(e.message);
      });
    }, 240000);
    return () => clearInterval(timer);
  }, [user, url, selected]);
  async function play(id: string) {
    setBusy(true);
    setError("");
    setUrl("");
    try {
      const r = await request<{ url: string }>(
        user,
        "/api/student/media-session",
        { lessonId: id },
      );
      setUrl(r.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر التشغيل.");
    } finally {
      setBusy(false);
    }
  }
  async function mark(item: Item) {
    setBusy(true);
    try {
      await request(user, "/api/student/progress", {
        lessonId: item.id,
        completed: !item.completed,
        consent,
      });
      setItems((old) =>
        old.map((i) =>
          i.id === item.id ? { ...i, completed: !i.completed } : i,
        ),
      );
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر حفظ التقدم.");
    } finally {
      setBusy(false);
    }
  }
  function choose(id: string | null) {
    setSelected(id);
    setUrl("");
    setError("");
  }
  const lesson = items.find((i) => i.id === selected);
  const siblings = items
    .filter((i) => i.kind === "lesson" && i.parentId === lesson?.parentId)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "ar"));
  const index = siblings.findIndex((i) => i.id === selected);
  const shown = items
    .filter((i) =>
      q
        ? i.kind === "lesson" &&
          (i.title.includes(q) || i.description.includes(q))
        : i.parentId === parent,
    )
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "ar"));
  return (
    <>
      <div className="catalog-actions">
        <Link className="button button-outline" href="/student">
          حالة حسابي
        </Link>
        <button
          className="button button-outline"
          onClick={() => {
            setItems([]);
            setUrl("");
            setSelected(null);
            setRevision((v) => v + 1);
          }}
        >
          تحديث المكتبة
        </button>
        <button
          className="button button-outline"
          onClick={() => {
            void fetch("/api/student/media-session", {
              method: "DELETE",
            }).finally(() => signOut(getFirebaseServices().auth));
          }}
        >
          تسجيل الخروج
        </button>
      </div>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {loading && <p role="status">جارٍ تحميل برامجك…</p>}
      <div className="catalog-filters">
        <label>
          برامجي المصرح بها
          <select
            value={programId}
            onChange={(e) => {
              setProgramId(e.target.value);
              setItems([]);
              setParent("");
              setSelected(null);
              setUrl("");
              setQ("");
            }}
          >
            <option value="">اختر برنامجًا</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          ابحث عن درس في البرنامج
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              choose(null);
            }}
            placeholder="عنوان أو وصف الدرس"
          />
        </label>
      </div>
      {programId && (
        <>
          <div className="catalog-actions">
            <button
              className="text-link"
              onClick={() => {
                setParent("");
                setQ("");
                choose(null);
              }}
            >
              كل مواد البرنامج
            </button>
            {parent && <span>{items.find((i) => i.id === parent)?.title}</span>}
          </div>
          {lesson ? (
            <article className="catalog-editor">
              <span className="eyebrow">الدرس {lesson.order}</span>
              <h2>{lesson.title}</h2>
              {lesson.lessonDate && <time>{lesson.lessonDate}</time>}
              <p className="whitespace-pre-wrap">{lesson.description}</p>
              {lesson.hasRecording ? (
                <>
                  <button
                    disabled={busy}
                    className="button button-primary"
                    onClick={() => void play(lesson.id)}
                  >
                    فتح التسجيل / تجديد الإذن
                  </button>
                  {url && (
                    <RecordingPlayer
                      key={url}
                      url={url}
                      kind={lesson.mediaKind}
                      onError={() =>
                        setError(
                          "تعذّر تشغيل التسجيل. جرّب تجديد الإذن؛ قد يكون المصدر غير مهيأ أو إذنه غير متاح.",
                        )
                      }
                    />
                  )}
                </>
              ) : (
                <p className="notice">لم يُربط تسجيل بهذا الدرس بعد.</p>
              )}
              {progress && (
                <div className="notice">
                  <label className="consent-check">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    أوافق على حفظ علامة إتمام الدرس وتاريخها في حسابي.
                  </label>
                  <Link href="/privacy">تفاصيل الخصوصية</Link>
                  <button
                    className="button button-outline"
                    disabled={busy || (!lesson.completed && !consent)}
                    onClick={() => void mark(lesson)}
                  >
                    {lesson.completed ? "مسح علامة الإتمام" : "وضع علامة مكتمل"}
                  </button>
                </div>
              )}
              <div className="catalog-actions">
                <button
                  disabled={index <= 0}
                  className="button button-outline"
                  onClick={() => choose(siblings[index - 1].id)}
                >
                  الدرس السابق
                </button>
                <button
                  disabled={index < 0 || index >= siblings.length - 1}
                  className="button button-outline"
                  onClick={() => choose(siblings[index + 1].id)}
                >
                  الدرس التالي
                </button>
                <button className="text-link" onClick={() => choose(null)}>
                  العودة إلى القائمة
                </button>
              </div>
            </article>
          ) : (
            <div className="catalog-grid">
              {shown.map((i) => (
                <article className="catalog-card" key={i.id}>
                  <span className="eyebrow">
                    {labels[i.kind]} · {i.order}
                    {i.completed ? " · مكتمل" : ""}
                  </span>
                  <h2>{i.title}</h2>
                  <p>{i.description}</p>
                  <button
                    className="button button-outline"
                    onClick={() => {
                      if (i.kind === "lesson") choose(i.id);
                      else {
                        setParent(i.id);
                        setQ("");
                        choose(null);
                      }
                    }}
                  >
                    {i.kind === "lesson" ? "عرض الدرس" : "تصفح المحتوى"}
                  </button>
                </article>
              ))}
            </div>
          )}
          {!items.length && !error && (
            <p className="notice">لا توجد مواد منشورة متاحة في هذا البرنامج.</p>
          )}
          {!!items.length && !shown.length && !lesson && (
            <p>لا توجد نتائج مطابقة.</p>
          )}
        </>
      )}
      {!programs.length && !loading && !error && (
        <p className="notice">لا توجد برامج متاحة لحسابك بعد.</p>
      )}
    </>
  );
}
