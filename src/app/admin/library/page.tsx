import { AdminArea } from "@/features/admin/admin-area";
export const metadata = {
  title: "فهرسة المكتبة العلمية",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <AdminArea section="drive" />;
}
