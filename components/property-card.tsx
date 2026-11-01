import Image from "next/image";
import Link from "next/link";
import { Money } from "./platform";
import { propertyImages } from "@/lib/public-properties";
import type { PublicProperty } from "@/lib/supabase/database.types";
import styles from "./property-market.module.css";

export function PropertyCard({ property }: { property: PublicProperty }) {
  const image = propertyImages(property.images)[0];
  return <article className={styles.card}>
    <Link className={styles.photo} href={`/properties/${property.id}`} aria-label={`View ${property.title}`}>
      {image ? <Image src={image} alt={property.title} fill sizes="(max-width:650px) 100vw, (max-width:1100px) 50vw, 33vw" unoptimized /> : <span>Photos coming soon</span>}
      <span className={styles.intent}>For {property.intent === "sale" ? "sale" : property.intent}</span>
    </Link>
    <div className={styles.cardBody}><p className={styles.price}><Money value={property.price} />{property.intent === "rent" && <small> / month</small>}</p><h2><Link href={`/properties/${property.id}`}>{property.title}</Link></h2><p>{property.locality}, {property.city}</p><div className={styles.specs}><span>{property.beds} beds</span><span>{property.baths} baths</span><span>{property.area.toLocaleString("en-IN")} sq ft</span></div><footer><span>{property.agency_name}</span><Link href={`/properties/${property.id}`}>View details →</Link></footer></div>
  </article>;
}
