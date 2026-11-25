"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createLoanLead, updateLoanLead, verifyLoanDocument } from "@/app/actions";
import { useToast } from "@/components/dashboard/toaster";
import type { Lead, LoanDocument, LoanLead } from "@/lib/db";
import styles from "./home-loans.module.css";
import { LOAN_DOCUMENTS, LOAN_PRODUCTS, loanProductLabel, type LoanProductType } from "@/lib/loan-products";

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
  documents: LoanDocument[];
};
type SourceLead = Pick<Lead, "id" | "agency_id" | "property_id" | "name" | "phone" | "email">;

function readableStatus(value: string) {
  return value === "docs-collected" ? "Documents collected" : value.charAt(0).toUpperCase() + value.slice(1);
}

function fileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const [uploading, setUploading] = useState<string | null>(null);
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

  async function uploadDocument(docType: string, file: File) {
    if (!selectedLead) return;
    setUploading(docType);
    const formData = new FormData();
    formData.set("lead_id", selectedLead.id);
    formData.set("doc_type", docType);
    formData.set("file", file);
    try {
      const response = await fetch("/api/loan-documents", { method: "POST", body: formData });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to upload the document.");
      toast(result.message || "Document uploaded.", "success");
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to upload the document.", "error");
    } finally {
      setUploading(null);
    }
  }

  function verifyDocument(formData: FormData) {
    startTransition(async () => {
      const result = await verifyLoanDocument(formData);
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

            <section className={styles.documents}>
              <div className={styles.sectionHeading}>
                <div><p className="kicker">SECURE DOCUMENTS</p><h3>Document checklist</h3></div>
                <small>Private files · PDF, JPEG, PNG or WebP · up to 10 MB</small>
              </div>
              <p className={styles.noDocuments}>Typical starting checklist based on Ruloans guidance. The lender may request additional documents for the applicant and product.</p>
              {LOAN_DOCUMENTS[selectedLead.loan_type].map(([docType, label]) => {
                const documents = selectedLead.documents.filter((document) => document.doc_type === docType);
                return (
                  <div className={styles.documentRow} key={docType}>
                    <div className={styles.documentHeading}>
                      <strong>{label}</strong>
                      <label className={styles.uploadButton}>
                        {uploading === docType ? "Uploading…" : "Upload"}
                        <input
                          type="file"
                          accept="application/pdf,image/jpeg,image/png,image/webp"
                          disabled={uploading !== null}
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0];
                            if (file) void uploadDocument(docType, file);
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                    </div>
                    {documents.length ? documents.map((document) => (
                      <div className={styles.documentFile} key={document.id}>
                        <span><strong>{document.file_name}</strong><small>{fileSize(document.file_size)} · {new Date(document.created_at).toLocaleDateString("en-IN")}</small></span>
                        <span className={document.verified ? styles.verified : styles.unverified}>{document.verified ? "Verified" : "Pending review"}</span>
                        <a href={`/api/loan-documents/${document.id}`} target="_blank" rel="noreferrer">Open</a>
                        {isAdmin && !document.verified && (
                          <form action={verifyDocument}>
                            <input type="hidden" name="id" value={document.id} />
                            <button type="submit" className={styles.verifyButton} disabled={pending}>Verify</button>
                          </form>
                        )}
                      </div>
                    )) : <p className={styles.noDocuments}>No {label.toLowerCase()} uploaded yet.</p>}
                  </div>
                );
              })}
            </section>
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
}: {
  agencies: AgencyOption[];
  properties: PropertyOption[];
  assignees: Assignee[];
  isAdmin: boolean;
  initialAgencyId: string;
  initialPropertyId: string;
  sourceLead?: SourceLead;
  enabledProductsByAgency: Record<string, LoanProductType[]>;
}) {
  const [agencyId, setAgencyId] = useState(initialAgencyId);
  const [propertyId, setPropertyId] = useState(initialPropertyId);
  const [city, setCity] = useState(properties.find((property) => property.id === initialPropertyId)?.city || "");
  const enabledProducts = enabledProductsByAgency[agencyId] || [];
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

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
          <select key={agencyId} name="loan_type" defaultValue={enabledProducts.includes("home_loan") ? "home_loan" : enabledProducts[0]} required>
            {LOAN_PRODUCTS.filter((product) => enabledProducts.includes(product.id)).map((product) => <option key={product.id} value={product.id}>{product.label}</option>)}
          </select>
        </label>
        <label>Customer name<input name="customer_name" defaultValue={sourceLead?.name || ""} maxLength={100} required /></label>
        <label>Mobile number<input name="phone" type="tel" defaultValue={sourceLead?.phone || ""} maxLength={25} required /></label>
        <label>Email (optional)<input name="email" type="email" defaultValue={sourceLead?.email || ""} maxLength={254} /></label>
        <label>City<input name="city" value={city} onChange={(event) => setCity(event.target.value)} maxLength={100} required /></label>
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
        <label>Preferred bank (optional)<input name="preferred_bank" maxLength={150} /></label>
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
      <p className={styles.privacyNote}>Financial details and uploaded documents are visible only to this agency and platform admins.</p>
      <div className={styles.formActions}>
        <Link className="btn workspace-secondary" href="/dashboard/home-loans">Cancel</Link>
        <button className="btn" disabled={pending}>{pending ? "Creating…" : "Create home-loan request"}</button>
      </div>
    </form>
  );
}
