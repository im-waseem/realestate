"use client";

import { useEffect, useRef } from "react";
import styles from "./property-details-dialog.module.css";

export type PropertyDetails = {
  title: string;
  intent: string;
  type: string;
  price: number;
  beds: number;
  baths: number;
  area: number;
  locality: string;
  city: string;
  description?: string | null;
  amenities?: string | null;
  furnishing?: string | null;
  floor_number?: number | null;
  total_floors?: number | null;
  car_parking?: number | null;
  two_wheeler_parking?: number | null;
  age_years?: number | null;
  status?: string;
  address?: string;
  owner_name?: string;
  owner_phone?: string;
  owner_email?: string;
  agency_name?: string;
  lat?: number | null;
  lng?: number | null;
  map_lat?: number | null;
  map_lng?: number | null;
  publicView?: boolean;
};

const money = (value: number) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
}).format(value);

export function PropertyDetailsDialog({ property, onClose }: { property: PropertyDetails; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const lat = property.map_lat ?? property.lat;
  const lng = property.map_lng ?? property.lng;

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="property-details-title"
      onClose={onClose}
      onClick={(event) => { if (event.target === dialog.current) dialog.current?.close(); }}
    >
      <header className={styles.header}>
        <div>
          <p className="kicker">{property.type} · FOR {property.intent.toUpperCase()}</p>
          <h2 id="property-details-title">{property.title}</h2>
          <p>{property.locality}, {property.city}{property.agency_name ? ` · Listed by ${property.agency_name}` : ""}</p>
        </div>
        <button type="button" className={styles.close} onClick={() => dialog.current?.close()} aria-label="Close property details">×</button>
      </header>
      <div className={styles.content}>
        <p className={styles.price}>{money(property.price)}{property.intent === "rent" ? <small> / month</small> : null}</p>
        <dl className={styles.facts}>
          <div><dt>Bedrooms</dt><dd>{property.beds}</dd></div>
          <div><dt>Bathrooms</dt><dd>{property.baths}</dd></div>
          <div><dt>Area</dt><dd>{property.area.toLocaleString("en-IN")} sq ft</dd></div>
          {property.furnishing && <div><dt>Furnishing</dt><dd>{property.furnishing.replaceAll("_", " ")}</dd></div>}
          {property.floor_number !== undefined && property.floor_number !== null && <div><dt>Floor</dt><dd>{property.floor_number === 0 ? "Ground" : property.floor_number}{property.total_floors ? ` of ${property.total_floors}` : ""}</dd></div>}
          {property.car_parking !== undefined && property.car_parking !== null && <div><dt>Car parking</dt><dd>{property.car_parking}</dd></div>}
          {property.two_wheeler_parking !== undefined && property.two_wheeler_parking !== null && <div><dt>Two-wheeler parking</dt><dd>{property.two_wheeler_parking}</dd></div>}
          {property.age_years !== undefined && property.age_years !== null && <div><dt>Property age</dt><dd>{property.age_years} years</dd></div>}
          {property.status && !property.publicView && <div><dt>Status</dt><dd>{property.status}</dd></div>}
        </dl>
        {property.address && !property.publicView && <p className={styles.address}><strong>Address</strong>{property.address}</p>}
        <h3>About this property</h3>
        <p className={styles.copy}>{property.description || "Ask the agency for more details."}</p>
        <h3>Amenities</h3>
        <p className={styles.copy}>{property.amenities || "Ask the agency for details."}</p>
        {property.owner_name && !property.publicView && <p className={styles.address}><strong>Owner</strong>{property.owner_name}{property.owner_phone ? ` · ${property.owner_phone}` : ""}{property.owner_email ? ` · ${property.owner_email}` : ""}</p>}
        <h3>Location</h3>
        {lat !== null && lat !== undefined && lng !== null && lng !== undefined ? <>
          {property.publicView && <p className={styles.copy}>The map shows the approximate neighbourhood.</p>}
          <iframe
            className={styles.map}
            title={`Map showing ${property.title}`}
            loading="lazy"
            referrerPolicy="no-referrer"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.02}%2C${lat - 0.02}%2C${lng + 0.02}%2C${lat + 0.02}&layer=mapnik&marker=${lat}%2C${lng}`}
          />
        </> : <p className={styles.copy}>Location coordinates have not been added.</p>}
      </div>
    </dialog>
  );
}
