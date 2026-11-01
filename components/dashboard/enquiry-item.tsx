"use client";

import { useEffect, useRef } from "react";
import { deleteLead, saveLead } from "@/app/actions";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import type { Lead } from "@/lib/db";
import styles from "./enquiry-item.module.css";

const stages = ["new", "contacted", "visit scheduled", "negotiating", "closed", "lost"];
const intents = ["buy", "sell", "rent", "lease"];

const statusBadge: Record<string, string> = {
  new: "badgeNew",
  contacted: "badgeContacted",
  "visit scheduled": "badgeVisit",
  negotiating: "badgeNegotiating",
  closed: "badgeClosed",
  lost: "badgeLost",
};

// Show only the last 4 digits of a phone number for table-list privacy.
function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return phone;
  return `**** **** ${digits.slice(-4)}`;
}

// Short customer reference so the agency can still identify each enquiry
// without exposing the full name in the table list.
function customerRef(id: string) {
  return `CUST-${id.slice(-6).toUpperCase()}`;
}

interface EnquiryRowProps {
  lead: Lead & { agency_name?: string };
  isOpen?: boolean;
  onOpen: () => void;
}

export function EnquiryRow({ lead, isOpen, onOpen }: EnquiryRowProps) {
  return (
    <tr className={`${styles.row} ${isOpen ? styles.rowOpen : ""}`}>
      <td className={`${styles.cell} ${styles.cellCustomer}`} data-label="Customer">
        <span className={styles.avatar} aria-hidden="true">
          {lead.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
        </span>
        <span className={styles.customerCopy}>
          <strong className={styles.customerRef}>{customerRef(lead.id)}</strong>
          <small className={styles.customerInitials}>
            {lead.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
          </small>
        </span>
      </td>
      <td className={`${styles.cell} ${styles.cellAgency}`} data-label="Agency">
        {lead.agency_name || <span className={styles.muted}>Your agency</span>}
      </td>
      <td className={`${styles.cell} ${styles.cellContact}`} data-label="Contact">
        <span className={styles.maskedPhone}>{maskPhone(lead.phone)}</span>
      </td>
      <td className={`${styles.cell} ${styles.cellIntent}`} data-label="Looking to">
        <span className={`${styles.badge} ${styles.badgeIntent}`}>{lead.intent}</span>
      </td>
      <td className={`${styles.cell} ${styles.cellStatus}`} data-label="Progress">
        <span className={`${styles.badge} ${styles[statusBadge[lead.status] ?? "badgeNew"] as keyof typeof styles}`}>
          {lead.status}
        </span>
      </td>
      <td className={`${styles.cell} ${styles.cellActions}`} data-label="Details">
        <div className={styles.actions}>
          <button type="button" className={styles.openButton} onClick={onOpen} aria-label={`View enquiry details for ${lead.name}`}>
            View details
          </button>
        </div>
      </td>
    </tr>
  );
}

interface EnquiryDialogProps {
  lead: Lead & { agency_name?: string };
  open: boolean;
  onClose: () => void;
}

export function EnquiryDialog({ lead, open, onClose }: EnquiryDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={`enquiry-title-${lead.id}`}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className={styles.dialogHeader}>
        <div>
          <p className="kicker">CUSTOMER ENQUIRY</p>
          <h2 id={`enquiry-title-${lead.id}`}>{lead.name}</h2>
          {lead.agency_name && <p className={styles.agency}>{lead.agency_name}</p>}
        </div>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close enquiry details">
          ×
        </button>
      </div>

      <div className={styles.contact}>
        <a href={`tel:${lead.phone}`}>{lead.phone}</a>
        <a href={`mailto:${lead.email}`}>{lead.email}</a>
      </div>
      <div className={styles.detailsTags}>
        <span className={`${styles.badge} ${styles.badgeIntent}`}>{lead.intent}</span>
        <span className={`${styles.badge} ${styles[statusBadge[lead.status] ?? "badgeNew"] as keyof typeof styles}`}>
          {lead.status}
        </span>
      </div>
      <p className={styles.requirements}>{lead.requirements}</p>
      {lead.notes && <p className={styles.notes}><strong>Internal notes:</strong> {lead.notes}</p>}

      <form action={saveLead} className={styles.form}>
        <input type="hidden" name="id" value={lead.id} />
        <label>Customer name<input name="name" defaultValue={lead.name} maxLength={100} required /></label>
        <div className={styles.formGrid}>
          <label>Phone<input name="phone" type="tel" defaultValue={lead.phone} maxLength={25} required /></label>
          <label>Email<input name="email" type="email" defaultValue={lead.email} maxLength={254} required /></label>
        </div>
        <label>Looking to<select name="intent" defaultValue={lead.intent}>{intents.map((intent) => <option key={intent}>{intent}</option>)}</select></label>
        <label>Requirements<textarea name="requirements" defaultValue={lead.requirements} maxLength={2000} required /></label>
        <label>Progress<select name="status" defaultValue={lead.status}>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
        <label>Internal notes<textarea name="notes" defaultValue={lead.notes || ""} maxLength={4000} /></label>
        <div className={styles.actions}>
          <button type="submit" className="btn small">Save enquiry</button>
        </div>
      </form>

      <form action={deleteLead} className={styles.deleteForm}>
        <input type="hidden" name="id" value={lead.id} />
        <ConfirmDeleteButton confirmMessage={`Delete the enquiry from ${lead.name}? This cannot be undone.`}>
          Delete enquiry
        </ConfirmDeleteButton>
      </form>
    </dialog>
  );
}