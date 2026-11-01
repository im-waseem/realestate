import Link from "next/link";
import { PlatformHeader } from "@/components/platform";

export const dynamic = "force-dynamic";

export default function Properties() {
  return (
    <>
      <PlatformHeader />
      <main className="workspace">
        <p className="kicker">AGENCY PROPERTY WORKSPACES</p>
        <h1>Listings stay <em>with their agency.</em></h1>
        <div className="empty panel">
          <h2>Property listings are private.</h2>
          <p>Each agency can view and manage its own properties after signing in. Listings are not shared with other agencies or shown in the public catalog.</p>
          <Link className="btn" href="/login">Sign in to your workspace →</Link>
        </div>
      </main>
    </>
  );
}
