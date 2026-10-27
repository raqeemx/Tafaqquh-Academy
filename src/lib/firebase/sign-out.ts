"use client";
import { signOut } from "firebase/auth";
import { getFirebaseServices } from "./client";
export async function academySignOut() {
  try {
    const r = await fetch("/api/student/recordings", {
      method: "DELETE",
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error("revocation-failed");
  } catch {
    throw new Error(
      "تعذّر إلغاء إذن التشغيل؛ لم يكتمل تسجيل الخروج. أعد المحاولة عند توفر الاتصال.",
    );
  }
  await signOut(getFirebaseServices().auth);
}
