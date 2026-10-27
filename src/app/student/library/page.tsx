import { LibraryArea } from "@/features/auth/library-area";
export const metadata = {
  title: "المكتبة العلمية للطالب",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <LibraryArea />;
}
