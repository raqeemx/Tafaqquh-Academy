import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "أكاديمية تفقّه | بداية راسخة في العلم الشرعي",
    template: "%s | أكاديمية تفقّه",
  },
  description:
    "منصة عربية للتعلّم الشرعي المتدرّج. تعرّف إلى منهج التعلّم وخطوات بداية رحلتك العلمية.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <a className="skip-link" href="#main">
          انتقل إلى المحتوى
        </a>
        <SiteHeader />
        <main id="main" className="min-h-[60vh]">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
