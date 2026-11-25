"use client";
import Link from "next/link";
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="workspace" role="main" aria-labelledby="error-title">
      <section className="panel empty">
        <p className="kicker">WE HIT A SNAG</p>
        <h1 id="error-title">Something went wrong.</h1>
        <p>Please retry. If the problem continues, contact the administrator.</p>
        {process.env.NODE_ENV === "development" && <p role="alert">{error.message}</p>}
        <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          <button className="btn" type="button" onClick={reset}>Try again</button>
          <Link className="btn" href="/properties">Browse properties</Link>
        </div>
      </section>
    </main>
  );
}
