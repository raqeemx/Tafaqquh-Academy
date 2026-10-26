import type { Metadata } from "next";
import { AdminArea } from "@/features/admin/admin-area";
export const metadata: Metadata = {
  title: "إدارة الأكاديمية",
  robots: { index: false, follow: false },
};
export default function AdminPage() {
  return <AdminArea />;
}
