"use client";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, ArrowLeft, LockKeyhole } from "lucide-react";
export function LoginForm() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("تسجيل الدخول غير مفعّل بعد. لم تُرسل بياناتك أو تُحفظ.");
  }
  return (
    <form onSubmit={submit} className="login-form">
      <div className="notice" id="login-notice">
        <LockKeyhole size={18} /> نموذج أولي: تسجيل الدخول غير مفعّل. لا تدخل
        بياناتك الحقيقية.
      </div>
      <label htmlFor="email">البريد الإلكتروني</label>
      <input
        id="email"
        name="email"
        type="email"
        dir="ltr"
        autoComplete="off"
        placeholder="name@example.com"
        required
        aria-describedby="login-notice"
      />
      <label htmlFor="password">كلمة المرور</label>
      <div className="password-wrap">
        <input
          id="password"
          name="password"
          type={visible ? "text" : "password"}
          dir="ltr"
          autoComplete="off"
          minLength={8}
          required
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
      <p className="quiet">ثمانية أحرف على الأقل لمعاينة التحقق من الحقول.</p>
      <button className="button button-primary" type="submit">
        معاينة تسجيل الدخول <ArrowLeft size={18} />
      </button>
      <p role="status" className="form-status">
        {message}
      </p>
    </form>
  );
}
