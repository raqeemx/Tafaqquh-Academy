import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/login-form";
export const metadata: Metadata = {
  title: "إنشاء حساب طالب",
  robots: { index: false, follow: false },
};
export default function Register() {
  return (
    <div className="container page-space">
      <section className="login-card auth-single">
        <span className="eyebrow">بداية رحلتك</span>
        <h1>إنشاء حساب طالب</h1>
        <p>أرسل طلب تسجيلك، ثم أكّد بريدك وانتظر مراجعة الإدارة.</p>
        <LoginForm mode="register" />
      </section>
    </div>
  );
}
