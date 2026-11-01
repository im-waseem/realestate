import { LeadCard } from "./lead-card";
import { stageLabel } from "@/lib/stages";

interface StageColumnProps {
  stageId: string;
  leads: {
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
  }[];
  agencyName?: string;
  myAgencyId?: string;
  currentUserId?: string;
  isSuperAdmin?: boolean;
}

export function StageColumn({
  stageId,
  leads,
  agencyName,
  myAgencyId,
  currentUserId,
  isSuperAdmin = false,
}: StageColumnProps) {
  return (
    <section className="stage-column">
      <header className="stage-column-header">
        <div className="stage-column-title">
          <span className="stage-column-badge">{leads.length}</span>
          <h3>{stageLabel(stageId)}</h3>
        </div>
        <span className="stage-column-chevron">▾</span>
      </header>

      <div className="stage-column-body">
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            agencyName={agencyName}
            myAgencyId={myAgencyId}
            currentUserId={currentUserId}
            isSuperAdmin={isSuperAdmin}
          />
        ))}

        {!leads.length && (
          <div className="stage-column-empty">
            <p>No customers here</p>
          </div>
        )}
      </div>
    </section>
  );
}
