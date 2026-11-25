import Link from "next/link";
import { logout } from "@/app/actions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Workspace access unavailable", robots: { index: false, follow: false } };

export default function NoAccess() {
  return (
    <main className="workspace empty">
      <p className="kicker">WASEEM REALTY WORKSPACE</p>
      <h1>This account can’t access the workspace.</h1>
      <p>Your account may not have an active agency workspace. Contact the main admin for help.</p>
      <p><Link className="btn workspace-secondary" href="/">Return to the homepage</Link></p>
      <form action={logout}><button className="btn" type="submit">Sign out</button></form>
    </main>
  );
}
