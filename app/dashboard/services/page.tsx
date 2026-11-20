import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export default async function ServiceProvidersPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const [user, query] = await Promise.all([requireUser(), searchParams]);
  if (user.role === "super_admin" || !user.agency_id) notFound();

  const notice = query.message ? `?message=${encodeURIComponent(query.message)}` : "";
  redirect(`/dashboard${notice}#services`);
}
