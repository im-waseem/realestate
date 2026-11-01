import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { logout } from "@/app/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseData } from "@/lib/supabase/results";

export async function PlatformHeader() {
  const user = await currentUser();
  let agencyName: string | undefined;
  if (user?.role !== "super_admin" && user?.agency_id) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("agencies").select("name").eq("id", user.agency_id).maybeSingle();
    agencyName = supabaseData(data, error, "Unable to load agency branding")?.name;
  }

  return (
    <header className="platform-header">
      <Link href="/" className="platform-brand">
        {agencyName ? agencyName.trim().slice(0, 1).toUpperCase() : "W"}
        <span>{agencyName || "WASEEM REALTY"}<small>{agencyName ? "AGENCY WORKSPACE" : "GOOD HOMES. GOOD PEOPLE."}</small></span>
      </Link>
      <nav>
        {agencyName ? (
          <>
            <Link href="/dashboard">Workspace</Link>
            <Link href="/dashboard/properties">My properties</Link>
            <Link href="/dashboard/properties/new">Add property</Link>
            <form action={logout}><button className="quiet">Sign out</button></form>
          </>
        ) : (
          <>
            <Link href="/properties">Find a property</Link>
            <Link href="/register">For agencies</Link>
            {user
              ? <><Link href="/dashboard">Workspace</Link><form action={logout}><button className="quiet">Sign out</button></form></>
              : <Link className="btn" href="/login">Sign in →</Link>}
          </>
        )}
      </nav>
    </header>
  );
}
export function Notice({message}:{message?:string}) { return message?<div role="status" className="notice">{message}</div>:null; }
export function Money({value}:{value:number}) { return <>{new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(value)}</>; }
