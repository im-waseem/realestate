import Link from "next/link";
import type { Metadata } from "next";
import { PlatformHeader } from "@/components/platform";
import { DashboardTools } from "@/components/tools/dashboard-tools";
import { requireAgencyFeature } from "@/lib/auth";

export const metadata: Metadata = { title: "Property finance tools", robots: { index: false, follow: false } };

export default async function ToolsPage() {
  await requireAgencyFeature("tools");

  return (
    <>
      <PlatformHeader />
      <main className="workspace editor">
        <p className="kicker">AGENCY TOOLKIT</p>
        <div className="workspace-title">
          <div>
            <h1>Property finance <em>tools.</em></h1>
            <p className="muted">Explore estimates for loans, ownership costs, returns and property areas. Results stay in this browser.</p>
          </div>
          <Link className="btn workspace-secondary" href="/dashboard#services">Service providers</Link>
        </div>
        <DashboardTools />
      </main>
    </>
  );
}
