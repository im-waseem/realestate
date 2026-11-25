"use client";

import Image from "next/image";
import { useState } from "react";
import { propertyImages } from "@/lib/property-images";
import { PropertyDetailsDialog } from "@/components/property-details-dialog";
import type { PublicProperty } from "@/lib/supabase/database.types";
import styles from "./property-market.module.css";

const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

export function PropertyCard({ property }: { property: PublicProperty }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const image = propertyImages(property.images)[0];
  return <article className={styles.card}>
    <button type="button" className={`${styles.photo} ${styles.photoTrigger}`} onClick={() => setDetailsOpen(true)} aria-label={`View ${property.title}`}>
      {image ? <Image src={image} alt={property.title} fill sizes="(max-width:650px) 100vw, (max-width:1100px) 50vw, 33vw" /> : <span>Photos coming soon</span>}
      <span className={styles.intent}>For {property.intent === "sale" ? "sale" : property.intent}</span>
    </button>
    <div className={styles.cardBody}><p className={styles.price}>{money(property.price)}{property.intent === "rent" && <small> / month</small>}</p><h2><button type="button" className={styles.titleButton} onClick={() => setDetailsOpen(true)}>{property.title}</button></h2><p>{property.locality}, {property.city}</p><div className={styles.specs}><span>{property.beds} beds</span><span>{property.baths} baths</span><span>{property.area.toLocaleString("en-IN")} sq ft</span></div><footer><span>{property.agency_name}</span><button type="button" className={styles.viewButton} onClick={() => setDetailsOpen(true)}>View details →</button></footer></div>
    {detailsOpen && <PropertyDetailsDialog property={{ ...property, publicView: true }} onClose={() => setDetailsOpen(false)} />}
  </article>;
}
