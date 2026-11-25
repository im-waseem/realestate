import { redirect } from "next/navigation";
import { requireAgencyFeature } from "@/lib/auth";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Services", robots: { index: false, follow: false } };

export default async function ServiceProvidersPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const [, query] = await Promise.all([requireAgencyFeature("tools"), searchParams]);

  const notice = query.message ? `?message=${encodeURIComponent(query.message)}` : "";
  redirect(`/dashboard${notice}#services`);
}
