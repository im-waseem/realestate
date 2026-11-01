import { createHash, randomUUID } from "node:crypto";
import { currentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || (user.role !== "super_admin" && (!user.agency_id || user.agency_status !== "active"))) {
    return Response.json({ error: "Sign in to an active agency or admin account first." }, { status: 401 });
  }
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  if (Number(request.headers.get("content-length") || 0) > 5 * 1024 * 1024 + 20_000) {
    return Response.json({ error: "Maximum image size is 5 MB." }, { status: 413 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size > 5 * 1024 * 1024 || file.size < 12) {
      return Response.json({ error: "Choose a JPEG, PNG, or WebP image under 5 MB." }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const extension = bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
      ? "jpg"
      : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ? "png"
        : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"
          ? "webp"
          : null;
    if (!extension) return Response.json({ error: "Only JPEG, PNG, and WebP images are supported." }, { status: 400 });

    const supabase = await createSupabaseServerClient();
    const agencyId = user.role === "super_admin" ? String(form.get("agency_id") || "") : user.agency_id;
    if (!agencyId) return Response.json({ error: "Select an agency for this photo." }, { status: 400 });
    const { data: agency, error: agencyError } = await supabase.from("agencies").select("id,status").eq("id", agencyId).maybeSingle();
    if (agencyError) throw new Error(`Unable to verify the selected agency: ${agencyError.message}`);
    if (!agency || (user.role !== "super_admin" && agency.status !== "active")) {
      return Response.json({ error: "Select a valid active agency for this photo." }, { status: 400 });
    }

    const name = `${randomUUID()}.${extension}`;
    const admin = createSupabaseAdminClient();
    const rateKey = createHash("sha256").update(`upload:${user.id}`).digest("hex");
    const { data: uploadAllowed, error: rateLimitError } = await admin.rpc("realty_take_rate_limit", {
      target_key: rateKey,
      max_attempts: 60,
      window_seconds: 3600,
    });
    if (rateLimitError) throw new Error(`Unable to verify upload limits: ${rateLimitError.message}`);
    if (!uploadAllowed) return Response.json({ error: "Hourly upload limit reached. Try again later." }, { status: 429 });
    const { error: uploadError } = await admin.storage.from("property-photos").upload(name, bytes, {
      contentType: extension === "jpg" ? "image/jpeg" : `image/${extension}`,
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) throw new Error(`Unable to save the uploaded photo: ${uploadError.message}`);

    const { error: metadataError } = await supabase.from("uploads").insert({ name, agency_id: agencyId });
    if (metadataError) {
      const { error: cleanupError } = await admin.storage.from("property-photos").remove([name]);
      if (cleanupError) throw new Error(`Photo metadata failed and storage cleanup failed: ${metadataError.message}; ${cleanupError.message}`);
      throw new Error(`Unable to assign the photo to its agency: ${metadataError.message}`);
    }
    return Response.json({ url: `/media/${name}` }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Photo upload failed." }, { status: 500 });
  }
}
