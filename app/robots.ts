import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://realestatewaseem.vercel.app";
  return {
    rules: [{
      userAgent: "*",
      allow: ["/", "/properties/", "/agency/"],
      disallow: ["/dashboard", "/login", "/register", "/invite", "/no-access", "/api/", "/media/"],
    }],
    host: siteUrl.replace(/\/$/, ""),
    sitemap: `${siteUrl.replace(/\/$/, "")}/sitemap.xml`,
  };
}
