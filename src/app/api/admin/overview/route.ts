import { administrator, failure, json } from "@/lib/server/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { db, token } = await administrator(request);
    const statuses = ["pending", "approved", "suspended", "rejected"];
    const [counts, programs] = await Promise.all([
      Promise.all(
        statuses.map((status) =>
          db.collection("students").where("status", "==", status).count().get(),
        ),
      ),
      db
        .collection("programs")
        .where("published", "==", true)
        .orderBy("title")
        .limit(100)
        .get(),
    ]);
    return json({
      actor: { uid: token.uid, email: token.email ?? "" },
      counts: Object.fromEntries(
        statuses.map((status, i) => [status, counts[i].data().count]),
      ),
      programs: programs.docs.map((doc) => ({
        id: doc.id,
        title: String(doc.data().title ?? ""),
      })),
    });
  } catch (error) {
    return failure(error);
  }
}
