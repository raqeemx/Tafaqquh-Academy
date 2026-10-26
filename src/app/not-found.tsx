import Link from "next/link";
export default function NotFound() {
  return (
    <section className="container page-space">
      <span className="eyebrow">٤٠٤</span>
      <h1>هذه الصفحة غير موجودة.</h1>
      <p className="lead">
        يمكنك العودة إلى البداية ومتابعة استكشاف الأكاديمية.
      </p>
      <Link className="button button-primary" href="/">
        العودة إلى الرئيسية
      </Link>
    </section>
  );
}
