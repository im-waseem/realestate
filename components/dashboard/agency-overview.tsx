"use client";

import type { DashboardAgencyInBox } from "@/lib/db";

interface AgencyOverviewProps {
  agencies: DashboardAgencyInBox[];
  currentUserId?: string;
  onSelectAgency: (id: string) => void;
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-IN");
}

export function AgencyOverview({
  agencies,
  currentUserId,
  onSelectAgency,
}: AgencyOverviewProps) {
  return (
    <section className="dashboard-section">
      <div className="dashboard-section-heading">
        <div>
          <p className="kicker">WORKSPACE</p>
          <h2>Agency overview</h2>
        </div>
        <p className="muted">Choose an agency to review its full board, team, and activity.</p>
      </div>

      {!agencies.length && (
        <div className="panel">
          <p className="muted">No agencies have registered yet.</p>
        </div>
      )}

      <div className="agency-grid">
        {agencies.map((agency) => (
          <button
            key={agency.id}
            className="agency-card"
            onClick={() => onSelectAgency(agency.id)}
            disabled={!currentUserId}
            title={!currentUserId ? "Please sign in to view agency details." : undefined}
          >
            <div className="agency-card-head">
              <span className="agency-card-name">{agency.name}</span>
              <span className={`badge ${agency.status}`}>{agency.status}</span>
            </div>

            <div className="agency-card-stats">
              <div className="agency-stat">
                <span className="agency-stat-value">{formatNumber(agency.user_count)}</span>
                <span className="agency-stat-label">users</span>
              </div>
              <div className="agency-stat">
                <span className="agency-stat-value">{formatNumber(agency.property_count)}</span>
                <span className="agency-stat-label">listings</span>
              </div>
              <div className="agency-stat">
                <span className="agency-stat-value">{formatNumber(agency.lead_count)}</span>
                <span className="agency-stat-label">customers</span>
              </div>
            </div>

            <div className="agency-card-progress">
              <div className="agency-progress-track">
                <div
                  className="agency-progress-fill"
                  style={{ width: agency.my_lead_count ? `${(agency.my_lead_count / Math.max(agency.lead_count, 1)) * 100}` : "0%" }}
                />
              </div>
              <p className="muted">{agency.my_lead_count} of {formatNumber(Math.max(agency.lead_count, 1))} customers in track</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
