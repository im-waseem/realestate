"use client";

import Link from "next/link";
import { advanceLead, reopenLead, removeLead, saveLead } from "@/app/actions";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { stageLabel } from "@/lib/stages";

interface LeadCardProps {
  lead: {
    id: string;
    name: string;
    phone: string;
    email: string;
    intent: string;
    requirements: string;
    status: string;
    agency_id: string;
    created_at?: string;
    notes?: string;
  };
  agencyName?: string;
  myAgencyId?: string;
  currentUserId?: string;
  isSuperAdmin?: boolean;
}

const stages = ["new", "contacted", "visit scheduled", "negotiating", "closed", "lost"];
const intents = ["buy", "sell", "rent", "lease"];

export function LeadCard({ lead, agencyName, myAgencyId, currentUserId, isSuperAdmin = false }: LeadCardProps) {
  const initials = lead.name.split(" ").map((part) => part[0]).filter(Boolean).join("").slice(0, 2).toUpperCase();

  return (
    <article className="lead-card">
      <div className="lead-card-header">
        <div className="lead-card-avatars">
          <span className="lead-card-avatar">{initials}</span>
          {isSuperAdmin && myAgencyId && lead.agency_id !== myAgencyId && (
            <Link href={`/dashboard/agency/${lead.agency_id}`} className="lead-card-dot" title="View this customer's agency">
              <span className="lead-card-dot-inner" />
            </Link>
          )}
        </div>
        <div className="lead-card-body">
          <h3 className="lead-card-name">{lead.name}</h3>
          <p className="lead-card-contact">{lead.phone}</p>
          {agencyName && <p className="lead-card-agency">{agencyName}</p>}
        </div>
      </div>

      <div className="lead-card-meta">
        <span className={`badge ${lead.status}`}>{stageLabel(lead.status)}</span>
        <span className="lead-card-intent">{lead.intent}</span>
        {lead.email && <span className="lead-card-email">{lead.email}</span>}
      </div>
      {lead.requirements && <p className="lead-card-requirements">{lead.requirements}</p>}
      {lead.notes && (
        <details className="lead-card-notes">
          <summary>Internal notes</summary>
          <p className="muted">{lead.notes}</p>
        </details>
      )}

      <details className="lead-card-edit">
        <summary>Edit customer enquiry</summary>
        <form action={saveLead} className="stack">
          <input type="hidden" name="id" value={lead.id} />
          <label>Name<input name="name" defaultValue={lead.name} maxLength={100} required /></label>
          <label>Phone<input name="phone" type="tel" defaultValue={lead.phone} maxLength={25} required /></label>
          <label>Email<input name="email" type="email" defaultValue={lead.email} maxLength={254} required /></label>
          <label>Looking to<select name="intent" defaultValue={lead.intent}>{intents.map((intent) => <option key={intent}>{intent}</option>)}</select></label>
          <label>Requirements<textarea name="requirements" defaultValue={lead.requirements} maxLength={2000} required /></label>
          <label>Progress<select name="status" defaultValue={lead.status}>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
          <label>Internal notes<textarea name="notes" defaultValue={lead.notes || ""} maxLength={4000} /></label>
          <button type="submit" className="btn btn-small">Save enquiry</button>
        </form>
      </details>

      {currentUserId && (
        <div className="lead-card-actions">
          <form action={advanceLead}>
            <input type="hidden" name="id" value={lead.id} />
            <button type="submit" className="btn btn-small btn-next">Next stage →</button>
          </form>
          {lead.status !== "new" && <form action={reopenLead}>
            <input type="hidden" name="id" value={lead.id} />
            <button type="submit" className="btn btn-small">Reopen</button>
          </form>}
          <form action={removeLead}>
            <input type="hidden" name="id" value={lead.id} />
            <ConfirmDeleteButton confirmMessage={`Delete the enquiry from ${lead.name}? This cannot be undone.`}>
              Delete enquiry
            </ConfirmDeleteButton>
          </form>
        </div>
      )}
    </article>
  );
}
