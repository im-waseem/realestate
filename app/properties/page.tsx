import Link from "next/link";
import { PlatformHeader } from "@/components/platform";
import { PropertyCard } from "@/components/property-card";
import { publicProperties } from "@/lib/public-properties";
import styles from "@/components/property-market.module.css";

export const dynamic = "force-dynamic";
export default async function Properties({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const query = await searchParams;
  const num = (value: string | undefined, fallback: number) => value?.trim() && Number.isFinite(Number(value)) ? Math.max(0,Number(value)) : fallback;
  const page = Math.min(10000,Math.max(1,Math.floor(num(query.page,1))));
  const properties = await publicProperties({search_text:query.q?.slice(0,100)||"",listing_intent:query.intent||"",property_type:query.type||"",minimum_price:num(query.min,0),maximum_price:num(query.max,1e12),minimum_beds:Math.min(50,Math.floor(num(query.beds,0))),page_number:page});
  const total = Number(properties[0]?.total_count || 0);
  function pageHref(next: number) { const params = new URLSearchParams(); for(const [key,value] of Object.entries(query)) if(value && key!=="page") params.set(key,value); params.set("page",String(next)); return `/properties?${params}`; }
  return <><PlatformHeader /><main className={styles.market}><p className="kicker">FIND YOUR NEXT CHAPTER</p><h1>A place that feels like you.</h1><p className={styles.intro}>Explore homes and spaces for sale, rent and lease. Connect with the listing agency when you find the right fit.</p>
    <form action="/properties" className={styles.filters}>
      <label>City, neighbourhood or property<input name="q" type="search" defaultValue={query.q} maxLength={100} placeholder="Try Bengaluru or Indiranagar" /></label>
      <label>Looking to<select name="intent" defaultValue={query.intent||""}><option value="">Buy, rent or lease</option><option value="sale">Buy</option><option value="rent">Rent</option><option value="lease">Lease</option></select></label>
      <label>Property type<select name="type" defaultValue={query.type||""}><option value="">All types</option>{["Apartment","Villa","Independent house","Builder floor","Penthouse","Studio","Plot","Farm house","Office","Shop","Showroom","Warehouse"].map(type=><option key={type}>{type}</option>)}</select></label>
      <label>Bedrooms<select name="beds" defaultValue={query.beds||"0"}><option value="0">Any bedrooms</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}+ bedrooms</option>)}</select></label>
      <label>Minimum price (₹)<input name="min" type="number" min="0" max="1000000000000" defaultValue={query.min} placeholder="No minimum" /></label>
      <label>Maximum price (₹)<input name="max" type="number" min="0" max="1000000000000" defaultValue={query.max} placeholder="No maximum" /></label>
      <div className={styles.filterActions}><button className="btn">Search properties</button><Link href="/properties">Clear filters</Link></div>
    </form>
    <p className={styles.intro}>{total ? `${total} properties match your search` : "No matching properties on this page"} · Newest first</p>
    {properties.length ? <div className={styles.grid}>{properties.map(property=><PropertyCard key={property.id} property={property} />)}</div> : <div className={styles.empty}><h2>No homes found here yet.</h2><p>Try a different neighbourhood or broaden your filters.</p><Link className="btn" href="/properties">Explore all properties</Link></div>}
    <nav className={styles.pagination} aria-label="Property pages">{page>1&&<Link href={pageHref(page-1)}>← Previous</Link>}<span>Page {page}</span>{page*12<total&&<Link href={pageHref(page+1)}>Next →</Link>}</nav>
  </main></>;
}
