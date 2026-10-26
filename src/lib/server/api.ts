import "server-only";
import { NextResponse } from "next/server";
import { getAdminServices } from "@/lib/firebase/admin";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const headers = {
  "Cache-Control": "private, no-store",
  Vary: "Authorization",
  "X-Content-Type-Options": "nosniff",
};
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers });
}
export function failure(error: unknown) {
  return error instanceof ApiError
    ? json({ error: error.message }, error.status)
    : json(
        { error: "تعذّر إتمام العملية. حاول لاحقًا أو تواصل مع الإدارة." },
        503,
      );
}
export async function identity(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ") || authorization.length > 8192)
    throw new ApiError(401, "يلزم تسجيل الدخول.");
  let services: ReturnType<typeof getAdminServices>;
  try {
    services = getAdminServices();
  } catch {
    throw new ApiError(503, "الخدمة الخلفية غير مهيأة بعد.");
  }
  try {
    const token = await services.auth.verifyIdToken(
      authorization.slice(7),
      true,
    );
    if (!token.email_verified)
      throw new ApiError(403, "يجب تأكيد البريد الإلكتروني أولًا.");
    return { ...services, token };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const code = (error as { code?: string }).code ?? "";
    if (
      code.startsWith("auth/") &&
      ![
        "auth/internal-error",
        "auth/insufficient-permission",
        "auth/invalid-credential",
      ].includes(code)
    )
      throw new ApiError(401, "الجلسة غير صالحة. سجّل الدخول مجددًا.");
    throw new ApiError(503, "تعذّر التحقق من الجلسة. حاول لاحقًا.");
  }
}
export async function administrator(request: Request, mutation = false) {
  const context = await identity(request);
  const record = await context.db
    .doc(`administrators/${context.token.uid}`)
    .get();
  if (record.data()?.active !== true || record.data()?.role !== "admin")
    throw new ApiError(403, "هذا الحساب غير مخوّل بإدارة الأكاديمية.");
  if (mutation && Date.now() / 1000 - context.token.auth_time > 3600)
    throw new ApiError(
      401,
      "لحماية القرارات الإدارية، سجّل الخروج ثم ادخل مجددًا.",
    );
  return context;
}
export function safeId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}
export async function readMutation(request: Request) {
  const expectedOrigin = process.env.APP_ORIGIN || new URL(request.url).origin;
  if (request.headers.get("origin") !== expectedOrigin)
    throw new ApiError(403, "مصدر الطلب غير مسموح.");
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
    throw new ApiError(415, "صيغة الطلب غير مدعومة.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "طلب فارغ.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 8192) {
      await reader.cancel();
      throw new ApiError(413, "الطلب أكبر من الحد المسموح.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new ApiError(400, "بيانات الطلب غير صالحة.");
  }
}
