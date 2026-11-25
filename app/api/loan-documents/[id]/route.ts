import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { hasAgencyFeature } from "@/lib/features";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || (user.role !== "super_admin" && (!user.agency_id || user.agency_status !== "active"))) {
    return Response.json({ error: "Sign in to an active agency or admin account first." }, { status: 401 });
  }
  if (!hasAgencyFeature(user, "home_loans")) {
    return Response.json({ error: "Home loans are not enabled for your agency." }, { status: 404 });
  }

  const { id } = await params;
  const validId = z.string().uuid().safeParse(id);
  if (!validId.success) return Response.json({ error: "Loan document not found." }, { status: 404 });

  const supabase = await createSupabaseServerClient();
  const { data: document, error } = await supabase
    .from("loan_documents")
    .select("file_path")
    .eq("id", validId.data)
    .maybeSingle();
  if (error) return Response.json({ error: `Unable to access the loan document: ${error.message}` }, { status: 500 });
  if (!document) return Response.json({ error: "Loan document not found." }, { status: 404 });

  const admin = createSupabaseAdminClient();
  const { data, error: signedUrlError } = await admin.storage
    .from("loan-documents")
    .createSignedUrl(document.file_path, 60);
  if (signedUrlError || !data?.signedUrl) {
    return Response.json({ error: `Unable to prepare a private document link${signedUrlError ? `: ${signedUrlError.message}` : "."}` }, { status: 500 });
  }

  const response = Response.redirect(data.signedUrl, 302);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
