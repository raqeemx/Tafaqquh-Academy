import type { Metadata } from "next";
import { StudentArea } from "@/features/auth/student-area";
export const metadata: Metadata = {
  title: "مساحة الطالب",
  robots: { index: false, follow: false },
};
export default function StudentPage() {
  // This shell contains no restricted data. Data access is authorized separately.
  return (
    <div className="container page-space">
      <h1>مساحة الطالب</h1>
      <StudentArea />
    </div>
  );
}
