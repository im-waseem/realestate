export type Agency = {
  id: string;
  name: string;
  status: string;
  phone: string;
  address: string;
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
  agency_status?: string;
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
  lat: number;
  lng: number;
  description: string;
  amenities: string;
  images: string;
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
  intent: string;
  requirements: string;
  status: string;
  notes: string;
  agency_id: string;
  property_id?: string | null;
  created_at?: string;
};
