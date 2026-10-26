import { acceptedStudent } from "@/lib/server/student";
import { ApiError, failure, json, safeId } from "@/lib/server/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { db, token } = await acceptedStudent(request);
    const programId = new URL(request.url).searchParams.get("programId");
    if (!safeId(programId))
      throw new ApiError(400, "اختر برنامجًا من برامجك المتاحة.");
    const [program, enrollment] = await db.getAll(
      db.doc(`programs/${programId}`),
      db.doc(`students/${token.uid}/enrollments/${programId}`),
    );
    if (
      program.data()?.published !== true ||
      enrollment.data()?.active !== true
    )
      throw new ApiError(403, "ليس لديك تسجيل فعّال في هذا البرنامج.");
    const result = await db
      .collection("restrictedContent")
      .where("programId", "==", programId)
      .where("published", "==", true)
      .limit(50)
      .get();
    return json({
      items: result.docs.map((doc) => ({
        id: doc.id,
        title: typeof doc.data().title === "string" ? doc.data().title : "",
        body: typeof doc.data().body === "string" ? doc.data().body : "",
      })),
    });
  } catch (error) {
    return failure(error);
  }
}
