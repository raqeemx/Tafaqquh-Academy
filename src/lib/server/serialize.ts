import type { DocumentSnapshot } from "firebase-admin/firestore";
export function version(snapshot: DocumentSnapshot) {
  return snapshot.updateTime
    ? `${snapshot.updateTime.seconds}:${snapshot.updateTime.nanoseconds}`
    : "";
}
export function iso(value: unknown): string | null {
  return value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
    ? value.toDate().toISOString()
    : null;
}
export function studentRow(snapshot: DocumentSnapshot) {
  const data = snapshot.data()!;
  return {
    uid: snapshot.id,
    displayName: String(data.displayName ?? ""),
    email: String(data.email ?? ""),
    status: String(data.status ?? "unknown"),
    createdAt: iso(data.createdAt),
    consentVersion: String(data.consentVersion ?? ""),
    version: version(snapshot),
  };
}
