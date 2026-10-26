"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import {
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import {
  getFirebaseServices,
  isFirebaseConfigured,
} from "@/lib/firebase/client";
import { ensureStudentProfile } from "./student-profile";
import { authError } from "./errors";
import { ConsentCheckbox } from "./privacy-consent";
import { isPrivacyApproved } from "@/lib/privacy/policy";

export function LoginForm({
  mode = "login",
  destination = "/student",
}: {
  mode?: "login" | "register";
  destination?: "/student" | "/admin";
}) {
  const router = useRouter();
  const register = mode === "register";
  const ready = isFirebaseConfigured() && (!register || isPrivacyApproved());
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy) return;
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    const name = String(data.get("displayName") ?? "").trim();
    if (
      register &&
      (password !== data.get("confirmation") ||
        name.length < 2 ||
        data.get("consent") !== "on")
    ) {
      setMessage(
        "تحقق من الاسم وتطابق كلمتي المرور والموافقة على سياسة الخصوصية.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const { auth } = getFirebaseServices();
      await setPersistence(auth, browserSessionPersistence);
      if (register) {
        const { user } = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );
        // Auth and Firestore are not atomic. The student page can recover a missing profile.
        try {
          await updateProfile(user, { displayName: name });
          await ensureStudentProfile(user, name, true);
          await sendEmailVerification(user);
        } catch {
          router.replace("/student?complete=1");
          return;
        }
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      router.replace(destination);
    } catch (error) {
      setMessage(authError(error));
    } finally {
      setBusy(false);
    }
  }
  async function resetPassword() {
    if (!ready || busy) return;
    if (!email.trim()) {
      setMessage("اكتب بريدك الإلكتروني أولًا.");
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(getFirebaseServices().auth, email.trim());
      setMessage(
        "إذا كان البريد مرتبطًا بحساب، فستصلك رسالة استعادة كلمة المرور.",
      );
    } catch (error) {
      const code = (error as { code?: string }).code;
      setMessage(
        code === "auth/user-not-found"
          ? "إذا كان البريد مرتبطًا بحساب، فستصلك رسالة استعادة كلمة المرور."
          : authError(error),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="login-form" aria-busy={busy}>
      {!ready && (
        <div className="notice" role="status">
          التسجيل والدخول غير متاحين حتى اكتمال إعداد الخدمة. لن تُرسل بياناتك.
        </div>
      )}
      {register && (
        <>
          <label htmlFor="displayName">الاسم الكامل</label>
          <input
            id="displayName"
            name="displayName"
            autoComplete="name"
            minLength={2}
            maxLength={100}
            required
            disabled={!ready || busy}
          />
        </>
      )}
      <label htmlFor="email">البريد الإلكتروني</label>
      <input
        id="email"
        name="email"
        type="email"
        dir="ltr"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="name@example.com"
        required
        disabled={!ready || busy}
      />
      <label htmlFor="password">كلمة المرور</label>
      <div className="password-wrap">
        <input
          id="password"
          name="password"
          type={visible ? "text" : "password"}
          dir="ltr"
          autoComplete={register ? "new-password" : "current-password"}
          minLength={register ? 8 : undefined}
          required
          disabled={!ready || busy}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
      {register && (
        <>
          <label htmlFor="confirmation">تأكيد كلمة المرور</label>
          <input
            id="confirmation"
            name="confirmation"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={!ready || busy}
          />
          <p className="quiet">
            ثمانية أحرف على الأقل. إنشاء الحساب لا يعني قبول التسجيل؛ يلزم تأكيد
            البريد وموافقة الإدارة.
          </p>
          <ConsentCheckbox disabled={!ready || busy} />
        </>
      )}
      <button
        className="button button-primary"
        type="submit"
        disabled={!ready || busy}
      >
        {busy ? "جارٍ الإرسال…" : register ? "إنشاء حساب طالب" : "تسجيل الدخول"}
        <ArrowLeft size={18} />
      </button>
      <p role="status" className="form-status">
        {message}
      </p>
      {!register && (
        <button
          className="text-link"
          type="button"
          onClick={resetPassword}
          disabled={!ready || busy}
        >
          نسيت كلمة المرور؟
        </button>
      )}
      {destination !== "/admin" && (
        <Link className="back-home" href={register ? "/login" : "/register"}>
          {register ? "لديك حساب؟ سجّل الدخول" : "طالب جديد؟ أنشئ حسابًا"}
        </Link>
      )}
    </form>
  );
}
