"use client";
import Link from "next/link";
export default function ErrorPage({reset}:{reset:()=>void}) {return <main className="workspace"><section className="panel empty"><h1>Something went wrong.</h1><p>Please retry. If the problem continues, contact the administrator.</p><button className="btn" onClick={reset}>Try again</button> <Link href="/properties">Browse properties</Link></section></main>;}
