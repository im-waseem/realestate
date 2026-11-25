export const LOAN_PRODUCTS = [
  { id: "personal_loan", label: "Personal Loan" },
  { id: "business_loan", label: "Business Loan" },
  { id: "home_loan", label: "Home Loan" },
  { id: "lap", label: "Loan Against Property (LAP)" },
  { id: "education_loan", label: "Education Loan" },
] as const;

export type LoanProductType = (typeof LOAN_PRODUCTS)[number]["id"];

export const LOAN_PRODUCT_IMAGES: Record<LoanProductType, string> = {
  personal_loan: "https://ruloans-bucket.s3.ap-south-1.amazonaws.com/crm_loan_type/crm_loan_type_crm_loan_type_97b768d7-cd37-452e-a669-da6ffbe73bff.jpg",
  business_loan: "https://ruloans-bucket.s3.ap-south-1.amazonaws.com/crm_loan_type/crm_loan_type_crm_loan_type_c062860a-bf7f-446a-a036-003701063cc6.jpg",
  home_loan: "https://ruloans-bucket.s3.ap-south-1.amazonaws.com/crm_loan_type/crm_loan_type_crm_loan_type_108c4a55-5816-4ad5-af80-6761f56746b2.jpg",
  lap: "https://ruloans-bucket.s3.ap-south-1.amazonaws.com/crm_loan_type/crm_loan_type_crm_loan_type_78609aff-519c-4555-af24-2cbbe9ce9ce3.jpg",
  education_loan: "https://ruloans-bucket.s3.ap-south-1.amazonaws.com/crm_loan_type/crm_loan_type_crm_loan_type_34ed2fbc-7948-44fd-9227-f8bcc82aaea2.jpg",
};

export const LOAN_DOCUMENTS: Record<LoanProductType, readonly (readonly [string, string])[]> = {
  personal_loan: [["id", "Identity proof (PAN / Aadhaar / passport)"], ["address", "Address proof"], ["income", "Income proof (salary slips / ITR)"], ["bank_statements", "Bank statements"], ["employment_business_proof", "Employment or business proof"], ["photographs", "Photographs"]],
  business_loan: [["identity_proof", "Promoter identity proof"], ["address_proof", "Residence and business address proof"], ["business_registration", "Business registration / constitution documents"], ["itr_financials", "ITR and financial statements"], ["bank_statements", "Business bank statements"], ["gst_returns", "GST registration and returns"], ["business_profile", "Business profile and projections"], ["existing_loan_records", "Existing loan sanction / repayment records"]],
  home_loan: [["id", "Identity and signature proof"], ["address", "Address proof"], ["income", "Income proof (salary slips / ITR)"], ["bank_statements", "Bank statements"], ["property_papers", "Property papers / approved plan"], ["allotment_noc", "Allotment letter / society or builder NOC"], ["valuation_report", "Property valuation / cost estimate"], ["photographs", "Photographs"]],
  lap: [["id", "Identity proof"], ["address", "Address proof"], ["income", "Income proof"], ["bank_statements", "Bank statements"], ["property_papers", "Title deed and property ownership documents"], ["property_tax_plan", "Property tax / approved plan / occupancy records"], ["credit_report", "Credit report"], ["existing_loan_records", "Existing loan records (if applicable)"], ["business_proof", "Business proof (if self-employed)"]],
  education_loan: [["student_identity", "Student identity proof"], ["student_address", "Student address proof"], ["academic_records", "Academic records and entrance exam results"], ["admission_letter", "Admission / offer letter"], ["fee_schedule", "Course fee structure / study cost"], ["coborrower_income", "Co-applicant / guarantor income proof"], ["coborrower_bank_statements", "Co-applicant bank statements"], ["collateral_documents", "Collateral documents (if applicable)"], ["photographs", "Photographs"]],
};

export function loanProductLabel(type: string) {
  return LOAN_PRODUCTS.find((product) => product.id === type)?.label || "Loan";
}
