export const LOAN_PRODUCTS = [
  { id: "personal_loan", label: "Personal Loan" },
  { id: "business_loan", label: "Business Loan" },
  { id: "home_loan", label: "Home Loan" },
  { id: "lap", label: "Loan Against Property (LAP)" },
  { id: "education_loan", label: "Education Loan" },
] as const;

export type LoanProductType = string;

export const LOAN_PRODUCT_IMAGES: Record<string, string> = {
  personal_loan: "https://ruloans-bucket.s3.ap-south-1.amazonaws.com/crm_loan_type/crm_loan_type_crm_loan_type_97b768d7-cd37-452e-a669-da6ffbe73bff.jpg",
  business_loan: "https://ruloans-bucket.s3.ap-south-1.amazonaws.com/crm_loan_type/crm_loan_type_crm_loan_type_c062860a-bf7f-446a-a036-003701063cc6.jpg",
  home_loan: "https://ruloans-bucket.s3.ap-south-1.amazonaws.com/crm_loan_type/crm_loan_type_crm_loan_type_108c4a55-5816-4ad5-af80-6761f56746b2.jpg",
  lap: "https://ruloans-bucket.s3.ap-south-1.amazonaws.com/crm_loan_type/crm_loan_type_crm_loan_type_78609aff-519c-4555-af24-2cbbe9ce9ce3.jpg",
  education_loan: "https://ruloans-bucket.s3.ap-south-1.amazonaws.com/crm_loan_type/crm_loan_type_crm_loan_type_34ed2fbc-7948-44fd-9227-f8bcc82aaea2.jpg",
};

export function loanProductLabel(type: string) {
  return LOAN_PRODUCTS.find((product) => product.id === type)?.label || type.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
