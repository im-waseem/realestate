import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

export async function refreshSupabaseSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const isDashboard = request.nextUrl.pathname === "/dashboard" || request.nextUrl.pathname.startsWith("/dashboard/");
  if (!user && isDashboard) {
    const loginUrl = request.nextUrl.clone();
    const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", next);
    const redirectResponse = NextResponse.redirect(loginUrl);
    for (const cookie of response.cookies.getAll()) redirectResponse.cookies.set(cookie);
    return redirectResponse;
  }
  if (user && isDashboard) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role,agency_id,is_active")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile || !profile.is_active) {
      const denied = request.nextUrl.clone();
      denied.pathname = "/no-access";
      denied.search = "";
      const redirectResponse = NextResponse.redirect(denied);
      for (const cookie of response.cookies.getAll()) redirectResponse.cookies.set(cookie);
      return redirectResponse;
    }
    if (profile.role !== "super_admin") {
      const { data: agency } = await supabase
        .from("agencies")
        .select("status")
        .eq("id", profile.agency_id || "")
        .maybeSingle();
      if (!agency || agency.status !== "approved") {
        const statusUrl = request.nextUrl.clone();
        statusUrl.pathname = "/dashboard";
        statusUrl.search = "";
        if (request.nextUrl.pathname === "/dashboard") return response;
        const redirectResponse = NextResponse.redirect(statusUrl);
        for (const cookie of response.cookies.getAll()) redirectResponse.cookies.set(cookie);
        return redirectResponse;
      }
    }
  }
  return response;
}
