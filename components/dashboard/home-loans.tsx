"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createLoanLead, updateLoanLead } from "@/app/actions";
import { useToast } from "@/components/dashboard/toaster";
import type { Lead, LoanLead } from "@/lib/db";
import styles from "./home-loans.module.css";
import { loanProductLabel, type LoanProductType } from "@/lib/loan-products";

const statuses = ["new", "docs-collected", "submitted", "sanctioned", "disbursed", "rejected"] as const;
const money = (value: number) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
}).format(value);

type Assignee = { id: string; name: string; agency_id: string | null };
type AgencyOption = { id: string; name: string };
type PropertyOption = { id: string; title: string; city: string; agency_id: string };
type LoanLeadView = LoanLead & {
  agency_name?: string;
  property_title?: string;
  assignee_name?: string;
};
type SourceLead = Pick<Lead, "id" | "agency_id" | "property_id" | "name" | "phone" | "email">;

function readableStatus(value: string) {
  return value === "docs-collected" ? "Documents collected" : value.charAt(0).toUpperCase() + value.slice(1);
}

export function HomeLoansBoard({
  leads,
  assignees,
  isAdmin,
}: {
  leads: LoanLeadView[];
  assignees: Assignee[];
  isAdmin: boolean;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const toast = useToast();
  const router = useRouter();
  const selectedLead = leads.find((lead) => lead.id === selectedId);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesQuery = !needle || [
        lead.customer_name,
        lead.phone,
        lead.email,
        lead.city,
        lead.preferred_bank,
        lead.property_title || "",
        lead.agency_name || "",
        lead.assignee_name || "",
      ].join(" ").toLowerCase().includes(needle);
      return matchesQuery && (statusFilter === "all" || lead.status === statusFilter);
    });
  }, [leads, query, statusFilter]);

  useEffect(() => {
    if (selectedLead && !dialog.current?.open) dialog.current?.showModal();
    if (!selectedLead && dialog.current?.open) dialog.current.close();
  }, [selectedLead]);

  function saveLead(formData: FormData) {
    startTransition(async () => {
      const result = await updateLoanLead(formData);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) router.refresh();
    });
  }

  return (
    <section className={styles.board} aria-label="Home-loan pipeline">
      <div className={styles.controls}>
        <label>
          Search leads
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Customer, city, phone, property…" />
        </label>
        <label>
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            {statuses.map((status) => <option key={status} value={status}>{readableStatus(status)}</option>)}
          </select>
        </label>
        <Link className="btn" href="/dashboard/home-loans/new">+ Request home loan</Link>
      </div>

      {filtered.length ? (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr><th>Customer</th>{isAdmin && <th>Agency</th>}<th>Loan type</th><th>Loan request</th><th>Stage</th><th>Assignee</th><th /></tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr key={lead.id}>
                  <td><strong>{lead.customer_name}</strong><small>{lead.phone}{lead.email ? ` · ${lead.email}` : ""}</small></td>
                  {isAdmin && <td>{lead.agency_name || "—"}</td>}
                  <td>{loanProductLabel(lead.loan_type)}</td>
                  <td><strong>{money(lead.loan_amount)}</strong><small>{lead.city}{lead.property_title ? ` · ${lead.property_title}` : ""}</small></td>
                  <td><span className={styles.status} data-status={lead.status}>{readableStatus(lead.status)}</span></td>
                  <td>{lead.assignee_name || "Unassigned"}</td>
                  <td><button className={styles.detailsButton} type="button" onClick={() => setSelectedId(lead.id)}>Details</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.empty}>
          <p className="kicker">{leads.length ? "NO MATCHES" : "YOUR PIPELINE STARTS HERE"}</p>
          <h2>{leads.length ? "No leads match these filters" : "Keep every loan request moving."}</h2>
          <p>{leads.length ? "Try a different search or status." : "Create a request from a property or enquiry, or start with a blank lead."}</p>
          <Link className="btn" href="/dashboard/home-loans/new">{leads.length ? "Create a home-loan request" : "Create your first request"}</Link>
        </div>
      )}

      <dialog
        ref={dialog}
        className={styles.drawer}
        aria-labelledby={selectedLead ? `loan-title-${selectedLead.id}` : undefined}
        onClose={() => setSelectedId(null)}
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close();
        }}
      >
        {selectedLead && (
          <>
            <header className={styles.drawerHeader}>
              <div>
                <p className="kicker">{loanProductLabel(selectedLead.loan_type).toUpperCase()} REQUEST</p>
                <h2 id={`loan-title-${selectedLead.id}`}>{selectedLead.customer_name}</h2>
                <p>{selectedLead.agency_name ? `${selectedLead.agency_name} · ` : ""}{selectedLead.city}</p>
              </div>
              <button type="button" onClick={() => dialog.current?.close()} aria-label="Close lead details">×</button>
            </header>

            <div className={styles.summaryGrid}>
              <div><small>Requested loan</small><strong>{money(selectedLead.loan_amount)}</strong></div>
              <div><small>Monthly income</small><strong>{money(selectedLead.monthly_income)}</strong></div>
              <div><small>Employment</small><strong>{selectedLead.employment_type.replaceAll("_", " ")}</strong></div>
              <div><small>Preferred bank</small><strong>{selectedLead.preferred_bank || "Not specified"}</strong></div>
            </div>
            <div className={styles.contact}>
              <a href={`tel:${selectedLead.phone}`}>{selectedLead.phone}</a>
              {selectedLead.email && <a href={`mailto:${selectedLead.email}`}>{selectedLead.email}</a>}
              <span>{selectedLead.property_title || "No linked property"}</span>
            </div>

            <form action={saveLead} className={styles.editForm}>
              <input type="hidden" name="id" value={selectedLead.id} />
              <label>Pipeline stage
                <select name="status" defaultValue={selectedLead.status} disabled={pending}>
                  {statuses.map((status) => <option key={status} value={status}>{readableStatus(status)}</option>)}
                </select>
              </label>
              <label>Assignee
                <select name="assigned_to" defaultValue={selectedLead.assigned_to || ""} disabled={pending}>
                  <option value="">Unassigned</option>
                  {assignees.filter((person) => person.agency_id === selectedLead.agency_id).map((person) => (
                    <option key={person.id} value={person.id}>{person.name}</option>
                  ))}
                </select>
              </label>
              <label>Internal notes
                <textarea name="notes" defaultValue={selectedLead.notes} maxLength={4000} disabled={pending} />
              </label>
              <button className="btn small" disabled={pending}>{pending ? "Saving…" : "Save updates"}</button>
            </form>

          </>
        )}
      </dialog>
    </section>
  );
}

export function NewHomeLoanForm({
  agencies,
  properties,
  assignees,
  isAdmin,
  initialAgencyId,
  initialPropertyId,
  sourceLead,
  enabledProductsByAgency,
  lenders,
  enabledFieldsByAgency,
}: {
  agencies: AgencyOption[];
  properties: PropertyOption[];
  assignees: Assignee[];
  isAdmin: boolean;
  initialAgencyId: string;
  initialPropertyId: string;
  sourceLead?: SourceLead;
  enabledProductsByAgency: Record<string, { id: LoanProductType; label: string }[]>;
  lenders: { name: string; lender_type: string }[];
  enabledFieldsByAgency: Record<string, string[]>;
}) {
  const [agencyId, setAgencyId] = useState(initialAgencyId);
  const [propertyId, setPropertyId] = useState(initialPropertyId);
  const [city, setCity] = useState(properties.find((property) => property.id === initialPropertyId)?.city || "");
  const [pincode, setPincode] = useState("");
  const [address, setAddress] = useState("");
  const [pincodeMessage, setPincodeMessage] = useState("");
  const enabledFields = new Set(enabledFieldsByAgency[agencyId] || ["first_name", "middle_name", "mother_name", "father_name", "date_of_birth", "pincode", "applicant_address"]);
  const enabledProducts = enabledProductsByAgency[agencyId] || [];
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!enabledFields.has("pincode") || pincode.length !== 6) return;
    let active = true;
    setPincodeMessage("Looking up PIN code…");
    fetch(`/api/pincode/${pincode}`).then(async (response) => {
      const result = await response.json() as { city?: string; state?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "PIN code lookup failed.");
      if (!active) return;
      setCity(result.city || "");
      setAddress([result.city, result.state, pincode].filter(Boolean).join(", "));
      setPincodeMessage(`${result.city}, ${result.state}`);
    }).catch((error: unknown) => {
      if (active) setPincodeMessage(error instanceof Error ? error.message : "PIN code lookup failed.");
    });
    return () => { active = false; };
  }, [pincode, agencyId]);

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await createLoanLead(formData);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) router.push("/dashboard/home-loans");
    });
  }

  return (
    <form action={submit} className={`panel stack ${styles.createForm}`}>
      {isAdmin ? (
        <label>Agency
          <select
            name="agency_id"
            value={agencyId}
            onChange={(event) => {
              setAgencyId(event.target.value);
              if (!properties.some((property) => property.id === propertyId && property.agency_id === event.target.value)) {
                setPropertyId("");
                setCity("");
              }
            }}
            required
          >
            <option value="">Select agency</option>
            {agencies.map((agency) => <option key={agency.id} value={agency.id}>{agency.name}</option>)}
          </select>
        </label>
      ) : <input type="hidden" name="agency_id" value={initialAgencyId} />}
      {sourceLead && <input type="hidden" name="source_lead_id" value={sourceLead.id} />}

      <div className={styles.formGrid}>
      <label>Loan type
          <select key={agencyId} name="loan_type" defaultValue={enabledProducts.find((product) => product.id === "home_loan")?.id || enabledProducts[0]?.id} required>
            {enabledProducts.map((product) => <option key={product.id} value={product.id}>{product.label}</option>)}
          </select>
        </label>
        <input type="hidden" name="customer_name" value="Applicant" />
        {enabledFields.has("first_name") && <label>First name<input name="first_name" defaultValue={sourceLead?.name.split(/\s+/)[0] || ""} maxLength={80} required /></label>}
        {enabledFields.has("middle_name") && <label>Middle name<input name="middle_name" maxLength={80} required /></label>}
        {enabledFields.has("mother_name") && <label>Mother's name<input name="mother_name" maxLength={150} required /></label>}
        {enabledFields.has("father_name") && <label>Father's name<input name="father_name" maxLength={150} required /></label>}
        {enabledFields.has("date_of_birth") && <label>Date of birth<input name="date_of_birth" type="date" required /></label>}
        <label>Mobile number<input name="phone" type="tel" defaultValue={sourceLead?.phone || ""} maxLength={25} required /></label>
        <label>Email<input name="email" type="email" defaultValue={sourceLead?.email || ""} maxLength={254} required /></label>
        {enabledFields.has("pincode") && <label>PIN code<input name="pincode" value={pincode} inputMode="numeric" maxLength={6} onChange={(event) => setPincode(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></label>}
        {enabledFields.has("applicant_address") && <label>Address<input name="applicant_address" value={address} onChange={(event) => setAddress(event.target.value)} maxLength={500} required /></label>}
        {enabledFields.has("pincode") && <p className="muted" role="status">{pincodeMessage}</p>}
        <label>City / district<input name="city" value={city} onChange={(event) => setCity(event.target.value)} maxLength={100} required /></label>
        <label>Property (optional)
          <select name="property_id" value={propertyId} onChange={(event) => {
            setPropertyId(event.target.value);
            const propertyCity = properties.find((property) => property.id === event.target.value)?.city;
            if (propertyCity) setCity(propertyCity);
          }}>
            <option value="">No property selected</option>
            {properties.filter((property) => !agencyId || property.agency_id === agencyId).map((property) => (
              <option key={property.id} value={property.id}>{property.title} · {property.city}</option>
            ))}
          </select>
        </label>
        <label>Loan amount (₹)<input name="loan_amount" type="number" min="0.01" max="999999999999.99" step="0.01" required /></label>
        <label>Monthly income (₹)<input name="monthly_income" type="number" min="0.01" max="999999999999.99" step="0.01" required /></label>
        <label>Employment type
          <select name="employment_type" defaultValue="salaried">
            <option value="salaried">Salaried</option>
            <option value="self_employed">Self-employed</option>
            <option value="business_owner">Business owner</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>Preferred lender (optional)<select name="preferred_bank" defaultValue=""><option value="">No lender selected</option>{lenders.map((lender) => <option key={`${lender.lender_type}:${lender.name}`} value={lender.name}>{lender.name} ({lender.lender_type.toUpperCase()})</option>)}</select></label>
        <label>Assign to (optional)
          <select name="assigned_to" defaultValue="">
            <option value="">Unassigned</option>
            {assignees.filter((person) => person.agency_id === agencyId).map((person) => (
              <option key={person.id} value={person.id}>{person.name}</option>
            ))}
          </select>
        </label>
      </div>
      <label>Internal notes<textarea name="notes" maxLength={4000} placeholder="Any context or follow-up needed for this request." /></label>
      <p className={styles.privacyNote}>We do not request identity or other documents. Only details enabled for this agency are collected and shared with the platform admin when the request is submitted.</p>
      <div className={styles.formActions}>
        <Link className="btn workspace-secondary" href="/dashboard/home-loans">Cancel</Link>
        <button className="btn" disabled={pending}>{pending ? "Creating…" : "Create home-loan request"}</button>
      </div>
    </form>
  );
}
