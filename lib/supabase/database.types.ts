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
  phone: string;
  address: string;
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
  created_at: string;
};

export type Lead = {
  id: string;
  agency_id: string;
  property_id: string | null;
  name: string;
  phone: string;
  email: string;
  intent: string;
  requirements: string;
  status: string;
  notes: string;
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

export interface Database {
  public: {
    Tables: {
      agencies: Table<Agency>;
      profiles: Table<Profile>;
      properties: Table<Property>;
      leads: Table<Lead>;
      activity: Table<Activity>;
      uploads: Table<Upload>;
    };
    Views: Record<string, never>;
    Functions: {
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
