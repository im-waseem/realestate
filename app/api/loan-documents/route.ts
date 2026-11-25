import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { hasAgencyFeature } from "@/lib/features";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const documentTypeSchema = z.enum(["id", "address", "income", "bank_statements", "property_papers"]);

function detectFileType(bytes: Buffer) {
  if (bytes.subarray(0, 5).toString("ascii") === "%PDF-") return { extension: "pdf", contentType: "application/pdf" as const };
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return { extension: "jpg", contentType: "image/jpeg" as const };
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { extension: "png", contentType: "image/png" as const };
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return { extension: "webp", contentType: "image/webp" as const };
  return null;
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || (user.role !== "super_admin" && (!user.agency_id || user.agency_status !== "active"))) {
    return Response.json({ error: "Sign in to an active agency or admin account first." }, { status: 401 });
  }
  if (!hasAgencyFeature(user, "home_loans")) {
    return Response.json({ error: "Home loans are not enabled for your agency." }, { status: 404 });
  }
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  if (Number(request.headers.get("content-length") || 0) > MAX_FILE_SIZE + 20_000) {
    return Response.json({ error: "Maximum document size is 10 MB." }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "The document upload could not be read." }, { status: 400 });
  }
  const leadId = z.string().uuid().safeParse(String(form.get("lead_id") || "").trim());
  const docType = documentTypeSchema.safeParse(String(form.get("doc_type") || ""));
  const file = form.get("file");
  if (!leadId.success || !docType.success || !(file instanceof File)) {
    return Response.json({ error: "Choose a lead, document category, and file." }, { status: 400 });
  }
  if (file.size < 1 || file.size > MAX_FILE_SIZE) {
    return Response.json({ error: "Choose a document no larger than 10 MB." }, { status: 413 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: lead, error: leadError } = await supabase
      .from("loan_leads")
      .select("id,agency_id")
      .eq("id", leadId.data)
      .maybeSingle();
    if (leadError) throw new Error(`Unable to verify the loan lead: ${leadError.message}`);
    if (!lead || (user.role !== "super_admin" && lead.agency_id !== user.agency_id)) {
      return Response.json({ error: "Home-loan lead not found." }, { status: 404 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const fileType = detectFileType(bytes);
    if (!fileType) {
      return Response.json({ error: "Only PDF, JPEG, PNG, and WebP files are supported." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const rateKey = createHash("sha256").update(`loan-doc:${user.id}`).digest("hex");
    const { data: uploadAllowed, error: rateLimitError } = await admin.rpc("realty_take_rate_limit", {
      target_key: rateKey,
      max_attempts: 30,
      window_seconds: 3600,
    });
    if (rateLimitError) throw new Error(`Unable to verify document upload limits: ${rateLimitError.message}`);
    if (!uploadAllowed) return Response.json({ error: "Hourly document upload limit reached. Try again later." }, { status: 429 });

    const filePath = `${encodeURIComponent(lead.agency_id)}/${lead.id}/${randomUUID()}.${fileType.extension}`;
    const { error: storageError } = await admin.storage.from("loan-documents").upload(filePath, bytes, {
      contentType: fileType.contentType,
      cacheControl: "0",
      upsert: false,
    });
    if (storageError) throw new Error(`Unable to save the private loan document: ${storageError.message}`);

    const fileName = (file.name.split(/[\\/]/).pop() || "loan-document")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, 150) || "loan-document";
    const { data: document, error: metadataError } = await supabase
      .from("loan_documents")
      .insert({
        lead_id: lead.id,
        agency_id: lead.agency_id,
        doc_type: docType.data,
        file_path: filePath,
        file_name: fileName,
        content_type: fileType.contentType,
        file_size: bytes.byteLength,
      })
      .select("id")
      .single();
    if (metadataError) {
      const { error: cleanupError } = await admin.storage.from("loan-documents").remove([filePath]);
      if (cleanupError) {
        throw new Error(`Document record creation failed and the uploaded file could not be removed: ${metadataError.message}; ${cleanupError.message}`);
      }
      throw new Error(`Unable to record the uploaded loan document: ${metadataError.message}`);
    }

    return Response.json({ id: document.id, message: "Document uploaded." }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Loan document upload failed." }, { status: 500 });
  }
}
