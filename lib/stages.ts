// Lead stages for the board. Order defines the progression and the "Next"
// action advances a lead to the next stage in this list.
export const STAGES = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "visit scheduled", label: "Visit Scheduled" },
  { id: "negotiating", label: "Negotiating" },
  { id: "closed", label: "Closed" },
  { id: "lost", label: "Lost" },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

export function stageIndex(id: string): number {
  const found = STAGES.findIndex((stage) => stage.id === id);
  return found === -1 ? 0 : found;
}

export function nextStage(id: string): string {
  const index = stageIndex(id);
  return STAGES[Math.min(index + 1, STAGES.length - 1)].id;
}

export function prevStage(id: string): string {
  const index = stageIndex(id);
  return STAGES[Math.max(index - 1, 0)].id;
}

export function stageLabel(id: string): string {
  const found = STAGES.find((stage) => stage.id === id);
  return found?.label ?? id;
}

export function isTerminalStage(id: string): boolean {
  return id === "closed" || id === "lost";
}

export function stageColorClass(id: string): string {
  switch (id) {
    case "new":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "contacted":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "visit scheduled":
      return "bg-violet-50 text-violet-700 border-violet-200";
    case "negotiating":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "closed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "lost":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}
