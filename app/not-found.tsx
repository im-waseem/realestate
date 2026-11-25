import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The requested Waseem Realty page could not be found.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="workspace empty" role="main" aria-labelledby="not-found-title">
      <p className="kicker">404 · PAGE NOT FOUND</p>
      <h1 id="not-found-title">This page isn’t available.</h1>
      <p>The address may be incorrect or the page may have moved.</p>
      <Link className="btn" href="/properties">Browse available properties →</Link>
    </main>
  );
}
