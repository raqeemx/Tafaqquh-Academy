import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { LoginForm } from "@/features/auth/login-form";
export const metadata: Metadata = {
  title: "دخول الطالب",
  robots: { index: false, follow: false },
};
export default function Login() {
  return (
    <div className="container login-layout">
      <section className="login-intro">
        <BookOpen size={48} strokeWidth={1} />
        <span className="eyebrow">مساحتك للتعلّم</span>
        <h2>
          كل عودةٍ إلى العلم
          <br />
          خطوةٌ إلى الأمام.
        </h2>
        <p>
          هنا تبدأ متابعة رحلتك التعليمية،
          <br />
          بعد إطلاق البرامج وتفعيل حسابات الطلاب.
        </p>
        <Link href="/new-student" className="text-link">
          جديد في الأكاديمية؟ تعرّف إلى البداية ←
        </Link>
      </section>
      <section className="login-card">
        <span className="eyebrow">أهلًا بعودتك</span>
        <h1>دخول الطالب</h1>
        <p>تصميم أولي لمساحة الطالب في الأكاديمية.</p>
        <LoginForm />
        <Link href="/" className="back-home">
          العودة إلى الرئيسية
        </Link>
      </section>
    </div>
  );
}
