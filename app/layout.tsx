import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const inter = localFont({
  src: "../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  variable: "--font-body",
  display: "swap",
  weight: "100 900",
  fallback: ["Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: { default: "Waseem Realty | A place for your next chapter", template: "%s | Waseem Realty" },
  description: "Manage private property listings, agency enquiries, and your real estate team with Waseem Realty.",
  applicationName: "Waseem Realty",
  icons: { icon: "/brand-mark.svg" },
  openGraph: {
    title: "Waseem Realty | A place for your next chapter",
    description: "Thoughtful spaces. Local expertise. Find your next home with Waseem Realty.",
    siteName: "Waseem Realty",
    locale: "en_IN",
    type: "website",
  },
  twitter: { card: "summary", title: "Waseem Realty", description: "Private property listings and agency workspaces with Waseem Realty." },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#203f35" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
