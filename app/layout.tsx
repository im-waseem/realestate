import type { Metadata, Viewport } from "next";
import "./dashboard-enhancements.css";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s | Waseem Realty" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0f1b33",
  colorScheme: "light",
};

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}