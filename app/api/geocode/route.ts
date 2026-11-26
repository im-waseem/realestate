import { currentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user || !["super_admin", "agency_admin"].includes(user.role) || (user.role !== "super_admin" && user.agency_status !== "approved")) return Response.json({ error: "Administrator access required." }, { status: 403 });
  const q = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (q.length < 3 || q.length > 500) return Response.json({ error: "Enter a valid office address." }, { status: 400 });
  try {
    const admin = createSupabaseAdminClient();
    const { data: allowed, error: rateLimitError } = await admin.rpc("realty_take_rate_limit", {
      target_key: "nominatim:global",
      max_attempts: 1,
      window_seconds: 2,
    });
    if (rateLimitError) {
      console.error("Unable to enforce geocoding rate limit:", rateLimitError);
      return Response.json({ error: "Address lookup is temporarily unavailable." }, { status: 503 });
    }
    if (!allowed) return Response.json({ error: "Please wait before searching again." }, { status: 429 });

    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`, { headers: { "User-Agent": "WaseemRealty/1.0 (+https://github.com/im-waseem/realestate)" }, signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!response.ok) throw new Error("Lookup unavailable");
    const data = await response.json();
    return Response.json(data.map((item: { display_name: string; lat: string; lon: string }) => ({ display_name: item.display_name, lat: item.lat, lon: item.lon })));
  } catch { return Response.json({ error: "Address lookup unavailable. Place the pin manually." }, { status: 503 }); }
}
