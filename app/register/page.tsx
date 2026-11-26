import { register } from "@/app/actions";
import { PlatformHeader,Notice } from "@/components/platform";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Register your agency", robots: { index: false, follow: false } };

export default async function Register({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const query = await searchParams;

  return (
    <>
      <PlatformHeader />
      <main className="auth-wrap">
        <div className="auth-intro">
          <p className="kicker">GROW WITH WASEEM REALTY</p>
          <h1>Your agency.<br /><em>One workspace.</em></h1>
          <p>List homes, manage enquiries, and keep your team connected.</p>
        </div>
        <section className="panel auth-panel">
          <h2>Register your agency</h2>
          <p className="muted">Your request will be reviewed by the main admin before workspace access is enabled.</p>
          <Notice message={query.message} />
          <form action={register} className="stack">
            <label>Contact name<input name="name" required maxLength={100} /></label>
            <label>Agency name<input name="agency" required maxLength={150} /></label>
            <label>Phone<input name="phone" type="tel" required maxLength={25} /></label>
            <label>Work email<input name="email" type="email" required maxLength={254} /></label>
            <label>RERA agent number<input name="rera_agent_number" required maxLength={100} /></label>
            <label>RERA state<input name="rera_state" required maxLength={100} /></label>
            <label>RERA certificate (PDF or JPG, up to 5 MB)<input name="rera_certificate" type="file" accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg" required /></label>
            <label>Password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /><small>At least 12 characters.</small></label>
            <button className="btn">Submit for approval →</button>
          </form>
        </section>
      </main>
    </>
  );
}
