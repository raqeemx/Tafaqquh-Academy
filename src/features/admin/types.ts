export type StudentRow = {
  uid: string;
  displayName: string;
  email: string;
  status: string;
  createdAt: string | null;
  consentVersion: string;
  version: string;
};
export type Program = { id: string; title: string };
export type Overview = {
  actor: { uid: string; email: string };
  counts: Record<string, number>;
  programs: Program[];
};
export type AuditRow = {
  id: string;
  studentUid: string;
  actorUid: string;
  actorEmail: string;
  action: string;
  from: string;
  to: string;
  reason: string;
  programId: string | null;
  at: string | null;
};
export const statusLabels: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
  suspended: "معلّق",
};
export const actionLabels: Record<string, string> = {
  approve: "قبول التسجيل",
  reject: "رفض التسجيل",
  suspend: "تعليق الوصول",
  enroll: "إتاحة برنامج",
  unenroll: "إيقاف برنامج",
};
