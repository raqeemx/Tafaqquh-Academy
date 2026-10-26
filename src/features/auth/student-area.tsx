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
import { ensureStudentProfile, renewConsent } from "./student-profile";
import { ConsentCheckbox } from "./privacy-consent";
import { PRIVACY_VERSION, isPrivacyApproved } from "@/lib/privacy/policy";
import { ApprovedContent } from "./approved-content";
import { authError } from "./errors";

type Profile = { status: string; displayName: string; consentVersion: string };
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
                    consentVersion: String(
                      snapshot.data().consentVersion ?? "",
                    ),
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
    const consent = new FormData(event.currentTarget).get("consent") === "on";
    void action(
      () => ensureStudentProfile(user, name, consent),
      "أُرسل طلبك للمراجعة.",
    );
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
          <ConsentCheckbox disabled={busy} />
          <button
            className="button button-primary"
            disabled={busy || !isPrivacyApproved()}
          >
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
                  ? "تظهر البرامج التي تتيحها الإدارة لك بعد تأكيد بريدك والموافقة الحالية."
                  : "تواصل مع إدارة الأكاديمية للاستفسار عن حالة الطلب."}
            </p>
          </div>
        )
      )}
      {profile && profile.consentVersion !== PRIVACY_VERSION && (
        <form
          className="login-form"
          onSubmit={(event) => {
            event.preventDefault();
            const agreed =
              new FormData(event.currentTarget).get("consent") === "on";
            void action(
              () => renewConsent(user, agreed),
              "حُفظت موافقتك على الإصدار الحالي.",
            );
          }}
        >
          <h2>مراجعة سياسة الخصوصية</h2>
          <ConsentCheckbox disabled={busy} />
          <button
            className="button button-primary"
            disabled={busy || !isPrivacyApproved()}
          >
            حفظ الموافقة
          </button>
        </form>
      )}
      {profile?.status === "approved" &&
        profile.consentVersion === PRIVACY_VERSION &&
        verified && <ApprovedContent user={user} />}
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
