import Link from "next/link";
import { login } from "@/app/actions";
import { PlatformHeader, Notice } from "@/components/platform";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function Login({ searchParams }: { searchParams: Promise<{ message?: string; next?: string }> }) {
  const query = await searchParams;
  return (
    <>
      <PlatformHeader />
      <main className="auth-wrap">
        <div className="auth-intro">
          <p className="kicker">YOUR REAL ESTATE WORKSPACE</p>
          <h1>Good business.<br /><em>Better managed.</em></h1>
          <p>Properties, people, and every next step.<br />All in one place.</p>
        </div>
        <section className="panel auth-panel">
          <h2>Welcome back</h2>
          <p className="muted">Sign in to your agency or administrator account.</p>
          <Notice message={query.message} />
          <form action={login} className="stack">
            <input type="hidden" name="next" value={query.next || "/dashboard"} />
            <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
            <label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={128} /></label>
            <button className="btn">Sign in</button>
          </form>
          <p className="muted">New agency? <Link href="/register">Request an account</Link></p>
        </section>
      </main>
    </>
  );
}
