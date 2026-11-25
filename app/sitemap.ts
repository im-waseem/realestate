import type { MetadataRoute } from "next";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://realestatewaseem.vercel.app").replace(/\/$/, "");
  const admin = createSupabaseAdminClient();
  const [agencyResult, firstPage] = await Promise.all([
    admin.from("agencies").select("id,created_at").eq("status", "active"),
    admin.from("properties").select("id,agency_id,created_at").eq("status", "published").order("created_at", { ascending: false }).range(0, 999),
  ]);
  if (agencyResult.error || firstPage.error) throw new Error("Unable to generate sitemap.");
  const activeAgencyIds = new Set((agencyResult.data || []).map((agency) => agency.id));
  const listings = [...(firstPage.data || [])];
  for (let offset = 1000; firstPage.data?.length === 1000 && offset < 50000; offset += 1000) {
    const { data, error } = await admin.from("properties").select("id,agency_id,created_at").eq("status", "published").order("created_at", { ascending: false }).range(offset, offset + 999);
    if (error) throw new Error("Unable to generate sitemap.");
    listings.push(...(data || []));
    if (data?.length !== 1000) break;
  }
  const now = new Date();
  return [
    { url: siteUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/properties`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    ...[...activeAgencyIds].map((id) => ({ url: `${siteUrl}/agency/${id}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.5 })),
    ...listings.filter((property) => activeAgencyIds.has(property.agency_id)).map((property) => ({ url: `${siteUrl}/properties/${property.id}`, lastModified: property.created_at, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
