import { NextResponse } from "next/server";
import { getAdminServices } from "@/lib/firebase/admin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers });
}
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ") || authorization.length > 8192)
    return error("يلزم تسجيل الدخول.", 401);
  let services: ReturnType<typeof getAdminServices>;
  try {
    services = getAdminServices();
  } catch {
    return error("الخدمة غير مهيأة بعد.", 503);
  }
  let uid: string;
  try {
    const token = await services.auth.verifyIdToken(
      authorization.slice(7),
      true,
    );
    if (!token.email_verified)
      return error("يجب تأكيد البريد الإلكتروني أولًا.", 403);
    uid = token.uid;
  } catch {
    return error("الجلسة غير صالحة. سجّل الدخول مجددًا.", 401);
  }
  try {
    // Admin bypasses Rules: repeat authorization on EVERY request with live status.
    const student = await services.db.doc(`students/${uid}`).get();
    if (student.data()?.status !== "approved")
      return error("يتطلب المحتوى قبول طلب التسجيل.", 403);
    const result = await services.db
      .collection("restrictedContent")
      .where("published", "==", true)
      .limit(50)
      .get();
    return NextResponse.json(
      {
        items: result.docs.map((document) => ({
          id: document.id,
          title:
            typeof document.data().title === "string"
              ? document.data().title
              : "",
          body:
            typeof document.data().body === "string"
              ? document.data().body
              : "",
        })),
      },
      { headers },
    );
  } catch {
    return error("تعذّر تحميل المحتوى. حاول لاحقًا.", 503);
  }
}
