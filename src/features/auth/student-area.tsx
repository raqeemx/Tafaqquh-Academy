"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  signOut,
  type User,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import {
  getFirebaseServices,
  isFirebaseConfigured,
} from "@/lib/firebase/client";
import { ensureStudentProfile } from "./student-profile";
import { authError } from "./errors";

type Profile = { status: string; displayName: string };
function ApprovedContent({ user }: { user: User }) {
  const [items, setItems] = useState<
    { id: string; title: string; body: string }[] | null
  >(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/student/content", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!active) return;
        if (!response.ok) {
          setError(data.error ?? "تعذّر تحميل المحتوى.");
          return;
        }
        setItems(data.items);
      } catch {
        if (active)
          setError("تعذّر الاتصال بالمحتوى. أعد تحميل الصفحة للمحاولة.");
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [user]);
  return (
    <section className="restricted-content">
      <h2>المحتوى التعليمي</h2>
      {error ? (
        <p role="alert">{error}</p>
      ) : items === null ? (
        <p role="status">جارٍ تحميل المحتوى…</p>
      ) : !items.length ? (
        <p>لا يوجد محتوى منشور حتى الآن.</p>
      ) : (
        items.map((item) => (
          <article key={item.id}>
            <h3>{item.title}</h3>
            <p className="whitespace-pre-wrap">{item.body}</p>
          </article>
        ))
      )}
    </section>
  );
}

export function StudentArea() {
  const ready = isFirebaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(ready);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!ready) return;
    let stopProfile = () => {};
    const { auth, db } = getFirebaseServices();
    const stopAuth = onAuthStateChanged(
      auth,
      (current) => {
        stopProfile();
        setUser(current);
        setVerified(Boolean(current?.emailVerified));
        setProfile(undefined);
        if (!current) {
          setLoading(false);
          return;
        }
        setLoading(true);
        stopProfile = onSnapshot(
          doc(db, "students", current.uid),
          (snapshot) => {
            setProfile(
              snapshot.exists()
                ? {
                    status: String(snapshot.data().status),
                    displayName: String(snapshot.data().displayName),
                  }
                : null,
            );
            setLoading(false);
          },
          (error) => {
            setProfile(undefined);
            setLoading(false);
            setMessage(authError(error));
          },
        );
      },
      (error) => {
        setLoading(false);
        setMessage(authError(error));
      },
    );
    return () => {
      stopAuth();
      stopProfile();
    };
  }, [ready]);
  async function action(operation: () => Promise<void>, success = "") {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await operation();
      setMessage(success);
    } catch (error) {
      setMessage(authError(error));
    } finally {
      setBusy(false);
    }
  }
  function complete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const name = String(new FormData(event.currentTarget).get("name") ?? "");
    void action(() => ensureStudentProfile(user, name), "أُرسل طلبك للمراجعة.");
  }
  if (!ready)
    return (
      <div className="notice student-status">
        الخدمة غير مهيأة بعد. ستتاح مساحة الطالب بعد اكتمال الإعداد.
      </div>
    );
  if (loading) return <p role="status">جارٍ التحقق من حسابك…</p>;
  if (!user)
    return (
      <div className="student-status">
        <p>سجّل الدخول للاطّلاع على حالة طلبك.</p>
        <Link className="button button-primary" href="/login">
          دخول الطالب
        </Link>
      </div>
    );
  return (
    <div className="student-status">
      <p dir="ltr" className="text-start">
        {user.email}
      </p>
      <p role="status">{message}</p>
      {!verified && (
        <div className="notice">
          <p>أكّد بريدك الإلكتروني قبل الوصول إلى المحتوى، حتى لو قُبل طلبك.</p>
          <div className="actions">
            <button
              className="button button-outline"
              disabled={busy}
              onClick={() =>
                void action(
                  () => sendEmailVerification(user),
                  "أُرسلت رسالة التحقق. راجع بريدك والرسائل غير المرغوب فيها.",
                )
              }
            >
              إرسال رسالة التحقق
            </button>
            <button
              className="button button-outline"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  await reload(user);
                  await user.getIdToken(true);
                  setVerified(user.emailVerified);
                }, "تم تحديث حالة البريد.")
              }
            >
              تحقّقت من بريدي
            </button>
          </div>
        </div>
      )}
      {profile === null ? (
        <form className="login-form" onSubmit={complete}>
          <p>
            حسابك موجود، لكن طلب التسجيل لم يكتمل. أكمل الاسم لإعادة إرسال الطلب
            دون إنشاء حساب آخر.
          </p>
          <label htmlFor="name">الاسم الكامل</label>
          <input
            id="name"
            name="name"
            minLength={2}
            maxLength={100}
            defaultValue={user.displayName ?? ""}
            required
          />
          <button className="button button-primary" disabled={busy}>
            إكمال طلب التسجيل
          </button>
        </form>
      ) : (
        profile && (
          <div className="notice">
            <h2>
              {profile.status === "approved"
                ? "تم قبول تسجيلك"
                : profile.status === "pending"
                  ? "طلبك قيد المراجعة"
                  : profile.status === "rejected"
                    ? "لم يُقبل طلب التسجيل"
                    : profile.status === "suspended"
                      ? "الوصول معلّق"
                      : "الوصول غير متاح"}
            </h2>
            <p>
              {profile.status === "pending"
                ? "ستراجع الإدارة طلبك. لا يتاح المحتوى المقيد قبل القبول وتأكيد البريد."
                : profile.status === "approved"
                  ? "يمكنك الاطّلاع على المحتوى المنشور بعد تأكيد بريدك."
                  : "تواصل مع إدارة الأكاديمية للاستفسار عن حالة الطلب."}
            </p>
          </div>
        )
      )}
      {profile?.status === "approved" && verified && (
        <ApprovedContent user={user} />
      )}
      <button
        className="button button-outline"
        disabled={busy}
        onClick={() => void action(() => signOut(getFirebaseServices().auth))}
      >
        تسجيل الخروج
      </button>
    </div>
  );
}
