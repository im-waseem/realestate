import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { canAdminReviewLoanLeads, canAgencyAccessLoanLead, canAgencyEditLoanLead } from "@/lib/loan-leads/access";

const agencyA = { role: "agency_admin" as const, agency_id: "agency-a", agency_status: "approved", features: { loans: true, home_loans: false, tools: false } };

describe("loan lead access boundaries", () => {
  it("does not let agency A view or edit agency B leads", () => {
    const lead = { agency_id: "agency-b", status: "draft" };
    expect(canAgencyAccessLoanLead(agencyA, lead)).toBe(false);
    expect(canAgencyEditLoanLead(agencyA, lead)).toBe(false);
  });

  it("locks an agency lead after submission", () => {
    expect(canAgencyEditLoanLead(agencyA, { agency_id: "agency-a", status: "draft" })).toBe(true);
    expect(canAgencyEditLoanLead(agencyA, { agency_id: "agency-a", status: "submitted_to_admin" })).toBe(false);
  });

  it("allows super admin review across agencies only", () => {
    expect(canAdminReviewLoanLeads("super_admin")).toBe(true);
    expect(canAdminReviewLoanLeads("agency_admin")).toBe(false);
  });

  it("keeps admin-only fields and the cross-agency view behind database guards", () => {
    const migration = fs.readFileSync(path.join(process.cwd(), "sql/migrations/20261203_loan_leads.sql"), "utf8");
    expect(migration).toMatch(/NEW\.admin_remarks IS DISTINCT FROM OLD\.admin_remarks/);
    expect(migration).toMatch(/NEW\.assigned_lender_id IS DISTINCT FROM OLD\.assigned_lender_id/);
    expect(migration).toMatch(/NEW\.sanctioned_amount IS DISTINCT FROM OLD\.sanctioned_amount/);
    expect(migration).toMatch(/NEW\.disbursed_amount IS DISTINCT FROM OLD\.disbursed_amount/);
    expect(migration).toMatch(/WHERE public\.realty_is_super_admin\(\)/);
    expect(migration).toMatch(/status IN \('draft', 'info_requested'\)/);
  });
});
