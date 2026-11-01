import { currentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(name)) return new Response("Not found", { status: 404 });

  const user = await currentUser();
  if (!user || (user.role !== "super_admin" && (!user.agency_id || user.agency_status !== "active"))) {
    return new Response("Not found", { status: 404 });
  }
  const supabase = await createSupabaseServerClient();
  const { data: upload, error: uploadError } = await supabase.from("uploads").select("agency_id").eq("name", name).maybeSingle();
  if (uploadError) return new Response("Unable to verify photo access.", { status: 500 });
  if (!upload) return new Response("Not found", { status: 404 });

  const admin = createSupabaseAdminClient();
  const { data: file, error } = await admin.storage.from("property-photos").download(name);
  if (error || !file) return new Response("Photo is unavailable.", { status: 404 });
  const type = name.endsWith(".jpg") ? "image/jpeg" : name.endsWith(".png") ? "image/png" : "image/webp";
  return new Response(file, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
