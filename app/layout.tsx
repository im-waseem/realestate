import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ToasterProvider } from "@/components/dashboard/toaster";
import { Analytics } from "@vercel/analytics/next";

const inter = localFont({
  src: "../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  variable: "--font-body",
  display: "swap",
  weight: "100 900",
  fallback: ["Arial", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://realestatewaseem.vercel.app"),
  title: { default: "Waseem Realty | Good homes. Good people.", template: "%s | Waseem Realty" },
  description: "Good homes. Good people. Discover properties for sale, rent and lease, and connect with local agencies.",
  applicationName: "Waseem Realty",
  icons: { icon: "/brand-mark.svg" },
  openGraph: {
    title: "Waseem Realty | A place for your next chapter",
    description: "Thoughtful spaces. Local expertise. Find your next home with Waseem Realty.",
    siteName: "Waseem Realty",
    locale: "en_IN",
    type: "website",
    url: "/",
    images: [{ url: "/images/architecture.jpg", width: 1600, height: 1000, alt: "A light-filled Waseem Realty home" }],
  },
  twitter: { card: "summary", title: "Waseem Realty", description: "Private property listings and agency workspaces with Waseem Realty." },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#103b36" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={inter.variable}>
      <body className="app-body"><ToasterProvider>{children}</ToasterProvider><Analytics /></body>
    </html>
  );
}
