"use client";

import { useTransition } from "react";
import { useToast } from "@/components/dashboard/toaster";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  agency_id: string;
}

interface TeamSectionProps {
  staff: TeamMember[];
  agencyName?: string;
  isSuperAdmin?: boolean;
  onAddStaff: (formData: FormData) => void;
}

export function TeamSection({
  staff,
  agencyName,
  isSuperAdmin = false,
  onAddStaff,
}: TeamSectionProps) {
  const [busy] = useTransition();
  const toast = useToast();

  return (
    <section className="dashboard-section">
      <div className="dashboard-section-heading">
        <div>
          <p className="kicker">{isSuperAdmin ? "WORKSPACE ACCESS" : "PEOPLE"}</p>
          <h2>{isSuperAdmin ? "Agency users" : "Your team"}</h2>
        </div>
        <p className="muted">
          {isSuperAdmin
            ? "Review the people working across agency accounts."
            : "Manage the agents in your agency."}
        </p>
      </div>

      <div className="detail-columns">
        <div className="panel dashboard-list">
          {staff.map((member) => (
            <div className="agency-row" key={member.id}>
              <div>
                <strong>{member.name}</strong>
                <small>{member.email}</small>
              </div>
              <div className="dashboard-row-end">
                {isSuperAdmin && agencyName && (
                  <small>{agencyName}</small>
                )}
                <span className="badge">{member.role.replaceAll("_", " ")}</span>
              </div>
            </div>
          ))}
          {!staff.length && <p className="empty">Team accounts will appear here.</p>}
        </div>

        {!isSuperAdmin && (
          <form
            action={(formData) => {
              onAddStaff(formData);
              toast("Agent added. They can now sign in with the email and password you set.");
            }}
            className="panel stack dashboard-add-staff"
          >
            <div>
              <p className="kicker">GROW YOUR TEAM</p>
              <h3>Add an agent</h3>
            </div>
            <label>
              Name
              <input name="name" required maxLength={100} disabled={busy} />
            </label>
            <label>
              Email
              <input name="email" type="email" required disabled={busy} />
            </label>
            <label>
              Initial password
              <input
                type="password"
                name="password"
                minLength={12}
                maxLength={128}
                required
                disabled={busy}
              />
            </label>
            <button className="btn" disabled={busy}>
              {busy ? "Creating..." : "Create agent account"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
