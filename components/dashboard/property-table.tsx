"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { deleteProperty, propertyStatus } from "@/app/actions";
import { useToast } from "@/components/dashboard/toaster";
import type { Property } from "@/lib/db";
import { propertyStatusFromDatabase } from "@/lib/property-schema";

type Row = Property & { agency_name?: string; lead_count?: number };
const pageSize = 10;

export function PropertyTable({ properties, isAdmin = false }: { properties: Row[]; isAdmin?: boolean }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const types = useMemo(() => [...new Set(properties.map((property) => property.type))].sort(), [properties]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return properties.filter((property) => {
      const visibleStatus = propertyStatusFromDatabase(property.status);
      const matchesSearch = !needle || `${property.title} ${property.city} ${property.locality} ${property.agency_name || ""} ${visibleStatus}`.toLowerCase().includes(needle);
      return matchesSearch && (status === "all" || visibleStatus === status) && (type === "all" || property.type === type);
    }).sort((a, b) => sort === "price-low" ? a.price - b.price : sort === "price-high" ? b.price - a.price : sort === "title" ? a.title.localeCompare(b.title) : String(b.created_at || "").localeCompare(String(a.created_at || "")));
  }, [properties, query, status, type, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);

  function updateStatus(id: string, value: string) {
    const form = new FormData(); form.set("id", id); form.set("status", value);
    startTransition(async () => {
      const result = await propertyStatus(form);
      if (!result) return;
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) router.refresh();
    });
  }

  function remove(property: Row) {
    if (property.lead_count) { toast("Resolve linked enquiries before deleting this property.", "error"); return; }
    if (!window.confirm(`Permanently delete “${property.title}”? This cannot be undone.`)) return;
    const form = new FormData(); form.set("id", property.id);
    startTransition(async () => {
      const result = await deleteProperty(form);
      if (!result) return;
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) router.refresh();
    });
  }

  return <div className="property-table-panel">
    <div className="property-table-controls">
      <label>Search<input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Title, locality, city…" /></label>
      <label>Status<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="all">All statuses</option>{["draft", "active", "sold", "rented"].map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Type<select value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}><option value="all">All types</option>{types.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Sort<select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="newest">Newest</option><option value="title">Title</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label>
    </div>
    <div className="table-wrap"><table>
      <thead><tr><th>Property</th>{isAdmin && <th>Agency</th>}<th>Price</th><th>Status</th><th>Manage</th></tr></thead>
      <tbody>{rows.map((property) => <tr key={property.id}>
        <td><strong>{property.title}</strong><small>{property.locality}, {property.city} · {property.beds} BHK · {property.area.toLocaleString("en-IN")} sqft {property.featured ? " · Featured" : ""}</small></td>
        {isAdmin && <td>{property.agency_name || "—"}</td>}
        <td>₹{property.price.toLocaleString("en-IN")}</td>
        <td><span className={`badge ${propertyStatusFromDatabase(property.status)}`}>{propertyStatusFromDatabase(property.status)}</span></td>
        <td><div className="row-actions"><Link href={`/dashboard/properties/${property.id}`}>Edit</Link><select aria-label={`Status for ${property.title}`} value={propertyStatusFromDatabase(property.status)} disabled={pending} onChange={(event) => updateStatus(property.id, event.target.value)}>{["draft", "active", "sold", "rented"].map((item) => <option key={item}>{item}</option>)}</select><button type="button" className="text-button" disabled={pending || Boolean(property.lead_count)} title={property.lead_count ? "Resolve linked enquiries before deleting" : "Delete property"} onClick={() => remove(property)}>Delete</button></div></td>
      </tr>)}</tbody>
    </table></div>
    {!filtered.length && <p className="empty">{properties.length ? "No properties match these filters." : "No properties yet. Add your first listing to get started."}</p>}
    {filtered.length > 0 && <div className="property-table-pagination"><span>{filtered.length} properties · Page {page} of {pages}</span><div><button className="btn small workspace-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className="btn small workspace-secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div></div>}
  </div>;
}
