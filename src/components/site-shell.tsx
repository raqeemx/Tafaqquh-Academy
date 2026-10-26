import Link from "next/link";
import { BookOpen, ArrowUpLeft } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label="أكاديمية تفقّه — الرئيسية">
          <span className="brand-icon">
            <BookOpen size={25} />
          </span>
          <span>
            تفقّه<small>أكاديمية العلوم الشرعية</small>
          </span>
        </Link>
        <nav aria-label="القائمة الرئيسية">
          <Link href="/">الرئيسية</Link>
          <Link href="/#approach">منهج التعلّم</Link>
          <Link href="/new-student">أنا طالب جديد</Link>
        </nav>
        <Link href="/login" className="button button-outline header-login">
          دخول الطالب <ArrowUpLeft size={16} />
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="brand">
          تفقّه <small>علمٌ يؤصّل، وفهمٌ يبني.</small>
        </div>
        <p>الوصول إلى البرامج بعد تأكيد البريد وقبول التسجيل</p>
        <Link href="/privacy">سياسة الخصوصية</Link>
        <Link href="/admin">الإدارة</Link>
        <Link href="/new-student">
          دليل البداية <span aria-hidden="true">←</span>
        </Link>
      </div>
    </footer>
  );
}
