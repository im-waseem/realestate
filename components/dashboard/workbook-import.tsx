"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type AgencyOption = { id: string; name: string; status?: string };
type ImportKind = "properties" | "leads";

const templates = {
  properties: {
    href: "/templates/property-import.csv",
    label: "Download property template",
    required: "Required columns: title, intent, type, price, area, beds, baths, locality, city, address, lat, lng, description.",
    optional: "Optional columns include owner_name, owner_phone, owner_email, amenities, floor_number, parking, and furnishing.",
  },
  leads: {
    href: "/templates/enquiry-import.csv",
    label: "Download enquiry template",
    required: "Required columns: name, phone, intent, requirements.",
    optional: "Optional columns include email, client_address, source, status, and notes.",
  },
};

export function WorkbookImport({ agencies, superAdmin, initialKind = "properties" }: {
  agencies: AgencyOption[];
  superAdmin: boolean;
  initialKind?: ImportKind;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<ImportKind>(initialKind);
  const [agencyId, setAgencyId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const current = templates[kind];

  async function importFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!file) {
      setMessage("Choose an Excel workbook or CSV file first.");
      setIsError(true);
      return;
    }
    if (superAdmin && !agencyId) {
      setMessage("Select the agency that owns these records.");
      setIsError(true);
      return;
    }
    setBusy(true);
    setMessage("");
    setIsError(false);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("kind", kind);
      if (agencyId) form.set("agency_id", agencyId);
      const response = await fetch("/api/import", { method: "POST", body: form });
      const result = await response.json() as { imported?: number; error?: string; rows?: string[]; omittedErrors?: number };
      if (!response.ok) {
        const rowErrors = result.rows?.length ? ` ${result.rows.join(" ")}${result.omittedErrors ? ` Plus ${result.omittedErrors} more row errors.` : ""}` : "";
        throw new Error(`${result.error || "Import failed. Check the file and try again."}${rowErrors}`);
      }
      setMessage(`Imported ${result.imported || 0} ${kind === "properties" ? "properties" : "enquiries"}.`);
      setFile(null);
      formElement.reset();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed. Check the file and try again.");
      setIsError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workbook-import-layout">
      <section className="panel workbook-import-card">
        <p className="kicker">BULK DATA IMPORT</p>
        <h2>Bring in an existing list</h2>
        <p className="muted">Use an .xlsx workbook or a .csv file saved from Excel. Import one record type at a time so listings and customer enquiries stay separate.</p>
        <form onSubmit={importFile} className="stack workbook-import-form">
          <label>What are you importing?
            <select value={kind} onChange={(event) => { setKind(event.target.value as ImportKind); setFile(null); }}>
              <option value="properties">Property listings</option>
              <option value="leads">Customer enquiries</option>
            </select>
          </label>
          {superAdmin && (
            <label>Agency
              <select value={agencyId} onChange={(event) => setAgencyId(event.target.value)} required>
                <option value="">Select agency</option>
                {agencies.map((agency) => <option key={agency.id} value={agency.id}>{agency.name}{agency.status ? ` · ${agency.status}` : ""}</option>)}
              </select>
            </label>
          )}
          <div className="workbook-template-note">
            <a className="workbook-template-link" href={current.href} download>{current.label}</a>
            <p><strong>{current.required}</strong></p>
            <p>{current.optional}</p>
          </div>
          <label>Excel or CSV file
            <input type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={(event) => setFile(event.target.files?.[0] || null)} required />
            <small>Maximum 5 MB and 500 data rows. First worksheet only.</small>
          </label>
          {file && <p className="workbook-selected-file">Selected: {file.name}</p>}
          <button type="submit" className="btn" disabled={busy}>{busy ? "Importing…" : `Import ${kind === "properties" ? "properties" : "enquiries"}`}</button>
          {message && <p role="status" className={isError ? "workbook-import-error" : "workbook-import-success"}>{message}</p>}
        </form>
      </section>
      <aside className="panel workbook-import-guidance">
        <p className="kicker">BEFORE YOU IMPORT</p>
        <h3>Keep the spreadsheet clear</h3>
        <ul>
          <li>Use the first row for the column names from the template.</li>
          <li>Use one row per property or enquiry. Blank rows are skipped.</li>
          <li>Imported properties start as pending review.</li>
          <li>All imported records belong to the selected agency.</li>
          <li>Owner contacts and client details remain private to authorized workspace users.</li>
        </ul>
      </aside>
    </div>
  );
}
