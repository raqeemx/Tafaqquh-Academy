"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { ShieldCheck } from "lucide-react";
import {
  getFirebaseServices,
  isFirebaseConfigured,
} from "@/lib/firebase/client";
import { LoginForm } from "@/features/auth/login-form";
import { AdminDashboard } from "./dashboard";
import { ContentManager } from "./content-manager";
export function AdminArea({
  section = "students",
}: {
  section?: "students" | "content";
}) {
  const ready = isFirebaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(ready);
  useEffect(() => {
    if (!ready) return;
    return onAuthStateChanged(getFirebaseServices().auth, (current) => {
      setUser(current);
      setLoading(false);
    });
  }, [ready]);
  if (loading)
    return (
      <p className="container page-space" role="status">
        جارٍ التحقق من الجلسة…
      </p>
    );
  if (!user)
    return (
      <div className="container page-space">
        <section className="login-card auth-single">
          <ShieldCheck size={36} />
          <span className="eyebrow">دخول مخصص للمسؤولين</span>
          <h1>إدارة الأكاديمية</h1>
          <p>
            استخدم حسابًا موثّق البريد ومخوّلًا من إدارة المشروع. إنشاء حساب
            طالب لا يمنح صلاحية الإدارة.
          </p>
          <LoginForm destination="/admin" />
        </section>
      </div>
    );
  return section === "content" ? (
    <ContentManager key={user.uid} user={user} />
  ) : (
    <AdminDashboard key={user.uid} user={user} />
  );
}
