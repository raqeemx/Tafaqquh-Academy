import "server-only";
import { ApiError, identity } from "./api";
import { PRIVACY_VERSION } from "@/lib/privacy/policy";
export async function acceptedStudent(request: Request) {
  const context = await identity(request);
  const profile = await context.db.doc(`students/${context.token.uid}`).get();
  if (profile.data()?.status !== "approved")
    throw new ApiError(403, "يتطلب المحتوى قبول طلب التسجيل.");
  if (profile.data()?.consentVersion !== PRIVACY_VERSION)
    throw new ApiError(403, "يرجى مراجعة سياسة الخصوصية وتأكيد الموافقة.");
  return context;
}
