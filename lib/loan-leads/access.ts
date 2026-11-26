import { hasAgencyFeature } from "@/lib/features";

export function canAgencyAccessLoanLead(user: { role: "super_admin" | "agency_admin" | "agent"; agency_id: string | null; agency_status?: string; features?: { home_loans: boolean; loans: boolean; tools: boolean } }, lead: { agency_id: string }) {
  return user.role !== "super_admin" && !!user.agency_id && user.agency_status === "approved"
    && hasAgencyFeature(user, "loans") && user.agency_id === lead.agency_id;
}

export function canAgencyEditLoanLead(user: Parameters<typeof canAgencyAccessLoanLead>[0], lead: { agency_id: string; status: string }) {
  return canAgencyAccessLoanLead(user, lead) && ["draft", "info_requested"].includes(lead.status);
}

export function canAdminReviewLoanLeads(role: string) {
  return role === "super_admin";
}
