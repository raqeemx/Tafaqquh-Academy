import { AdminArea } from "@/features/admin/admin-area";
export const metadata = {
  title: "إدارة البرامج والمواد",
  robots: { index: false, follow: false },
};
export default function ContentPage() {
  return <AdminArea section="content" />;
}
