const labels: Record<string, string> = {
  draft: "Draft",
  info_requested: "Information requested",
  submitted_to_admin: "Pending",
  under_review: "In process",
  sanctioned: "Approved",
  disbursed: "Disbursed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export function loanStatusLabel(status: string) {
  return labels[status] || status.replaceAll("_", " ");
}
