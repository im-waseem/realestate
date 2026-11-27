type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Agency = {
  id: string;
  name: string;
  status: string;
  is_active: boolean;
  features: { home_loans: boolean; loans: boolean; tools: boolean };
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string;
  rera_agent_number: string;
  rera_state: string;
  rera_certificate_path: string;
  rera_verified: boolean;
  rera_verified_by: string | null;
  rera_verified_at: string | null;
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
  created_at: string;
};

export type Profile = {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "agency_admin" | "agent";
  agency_id: string | null;
  is_active: boolean;
  created_at: string;
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
  created_at: string;
};

export type Lead = {
  id: string;
  agency_id: string;
  property_id: string | null;
  assigned_to: string | null;
  name: string;
  phone: string;
  email: string;
  client_address: string;
  source: "walk_in" | "phone" | "website" | "referral" | "other";
  intent: string;
  requirements: string;
  status: string;
  notes: string;
  created_at: string;
};

export type LoanLead = {
  id: string;
  agency_id: string;
  loan_type: string;
  created_by: string | null;
  source_lead_id: string | null;
  property_id: string | null;
  customer_name: string;
  first_name: string;
  middle_name: string;
  mother_name: string;
  father_name: string;
  date_of_birth: string | null;
  pincode: string;
  applicant_address: string;
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
  created_at: string;
};

export type Activity = {
  id: string;
  agency_id: string | null;
  actor: string;
  action: string;
  created_at: string;
};

export type Upload = {
  name: string;
  agency_id: string;
  created_at: string;
};

export type AgencyLoanProduct = {
  agency_id: string;
  loan_type: string;
  enabled: boolean;
  updated_at: string;
};
export type AgencyLoanFieldSettings = { agency_id: string; enabled_fields: string[]; updated_at: string };

export type LoanType = { id: string; code: string; name: string; sort_order: number; is_active: boolean; created_at: string; updated_at: string };
export type Lender = { id: string; name: string; lender_type: "bank" | "nbfc" | "hfc"; is_active: boolean; created_at: string; updated_at: string };
export type CommissionRule = {
  id: string; loan_type_id: string; lender_id: string | null; agency_id: string | null;
  basis: "percent" | "flat"; percent: number | null; flat_amount: number | null;
  minimum_commission: number | null; maximum_commission: number | null;
  agency_share_percent: number; effective_from: string; effective_to: string | null;
  is_active: boolean; created_at: string; updated_at: string;
};
export type LoanLeadHistory = { id: string; loan_lead_id: string; agency_id: string; actor_id: string | null; actor_name: string; event_type: string; from_status: string | null; to_status: string | null; remark: string; created_at: string };

export interface Database {
  public: {
    Tables: {
      agencies: Table<Agency>;
      profiles: Table<Profile>;
      properties: Table<Property>;
      leads: Table<Lead>;
      loan_leads: Table<LoanLead>;
      loan_documents: Table<LoanDocument>;
      agency_loan_products: Table<AgencyLoanProduct>;
      agency_loan_field_settings: Table<AgencyLoanFieldSettings>;
      loan_types: Table<LoanType>;
      lenders: Table<Lender>;
      commission_rules: Table<CommissionRule>;
      loan_lead_history: Table<LoanLeadHistory>;
      service_providers: Table<ServiceProvider>;
      activity: Table<Activity>;
      uploads: Table<Upload>;
    };
    Views: {
      loan_leads_admin_v: { Row: {
        id: string; agency_id: string; agency_name: string; loan_type: string; loan_type_name: string | null;
        preferred_lender_id: string | null; preferred_lender_name: string | null; assigned_lender_id: string | null; lender_name: string | null;
        customer_name: string; first_name: string; middle_name: string; mother_name: string; father_name: string; date_of_birth: string | null;
        pincode: string; applicant_address: string; phone: string; email: string; city: string; employment_type: string; monthly_income: number;
        loan_amount: number; tenure_months: number; property_id: string | null; source_lead_id: string | null; preferred_bank: string;
        notes: string; consent: boolean; consent_at: string | null; status: LoanLead["status"]; forwarded_at: string | null;
        admin_remarks: string; sanctioned_amount: number | null; sanctioned_at: string | null; disbursed_amount: number | null;
        disbursed_at: string | null; created_by: string | null; created_at: string; updated_at: string;
      }; Relationships: [] };
      loan_summary_by_agency_v: { Row: { agency_id: string; agency_name: string; total_leads: number; submitted_to_admin: number; under_review: number; info_requested: number; sanctioned: number; disbursed: number; rejected: number }; Relationships: [] };
    };
    Functions: {
      realty_public_properties: {
        Args: { search_text?: string; listing_intent?: string; property_type?: string; minimum_price?: number; maximum_price?: number; minimum_beds?: number; page_number?: number; target_id?: string };
        Returns: PublicProperty[];
      };
      realty_public_photo_allowed: { Args: { photo_name: string }; Returns: boolean };
      realty_public_agency: { Args: { target_agency_id: string }; Returns: { id: string; name: string; phone: string; whatsapp: string; logo_url: string; address: string; lat: number | null; lng: number | null }[] };
      realty_submit_public_enquiry: { Args: { target_id: string; customer_name: string; customer_phone: string; customer_email: string; customer_message: string }; Returns: undefined };
      realty_submit_agency_enquiry: { Args: { target_agency_id: string; customer_name: string; customer_phone: string; customer_email: string; enquiry_intent: string; customer_message: string }; Returns: undefined };
      realty_owner_phone_registered_elsewhere: { Args: { target_phone: string; target_agency_id: string; excluded_property_id?: string | null }; Returns: boolean };

      realty_dashboard_summary: {
        Args: Record<string, never>;
        Returns: {
          property_total: number; published: number; pending: number;
          sold: number; rented: number; withdrawn: number; rejected: number;
          open_leads: number; team_count: number; agency_total: number; pending_agencies: number;
        }[];
      };
      register_agency: {
        Args: {
          p_contact_name: string;
          p_agency_name: string;
          p_phone: string;
          p_address: string;
          p_lat?: number | null;
          p_lng?: number | null;
        };
        Returns: string;
      };
      realty_admin_delete_agency: {
        Args: { target_agency_id: string };
        Returns: undefined;
      };
      realty_take_rate_limit: {
        Args: { target_key: string; max_attempts: number; window_seconds: number };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type PublicProperty = Pick<Property, "id" | "title" | "intent" | "type" | "price" | "beds" | "baths" | "area" | "locality" | "city" | "description" | "amenities" | "images" | "floor_number" | "total_floors" | "car_parking" | "two_wheeler_parking" | "furnishing" | "age_years"> & { map_lat: number; map_lng: number; agency_name: string; total_count: number };
