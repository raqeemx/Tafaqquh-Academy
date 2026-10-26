import Link from "next/link";
export function AdminNavigation() {
  return (
    <nav className="admin-navigation" aria-label="إدارة الأكاديمية">
      <Link href="/admin">الطلبة والصلاحيات</Link>
      <Link href="/admin/content">البرامج والمواد</Link>
      <Link href="/admin/library">فهرسة المكتبة</Link>
    </nav>
  );
}
