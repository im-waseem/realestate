import type { Metadata } from "next";
import { PlatformHeader } from "@/components/platform";
import { AcceptInviteForm } from "@/components/accept-invite-form";

export const metadata: Metadata = { title: "Accept team invitation", robots: { index: false, follow: false } };

export default function AcceptInvitePage() {
  return <><PlatformHeader /><main className="auth-wrap"><section className="panel stack"><p className="kicker">WASEEM REALTY TEAM</p><h1>Set your password.</h1><p className="muted">Choose a password to finish joining your agency workspace.</p><AcceptInviteForm /></section></main></>;
}
