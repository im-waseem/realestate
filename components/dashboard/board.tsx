import { StageColumn } from "./stage-column";
import { STAGES } from "@/lib/stages";

interface LeadRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  intent: string;
  requirements: string;
  status: string;
  agency_id: string;
  notes?: string;
}

interface BoardProps {
  leads: LeadRow[];
  myAgencyId?: string;
  currentUserId?: string;
  isSuperAdmin?: boolean;
}

function groupByStage(leads: LeadRow[]) {
  const map = new Map<string, LeadRow[]>();
  for (const stage of STAGES) {
    map.set(stage.id, []);
  }
  for (const lead of leads) {
    const key = map.has(lead.status) ? lead.status : "new";
    if (!map.has(key)) map.set(key, []);
    map.get(key)?.push(lead);
  }
  return map;
}

export function Board({
  leads,
  myAgencyId,
  currentUserId,
  isSuperAdmin = false,
}: BoardProps) {
  const grouped = groupByStage(leads);

  return (
    <div className="board">
      {STAGES.map((stage) => (
        <StageColumn
          key={stage.id}
          stageId={stage.id}
          leads={grouped.get(stage.id) ?? []}
          myAgencyId={myAgencyId}
          currentUserId={currentUserId}
          isSuperAdmin={isSuperAdmin}
        />
      ))}
    </div>
  );
}
