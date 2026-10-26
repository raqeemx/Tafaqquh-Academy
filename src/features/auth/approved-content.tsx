"use client";
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { getFirebaseServices } from "@/lib/firebase/client";
import type { Program } from "@/features/admin/types";
export function ApprovedContent({ user }: { user: User }) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selected, setSelected] = useState("");
  const [items, setItems] = useState<
    { id: string; title: string; body: string }[] | null
  >(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(
    () =>
      onSnapshot(
        collection(
          getFirebaseServices().db,
          "students",
          user.uid,
          "enrollments",
        ),
        () => {
          setItems(null);
          setSelected("");
          setRevision((value) => value + 1);
        },
        () => {
          setPrograms([]);
          setItems(null);
          setSelected("");
          setError("تعذّر التحقق من تسجيلات البرامج.");
        },
      ),
    [user],
  );
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      setPrograms([]);
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/student/programs", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!active) return;
        if (!response.ok) {
          setError(data.error);
          return;
        }
        setPrograms(data.programs);
      } catch {
        if (active) setError("تعذّر تحميل البرامج. أعد المحاولة.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [user, revision]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    let active = true;
    async function load() {
      setItems(null);
      setError("");
      try {
        const token = await user.getIdToken();
        const response = await fetch(
          `/api/student/content?programId=${encodeURIComponent(selected)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const data = await response.json();
        if (!active) return;
        if (!response.ok) {
          setError(data.error);
          return;
        }
        setItems(data.items);
      } catch {
        if (active) setError("تعذّر تحميل محتوى البرنامج.");
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [user, selected]);
  return (
    <section className="restricted-content">
      <div className="panel-heading">
        <h2>برامجي المتاحة</h2>
        <button
          className="text-link"
          onClick={() => {
            setSelected("");
            setItems(null);
            setRevision((value) => value + 1);
          }}
        >
          تحديث البرامج
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">جارٍ تحميل البرامج…</p>
      ) : !programs.length ? (
        <div className="notice">
          تم قبول حسابك، ولا يوجد برنامج متاح لك بعد. ستظهر البرامج هنا عندما
          تتيحها الإدارة.
        </div>
      ) : (
        <>
          <label htmlFor="student-program">اختر البرنامج</label>
          <select
            id="student-program"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">اختر برنامجًا لعرض مواده</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          {selected &&
            !error &&
            (items === null ? (
              <p role="status">جارٍ تحميل المحتوى…</p>
            ) : !items.length ? (
              <p>لا توجد مواد منشورة في هذا البرنامج حتى الآن.</p>
            ) : (
              items.map((item) => (
                <article key={item.id}>
                  <h3>{item.title}</h3>
                  <p className="whitespace-pre-wrap">{item.body}</p>
                </article>
              ))
            ))}
        </>
      )}
    </section>
  );
}
