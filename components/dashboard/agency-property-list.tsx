"use client";

import { useState } from "react";
import type { Property } from "@/lib/db";
import { PropertyDetailsDialog } from "@/components/property-details-dialog";

type AgencyProperty = Property & { agency_name?: string };

export function AgencyPropertyList({ properties }: { properties: AgencyProperty[] }) {
  const [selected, setSelected] = useState<AgencyProperty | null>(null);
  if (!properties.length) return <p className="empty">This agency has no properties yet.</p>;
  return <>
    <ul>{properties.map((property) => (
      <li key={property.id}>
        <span>
          <button type="button" className="text-button" onClick={() => setSelected(property)}>{property.title}</button>
          <small>{property.locality}, {property.city}</small>
        </span>
        <span className={`badge ${property.status}`}>{property.status}</span>
      </li>
    ))}</ul>
    {selected && <PropertyDetailsDialog property={selected} onClose={() => setSelected(null)} />}
  </>;
}
