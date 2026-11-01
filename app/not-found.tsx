import Link from "next/link";
export default function NotFound(){return <main className="workspace empty"><h1>This page isn’t available.</h1><p>The property may have been withdrawn or the address may be incorrect.</p><Link className="btn" href="/properties">Browse available properties →</Link></main>;}
