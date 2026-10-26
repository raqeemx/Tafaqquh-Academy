import { acceptedStudent } from "@/lib/server/student";
import { failure, json } from "@/lib/server/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { db, token } = await acceptedStudent(request);
    const enrollments = await db
      .collection(`students/${token.uid}/enrollments`)
      .where("active", "==", true)
      .limit(100)
      .get();
    const programs = enrollments.empty
      ? []
      : await db.getAll(
          ...enrollments.docs.map((doc) => db.doc(`programs/${doc.id}`)),
        );
    return json({
      programs: programs
        .filter((doc) => doc.exists && doc.data()?.published === true)
        .map((doc) => ({ id: doc.id, title: String(doc.data()?.title ?? "") })),
    });
  } catch (error) {
    return failure(error);
  }
}
