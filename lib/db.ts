import type { AgencyFeatures } from "@/lib/features";

export type Agency = {
  id: string;
  name: string;
  status: string;
  is_active: boolean;
  features?: AgencyFeatures;
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string;
  rera_agent_number?: string;
  rera_state?: string;
  rera_certificate_path?: string;
  rera_verified?: boolean;
  rera_verified_by?: string | null;
  rera_verified_at?: string | null;
  logo_url: string;
  contact_name: string;
  contact_email: string;
  phone: string;
  whatsapp: string;
  website: string;
  registration_number: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  service_areas: string;
  working_hours: string;
  description: string;
  lat: number | null;
  lng: number | null;
  user_count: number;
  property_count: number;
  lead_count: number;
  activity_count: number;
  created_at?: string;
};

export type DashboardAgencyInBox = Agency & {
  pending_leads: number;
  open_leads: number;
  closed_leads: number;
  lost_leads: number;
  my_lead_count: number;
};

export type DashboardProperty = Property & { agency_name?: string; lead_count: number };
export type DashboardLead = Lead & { agency_name?: string };

export type User = {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "agency_admin" | "agent";
  agency_id: string | null;
  is_active?: boolean;
  agency_status?: string;
  features?: AgencyFeatures;
};

export type Property = {
  id: string;
  agency_id: string;
  title: string;
  intent: string;
  type: string;
  price: number;
  beds: number;
  baths: number;
  area: number;
  locality: string;
  city: string;
  address: string;
  owner_name: string;
  owner_phone: string;
  owner_email: string;
  lat: number;
  lng: number;
  description: string;
  amenities: string;
  images: string;
  featured: boolean;
  status: string;
  floor_number: number;
  total_floors: number | null;
  car_parking: number;
  two_wheeler_parking: number;
  furnishing: string;
  age_years: number | null;
  created_at?: string;
};

export type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string;
  client_address: string;
  source: string;
  intent: string;
  requirements: string;
  status: string;
  notes: string;
  agency_id: string;
  property_id?: string | null;
  assigned_to?: string | null;
  created_at?: string;
};

export type LoanLead = {
  id: string;
  agency_id: string;
  loan_type: string;
  created_by: string | null;
  source_lead_id: string | null;
  property_id: string | null;
  customer_name: string;
  phone: string;
  email: string;
  loan_amount: number;
  monthly_income: number;
  tenure_months: number;
  employment_type: "salaried" | "self_employed" | "business_owner" | "other";
  city: string;
  preferred_bank: string;
  preferred_lender_id: string | null;
  assigned_lender_id: string | null;
  consent: boolean;
  consent_at: string | null;
  forwarded_at: string | null;
  admin_remarks: string;
  sanctioned_amount: number | null;
  sanctioned_at: string | null;
  disbursed_amount: number | null;
  disbursed_at: string | null;
  status: "draft" | "info_requested" | "submitted_to_admin" | "under_review" | "sanctioned" | "disbursed" | "rejected" | "cancelled";
  assigned_to: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type LoanDocument = {
  id: string;
  lead_id: string;
  agency_id: string;
  doc_type: string;
  file_path: string;
  file_name: string;
  content_type: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
  file_size: number;
  verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ServiceProvider = {
  id: string;
  agency_id: string;
  name: string;
  category: string;
  phone: string;
  email: string;
  service_area: string;
  address: string;
  notes: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};
