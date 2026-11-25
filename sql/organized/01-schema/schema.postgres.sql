-- Supabase/PostgreSQL schema for Auth-backed role-based APIs.
-- Run the complete file in the Supabase SQL editor as postgres.
-- Public API returns only active agencies' basic contact details for QR pages.
BEGIN;

CREATE TABLE IF NOT EXISTS public.agencies (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 150),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  features JSONB NOT NULL DEFAULT '{"home_loans":false,"tools":false}'::jsonb,
  logo_url TEXT NOT NULL DEFAULT '' CHECK (length(logo_url) <= 1000),
  contact_name TEXT NOT NULL DEFAULT '' CHECK (length(contact_name) <= 100),
  contact_email TEXT NOT NULL DEFAULT '' CHECK (contact_email = '' OR (length(contact_email) <= 254 AND contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  phone TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '' CHECK (whatsapp = '' OR whatsapp ~ '^[+0-9 ()-]{7,25}$'),
  website TEXT NOT NULL DEFAULT '' CHECK (length(website) <= 300),
  registration_number TEXT NOT NULL DEFAULT '' CHECK (length(registration_number) <= 100),
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '' CHECK (length(city) <= 100),
  state TEXT NOT NULL DEFAULT '' CHECK (length(state) <= 100),
  postal_code TEXT NOT NULL DEFAULT '' CHECK (length(postal_code) <= 20),
  service_areas TEXT NOT NULL DEFAULT '' CHECK (length(service_areas) <= 1000),
  working_hours TEXT NOT NULL DEFAULT '' CHECK (length(working_hours) <= 300),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT agencies_location_pair CHECK ((lat IS NULL) = (lng IS NULL)),
  CONSTRAINT agencies_latitude_range CHECK (lat IS NULL OR lat BETWEEN -90 AND 90),
  CONSTRAINT agencies_longitude_range CHECK (lng IS NULL OR lng BETWEEN -180 AND 180)
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'agency_admin', 'agent')),
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT profiles_role_membership CHECK (
    (role = 'super_admin' AND agency_id IS NULL)
    OR (role = 'agency_admin' AND agency_id IS NOT NULL)
    OR (role = 'agent' AND agency_id IS NOT NULL)
  )
);

ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS logo_url TEXT NOT NULL DEFAULT '';
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{"home_loans":false,"tools":false}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS public.properties (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agency_id TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 150),
  intent TEXT NOT NULL CHECK (intent IN ('sale', 'rent', 'lease')),
  type TEXT NOT NULL CHECK (type IN (
    'Apartment', 'Villa', 'Independent house', 'Builder floor', 'Penthouse',
    'Studio', 'Plot', 'Farm house', 'Office', 'Shop', 'Showroom', 'Warehouse'
  )),
  price DOUBLE PRECISION NOT NULL CHECK (price > 0),
  beds INTEGER NOT NULL DEFAULT 0 CHECK (beds BETWEEN 0 AND 50),
  baths INTEGER NOT NULL DEFAULT 0 CHECK (baths BETWEEN 0 AND 50),
  area DOUBLE PRECISION NOT NULL CHECK (area > 0),
  locality TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  owner_name TEXT NOT NULL DEFAULT '' CHECK (length(owner_name) <= 100),
  owner_phone TEXT NOT NULL DEFAULT '' CHECK (owner_phone = '' OR owner_phone ~ '^[+0-9 ()-]{7,25}$'),
  owner_email TEXT NOT NULL DEFAULT '' CHECK (owner_email = '' OR (length(owner_email) <= 254 AND owner_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  lat DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  description TEXT NOT NULL,
  amenities TEXT NOT NULL DEFAULT '',
  images TEXT NOT NULL DEFAULT '[]',
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected', 'sold', 'rented', 'withdrawn')),
  floor_number INTEGER NOT NULL DEFAULT 0 CHECK (floor_number BETWEEN 0 AND 200),
  total_floors INTEGER CHECK (total_floors BETWEEN 1 AND 200),
  car_parking INTEGER NOT NULL DEFAULT 0 CHECK (car_parking BETWEEN 0 AND 100),
  two_wheeler_parking INTEGER NOT NULL DEFAULT 0 CHECK (two_wheeler_parking BETWEEN 0 AND 100),
  furnishing TEXT NOT NULL DEFAULT 'unfurnished' CHECK (furnishing IN ('furnished', 'semi_furnished', 'unfurnished', 'not_applicable')),
  age_years INTEGER CHECK (age_years BETWEEN 0 AND 200),
  publicly_visible BOOLEAN NOT NULL DEFAULT FALSE,
  publicly_visible_by UUID REFERENCES public.profiles(id),
  publicly_visible_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT properties_floor_range CHECK (total_floors IS NULL OR floor_number <= total_floors)
);

CREATE TABLE IF NOT EXISTS public.leads (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agency_id TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE RESTRICT,
  property_id TEXT REFERENCES public.properties(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  phone TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  client_address TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'other' CHECK (source IN ('walk_in', 'phone', 'website', 'referral', 'other')),
  intent TEXT NOT NULL CHECK (intent IN ('buy', 'sell', 'rent', 'lease')),
  requirements TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'visit', 'visit scheduled', 'negotiating', 'closed', 'lost')),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.loan_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  source_lead_id TEXT REFERENCES public.leads(id) ON DELETE SET NULL,
  property_id TEXT REFERENCES public.properties(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL CHECK (length(btrim(customer_name)) BETWEEN 1 AND 100),
  phone TEXT NOT NULL CHECK (phone ~ '^[+0-9 ()-]{7,25}$'),
  email TEXT NOT NULL DEFAULT '' CHECK (email = '' OR (length(email) <= 254 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  loan_amount NUMERIC(14, 2) NOT NULL CHECK (loan_amount > 0),
  monthly_income NUMERIC(14, 2) NOT NULL CHECK (monthly_income > 0),
  employment_type TEXT NOT NULL CHECK (employment_type IN ('salaried', 'self_employed', 'business_owner', 'other')),
  city TEXT NOT NULL CHECK (length(btrim(city)) BETWEEN 1 AND 100),
  preferred_bank TEXT NOT NULL DEFAULT '' CHECK (length(preferred_bank) <= 150),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'docs-collected', 'submitted', 'sanctioned', 'disbursed', 'rejected')),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT loan_leads_id_agency_unique UNIQUE (id, agency_id)
);

CREATE TABLE IF NOT EXISTS public.loan_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  agency_id TEXT NOT NULL,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('id', 'address', 'income', 'bank_statements', 'property_papers')),
  file_path TEXT NOT NULL UNIQUE CHECK (length(file_path) BETWEEN 1 AND 500),
  file_name TEXT NOT NULL CHECK (length(file_name) BETWEEN 1 AND 150),
  content_type TEXT NOT NULL CHECK (content_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  file_size INTEGER NOT NULL CHECK (file_size BETWEEN 1 AND 10485760),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT loan_documents_lead_agency_fk
    FOREIGN KEY (lead_id, agency_id)
    REFERENCES public.loan_leads(id, agency_id)
    ON DELETE CASCADE,
  CONSTRAINT loan_documents_verification_state CHECK (
    (verified = FALSE AND verified_by IS NULL AND verified_at IS NULL)
    OR (verified = TRUE AND verified_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS loan_leads_agency_status_created_idx
  ON public.loan_leads (agency_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS loan_leads_agency_assignee_status_idx
  ON public.loan_leads (agency_id, assigned_to, status);
CREATE INDEX IF NOT EXISTS loan_documents_lead_created_idx
  ON public.loan_documents (lead_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.realty_stamp_loan_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS loan_leads_updated_at ON public.loan_leads;
CREATE TRIGGER loan_leads_updated_at
BEFORE UPDATE ON public.loan_leads
FOR EACH ROW EXECUTE FUNCTION public.realty_stamp_loan_updated_at();

DROP TRIGGER IF EXISTS loan_documents_updated_at ON public.loan_documents;
CREATE TRIGGER loan_documents_updated_at
BEFORE UPDATE ON public.loan_documents
FOR EACH ROW EXECUTE FUNCTION public.realty_stamp_loan_updated_at();

CREATE TABLE IF NOT EXISTS public.service_providers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agency_id TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 100),
  category TEXT NOT NULL CHECK (length(btrim(category)) BETWEEN 2 AND 60),
  phone TEXT NOT NULL CHECK (phone ~ '^[+0-9 ()-]{7,25}$'),
  email TEXT NOT NULL DEFAULT '' CHECK (length(email) <= 254),
  service_area TEXT NOT NULL CHECK (length(btrim(service_area)) BETWEEN 2 AND 200),
  address TEXT NOT NULL DEFAULT '' CHECK (length(address) <= 500),
  notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON COLUMN public.service_providers.category IS
  'Agency-selected trade or property service; kept as flexible text so service types can evolve without schema changes.';
CREATE INDEX IF NOT EXISTS service_providers_agency_category_idx
  ON public.service_providers (agency_id, category, name);

CREATE TABLE IF NOT EXISTS public.activity (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE RESTRICT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.uploads (
  name TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.server_rate_limits (
  rate_key TEXT PRIMARY KEY,
  attempt_count INTEGER NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL
);

-- Upgrade databases created from the earlier schema before defining views/policies.
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '';
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS contact_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS contact_email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS whatsapp TEXT NOT NULL DEFAULT '';
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS website TEXT NOT NULL DEFAULT '';
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS registration_number TEXT NOT NULL DEFAULT '';
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT '';
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT '';
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS postal_code TEXT NOT NULL DEFAULT '';
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS service_areas TEXT NOT NULL DEFAULT '';
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS working_hours TEXT NOT NULL DEFAULT '';
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE public.agencies ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS floor_number INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS total_floors INTEGER;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS car_parking INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS two_wheeler_parking INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS furnishing TEXT NOT NULL DEFAULT 'unfurnished';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS age_years INTEGER;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS publicly_visible BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS publicly_visible_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS publicly_visible_at TIMESTAMPTZ;

DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.agencies'::regclass AND conname = 'agencies_contact_name_length') THEN
    ALTER TABLE public.agencies ADD CONSTRAINT agencies_contact_name_length CHECK (length(contact_name) <= 100) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.agencies'::regclass AND conname = 'agencies_features_shape') THEN
    ALTER TABLE public.agencies ADD CONSTRAINT agencies_features_shape CHECK (
      jsonb_typeof(features) = 'object'
      AND jsonb_typeof(features->'home_loans') = 'boolean'
      AND jsonb_typeof(features->'tools') = 'boolean'
      AND features - 'home_loans' - 'tools' = '{}'::jsonb
    ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.agencies'::regclass AND conname = 'agencies_contact_email_format') THEN
    ALTER TABLE public.agencies ADD CONSTRAINT agencies_contact_email_format CHECK (contact_email = '' OR (length(contact_email) <= 254 AND contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.agencies'::regclass AND conname = 'agencies_whatsapp_format') THEN
    ALTER TABLE public.agencies ADD CONSTRAINT agencies_whatsapp_format CHECK (whatsapp = '' OR whatsapp ~ '^[+0-9 ()-]{7,25}$') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.agencies'::regclass AND conname = 'agencies_website_length') THEN
    ALTER TABLE public.agencies ADD CONSTRAINT agencies_website_length CHECK (length(website) <= 300) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.agencies'::regclass AND conname = 'agencies_registration_number_length') THEN
    ALTER TABLE public.agencies ADD CONSTRAINT agencies_registration_number_length CHECK (length(registration_number) <= 100) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.agencies'::regclass AND conname = 'agencies_city_length') THEN
    ALTER TABLE public.agencies ADD CONSTRAINT agencies_city_length CHECK (length(city) <= 100) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.agencies'::regclass AND conname = 'agencies_state_length') THEN
    ALTER TABLE public.agencies ADD CONSTRAINT agencies_state_length CHECK (length(state) <= 100) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.agencies'::regclass AND conname = 'agencies_postal_code_length') THEN
    ALTER TABLE public.agencies ADD CONSTRAINT agencies_postal_code_length CHECK (length(postal_code) <= 20) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.agencies'::regclass AND conname = 'agencies_service_areas_length') THEN
    ALTER TABLE public.agencies ADD CONSTRAINT agencies_service_areas_length CHECK (length(service_areas) <= 1000) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.agencies'::regclass AND conname = 'agencies_working_hours_length') THEN
    ALTER TABLE public.agencies ADD CONSTRAINT agencies_working_hours_length CHECK (length(working_hours) <= 300) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.agencies'::regclass AND conname = 'agencies_description_length') THEN
    ALTER TABLE public.agencies ADD CONSTRAINT agencies_description_length CHECK (length(description) <= 2000) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.agencies'::regclass AND conname = 'agencies_location_pair') THEN
    ALTER TABLE public.agencies ADD CONSTRAINT agencies_location_pair CHECK ((lat IS NULL) = (lng IS NULL)) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.agencies'::regclass AND conname = 'agencies_latitude_range') THEN
    ALTER TABLE public.agencies ADD CONSTRAINT agencies_latitude_range CHECK (lat IS NULL OR lat BETWEEN -90 AND 90) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.agencies'::regclass AND conname = 'agencies_longitude_range') THEN
    ALTER TABLE public.agencies ADD CONSTRAINT agencies_longitude_range CHECK (lng IS NULL OR lng BETWEEN -180 AND 180) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.properties'::regclass AND conname = 'properties_floor_range') THEN
    ALTER TABLE public.properties ADD CONSTRAINT properties_floor_range CHECK (total_floors IS NULL OR floor_number <= total_floors) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.properties'::regclass AND conname = 'properties_car_parking_range') THEN
    ALTER TABLE public.properties ADD CONSTRAINT properties_car_parking_range CHECK (car_parking BETWEEN 0 AND 100) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.properties'::regclass AND conname = 'properties_two_wheeler_parking_range') THEN
    ALTER TABLE public.properties ADD CONSTRAINT properties_two_wheeler_parking_range CHECK (two_wheeler_parking BETWEEN 0 AND 100) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.properties'::regclass AND conname = 'properties_furnishing_value') THEN
    ALTER TABLE public.properties ADD CONSTRAINT properties_furnishing_value CHECK (furnishing IN ('furnished', 'semi_furnished', 'unfurnished', 'not_applicable')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.properties'::regclass AND conname = 'properties_age_years_range') THEN
    ALTER TABLE public.properties ADD CONSTRAINT properties_age_years_range CHECK (age_years BETWEEN 0 AND 200) NOT VALID;
  END IF;
END
$constraints$;

CREATE INDEX IF NOT EXISTS idx_agencies_status_created ON public.agencies(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_agency_role ON public.profiles(agency_id, role);
CREATE INDEX IF NOT EXISTS idx_properties_agency_created ON public.properties(agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_properties_status_created ON public.properties(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_agency_created ON public.leads(agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_agency_created ON public.activity(agency_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.realty_current_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p.role FROM public.profiles AS p WHERE p.id = (SELECT auth.uid())
$function$;

CREATE OR REPLACE FUNCTION public.realty_current_agency_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p.agency_id FROM public.profiles AS p WHERE p.id = (SELECT auth.uid())
$function$;

CREATE OR REPLACE FUNCTION public.realty_is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COALESCE(public.realty_current_role() = 'super_admin', FALSE)
$function$;

CREATE OR REPLACE FUNCTION public.realty_agency_is_active(target_agency_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.agencies AS a
    WHERE a.id = target_agency_id AND a.status = 'active'
  )
$function$;

CREATE OR REPLACE FUNCTION public.realty_agency_feature_enabled(target_agency_id TEXT, feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COALESCE(
    (SELECT (a.features->>feature_key)::BOOLEAN
     FROM public.agencies AS a
     WHERE a.id = target_agency_id
       AND feature_key IN ('home_loans', 'tools')
       AND (
         target_agency_id = (SELECT public.realty_current_agency_id())
         OR public.realty_is_super_admin()
       )),
    FALSE
  )
$function$;

CREATE OR REPLACE FUNCTION public.realty_can_enquire(target_property_id TEXT, target_agency_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.properties AS p
    WHERE p.id = target_property_id
      AND p.agency_id = target_agency_id
      AND p.intent = 'sale'
      AND p.status = 'published'
      AND public.realty_agency_is_active(p.agency_id)
  )
$function$;

CREATE OR REPLACE FUNCTION public.realty_guard_agency_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT public.realty_is_super_admin() THEN
    RAISE EXCEPTION 'Only the main admin can change agency status';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS agencies_guard_status ON public.agencies;
CREATE TRIGGER agencies_guard_status
BEFORE UPDATE OF status ON public.agencies
FOR EACH ROW
EXECUTE FUNCTION public.realty_guard_agency_status();

CREATE OR REPLACE FUNCTION public.realty_guard_agency_features()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.features IS DISTINCT FROM OLD.features AND NOT public.realty_is_super_admin() THEN
    RAISE EXCEPTION 'Only the main admin can change agency features';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS agencies_guard_features ON public.agencies;
CREATE TRIGGER agencies_guard_features
BEFORE UPDATE OF features ON public.agencies
FOR EACH ROW
EXECUTE FUNCTION public.realty_guard_agency_features();

CREATE OR REPLACE FUNCTION public.realty_admin_delete_agency(target_agency_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT public.realty_is_super_admin() THEN
    RAISE EXCEPTION 'Only the main admin can delete an agency';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.agencies WHERE id = target_agency_id) THEN
    RAISE EXCEPTION 'Agency not found';
  END IF;

  DELETE FROM public.leads WHERE agency_id = target_agency_id;
  DELETE FROM public.service_providers WHERE agency_id = target_agency_id;
  DELETE FROM public.properties WHERE agency_id = target_agency_id;
  DELETE FROM public.activity WHERE agency_id = target_agency_id;
  DELETE FROM public.uploads WHERE agency_id = target_agency_id;

  -- Remove every workspace membership tied to the agency before the agency
  -- row itself can be deleted (agency_id references use ON DELETE RESTRICT).
  DELETE FROM public.users WHERE agency_id = target_agency_id;
  DELETE FROM auth.users
  WHERE id IN (SELECT id FROM public.profiles WHERE agency_id = target_agency_id);
  DELETE FROM public.profiles WHERE agency_id = target_agency_id;

  DELETE FROM public.agencies WHERE id = target_agency_id;
END
$function$;

CREATE OR REPLACE FUNCTION public.realty_take_rate_limit(
  target_key TEXT,
  max_attempts INTEGER,
  window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  allowed BOOLEAN;
BEGIN
  IF length(target_key) NOT BETWEEN 1 AND 128 OR max_attempts < 1 OR window_seconds < 1 THEN
    RAISE EXCEPTION 'Invalid rate limit parameters';
  END IF;

  INSERT INTO public.server_rate_limits(rate_key, attempt_count, window_started_at)
  VALUES (target_key, 1, pg_catalog.now())
  ON CONFLICT (rate_key) DO UPDATE
  SET attempt_count = CASE
        WHEN public.server_rate_limits.window_started_at <= pg_catalog.now() - pg_catalog.make_interval(secs => window_seconds) THEN 1
        ELSE public.server_rate_limits.attempt_count + 1
      END,
      window_started_at = CASE
        WHEN public.server_rate_limits.window_started_at <= pg_catalog.now() - pg_catalog.make_interval(secs => window_seconds) THEN pg_catalog.now()
        ELSE public.server_rate_limits.window_started_at
      END
  RETURNING attempt_count <= max_attempts INTO allowed;
  RETURN allowed;
END
$function$;

CREATE OR REPLACE FUNCTION public.register_agency(
  p_contact_name TEXT,
  p_agency_name TEXT,
  p_phone TEXT,
  p_address TEXT,
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  caller_id UUID := auth.uid();
  caller_email TEXT;
  new_agency_id TEXT := gen_random_uuid()::text;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF length(btrim(COALESCE(p_contact_name, ''))) NOT BETWEEN 1 AND 100
     OR length(btrim(COALESCE(p_agency_name, ''))) NOT BETWEEN 2 AND 150
     OR length(btrim(COALESCE(p_phone, ''))) NOT BETWEEN 7 AND 25
     OR length(btrim(COALESCE(p_address, ''))) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'Enter a valid contact name, agency name, phone and office address';
  END IF;
  IF (p_lat IS NULL) <> (p_lng IS NULL)
     OR (p_lat IS NOT NULL AND p_lat NOT BETWEEN -90 AND 90)
     OR (p_lng IS NOT NULL AND p_lng NOT BETWEEN -180 AND 180) THEN
    RAISE EXCEPTION 'Provide valid map coordinates as a pair';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles AS p WHERE p.id = caller_id) THEN
    RAISE EXCEPTION 'A workspace profile already exists for this account';
  END IF;

  SELECT u.email INTO caller_email FROM auth.users AS u WHERE u.id = caller_id;
  INSERT INTO public.agencies(id, name, status, phone, address, lat, lng)
  VALUES (new_agency_id, btrim(p_agency_name), 'pending', btrim(p_phone), btrim(p_address), p_lat, p_lng);
  INSERT INTO public.profiles(id, name, email, role, agency_id)
  VALUES (caller_id, btrim(p_contact_name), caller_email, 'agency_admin', new_agency_id);
  RETURN new_agency_id;
END
$function$;

DROP VIEW IF EXISTS public.published_properties;

ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agencies_read_workspace ON public.agencies;
CREATE POLICY agencies_read_workspace ON public.agencies
FOR SELECT TO authenticated
USING (public.realty_is_super_admin() OR id = (SELECT public.realty_current_agency_id()));
DROP POLICY IF EXISTS agencies_update_workspace ON public.agencies;
CREATE POLICY agencies_update_workspace ON public.agencies
FOR UPDATE TO authenticated
USING (
  public.realty_is_super_admin()
  OR (
    id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() = 'agency_admin'
    AND public.realty_agency_is_active(id)
  )
)
WITH CHECK (
  public.realty_is_super_admin()
  OR (
    id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() = 'agency_admin'
  )
);
DROP POLICY IF EXISTS profiles_read_workspace ON public.profiles;
CREATE POLICY profiles_read_workspace ON public.profiles
FOR SELECT TO authenticated
USING (
  id = (SELECT auth.uid())
  OR public.realty_is_super_admin()
  OR (agency_id = (SELECT public.realty_current_agency_id()) AND agency_id IS NOT NULL)
);
DROP POLICY IF EXISTS profiles_admin_insert ON public.profiles;
CREATE POLICY profiles_admin_insert ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (public.realty_is_super_admin());
DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;
CREATE POLICY profiles_admin_update ON public.profiles
FOR UPDATE TO authenticated
USING (public.realty_is_super_admin())
WITH CHECK (public.realty_is_super_admin());
DROP POLICY IF EXISTS profiles_admin_delete ON public.profiles;
CREATE POLICY profiles_admin_delete ON public.profiles
FOR DELETE TO authenticated
USING (public.realty_is_super_admin());

DROP POLICY IF EXISTS properties_read_workspace ON public.properties;
CREATE POLICY properties_read_workspace ON public.properties
FOR SELECT TO authenticated
USING (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
  )
);
DROP POLICY IF EXISTS properties_insert_workspace ON public.properties;
CREATE POLICY properties_insert_workspace ON public.properties
FOR INSERT TO authenticated
WITH CHECK (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
    AND status IN ('pending', 'published')
  )
);
DROP POLICY IF EXISTS properties_update_workspace ON public.properties;
CREATE POLICY properties_update_workspace ON public.properties
FOR UPDATE TO authenticated
USING (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
  )
)
WITH CHECK (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
    AND status IN ('pending', 'published', 'sold', 'rented', 'withdrawn')
  )
);
DROP POLICY IF EXISTS properties_delete_workspace ON public.properties;
CREATE POLICY properties_delete_workspace ON public.properties
FOR DELETE TO authenticated
USING (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
  )
);

DROP POLICY IF EXISTS leads_read_workspace ON public.leads;
CREATE POLICY leads_read_workspace ON public.leads
FOR SELECT TO authenticated
USING (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
  )
);
DROP POLICY IF EXISTS leads_insert_enquiry ON public.leads;
CREATE POLICY leads_insert_enquiry ON public.leads
FOR INSERT TO authenticated
WITH CHECK (
  public.realty_is_super_admin()
  OR (
    status IN ('new', 'contacted', 'visit scheduled', 'negotiating', 'closed', 'lost')
    AND agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
  )
);
DROP POLICY IF EXISTS leads_update_workspace ON public.leads;
CREATE POLICY leads_update_workspace ON public.leads
FOR UPDATE TO authenticated
USING (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
  )
)
WITH CHECK (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
    AND status IN ('new', 'contacted', 'visit scheduled', 'negotiating', 'closed', 'lost')
  )
);
DROP POLICY IF EXISTS leads_delete_admin ON public.leads;
DROP POLICY IF EXISTS leads_delete_workspace ON public.leads;
CREATE POLICY leads_delete_workspace ON public.leads
FOR DELETE TO authenticated
USING (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
  )
);

DROP POLICY IF EXISTS loan_leads_read_workspace ON public.loan_leads;
CREATE POLICY loan_leads_read_workspace ON public.loan_leads
FOR SELECT TO authenticated
USING (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
    AND public.realty_agency_feature_enabled(agency_id, 'home_loans')
  )
);
DROP POLICY IF EXISTS loan_leads_insert_workspace ON public.loan_leads;
CREATE POLICY loan_leads_insert_workspace ON public.loan_leads
FOR INSERT TO authenticated
WITH CHECK (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
    AND public.realty_agency_feature_enabled(agency_id, 'home_loans')
    AND (
      property_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.properties AS p
        WHERE p.id = property_id AND p.agency_id = loan_leads.agency_id
      )
    )
    AND (
      source_lead_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.leads AS l
        WHERE l.id = source_lead_id AND l.agency_id = loan_leads.agency_id
      )
    )
    AND (
      assigned_to IS NULL
      OR EXISTS (
        SELECT 1 FROM public.profiles AS p
        WHERE p.id = assigned_to AND p.agency_id = loan_leads.agency_id
          AND p.role IN ('agency_admin', 'agent') AND p.is_active
      )
    )
  )
);
DROP POLICY IF EXISTS loan_leads_update_workspace ON public.loan_leads;
CREATE POLICY loan_leads_update_workspace ON public.loan_leads
FOR UPDATE TO authenticated
USING (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
    AND public.realty_agency_feature_enabled(agency_id, 'home_loans')
  )
)
WITH CHECK (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
    AND public.realty_agency_feature_enabled(agency_id, 'home_loans')
    AND (
      property_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.properties AS p
        WHERE p.id = property_id AND p.agency_id = loan_leads.agency_id
      )
    )
    AND (
      source_lead_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.leads AS l
        WHERE l.id = source_lead_id AND l.agency_id = loan_leads.agency_id
      )
    )
    AND (
      assigned_to IS NULL
      OR EXISTS (
        SELECT 1 FROM public.profiles AS p
        WHERE p.id = assigned_to AND p.agency_id = loan_leads.agency_id
          AND p.role IN ('agency_admin', 'agent') AND p.is_active
      )
    )
  )
);
DROP POLICY IF EXISTS loan_documents_read_workspace ON public.loan_documents;
CREATE POLICY loan_documents_read_workspace ON public.loan_documents
FOR SELECT TO authenticated
USING (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
    AND public.realty_agency_feature_enabled(agency_id, 'home_loans')
  )
);
DROP POLICY IF EXISTS loan_documents_insert_workspace ON public.loan_documents;
CREATE POLICY loan_documents_insert_workspace ON public.loan_documents
FOR INSERT TO authenticated
WITH CHECK (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
    AND public.realty_agency_feature_enabled(agency_id, 'home_loans')
    AND EXISTS (
      SELECT 1 FROM public.loan_leads AS l
      WHERE l.id = lead_id AND l.agency_id = loan_documents.agency_id
    )
    AND verified = FALSE AND verified_by IS NULL AND verified_at IS NULL
  )
);
DROP POLICY IF EXISTS loan_documents_verify_admin ON public.loan_documents;
CREATE POLICY loan_documents_verify_admin ON public.loan_documents
FOR UPDATE TO authenticated
USING (public.realty_is_super_admin())
WITH CHECK (
  public.realty_is_super_admin()
  AND (
    (verified = FALSE AND verified_by IS NULL AND verified_at IS NULL)
    OR (verified = TRUE AND verified_by = (SELECT auth.uid()) AND verified_at IS NOT NULL)
  )
);

DROP POLICY IF EXISTS service_providers_read_workspace ON public.service_providers;
CREATE POLICY service_providers_read_workspace ON public.service_providers
FOR SELECT TO authenticated
USING (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
    AND public.realty_agency_feature_enabled(agency_id, 'tools')
  )
);
DROP POLICY IF EXISTS service_providers_insert_workspace ON public.service_providers;
CREATE POLICY service_providers_insert_workspace ON public.service_providers
FOR INSERT TO authenticated
WITH CHECK (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
    AND public.realty_agency_feature_enabled(agency_id, 'tools')
  )
);
DROP POLICY IF EXISTS service_providers_update_workspace ON public.service_providers;
CREATE POLICY service_providers_update_workspace ON public.service_providers
FOR UPDATE TO authenticated
USING (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
    AND public.realty_agency_feature_enabled(agency_id, 'tools')
  )
)
WITH CHECK (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
    AND public.realty_agency_feature_enabled(agency_id, 'tools')
  )
);
DROP POLICY IF EXISTS service_providers_delete_workspace ON public.service_providers;
CREATE POLICY service_providers_delete_workspace ON public.service_providers
FOR DELETE TO authenticated
USING (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
    AND public.realty_agency_feature_enabled(agency_id, 'tools')
  )
);

DROP POLICY IF EXISTS activity_read_workspace ON public.activity;
CREATE POLICY activity_read_workspace ON public.activity
FOR SELECT TO authenticated
USING (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
  )
);
DROP POLICY IF EXISTS activity_insert_workspace ON public.activity;
CREATE POLICY activity_insert_workspace ON public.activity
FOR INSERT TO authenticated
WITH CHECK (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
  )
);

DROP POLICY IF EXISTS uploads_read_workspace ON public.uploads;
CREATE POLICY uploads_read_workspace ON public.uploads
FOR SELECT TO authenticated
USING (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
  )
);
DROP POLICY IF EXISTS uploads_insert_workspace ON public.uploads;
CREATE POLICY uploads_insert_workspace ON public.uploads
FOR INSERT TO authenticated
WITH CHECK (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
  )
);

INSERT INTO storage.buckets(id, name, public)
VALUES ('property-photos', 'property-photos', FALSE)
ON CONFLICT (id) DO UPDATE SET public = FALSE;

INSERT INTO storage.buckets(id, name, public)
VALUES ('loan-documents', 'loan-documents', FALSE)
ON CONFLICT (id) DO UPDATE SET public = FALSE;

DROP POLICY IF EXISTS property_photos_admin_delete ON storage.objects;
CREATE POLICY property_photos_admin_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'property-photos'
  AND public.realty_is_super_admin()
);

REVOKE ALL ON TABLE public.agencies, public.profiles, public.properties, public.leads, public.loan_leads, public.loan_documents, public.service_providers, public.activity, public.uploads FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.server_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.agencies TO authenticated;
GRANT INSERT, UPDATE (name, status, features, contact_name, contact_email, phone, whatsapp, website, registration_number, address, city, state, postal_code, service_areas, working_hours, description, lat, lng) ON TABLE public.agencies TO authenticated;
GRANT SELECT, INSERT, UPDATE (name, email, role, agency_id), DELETE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.properties TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.leads TO authenticated;
GRANT SELECT ON TABLE public.loan_leads, public.loan_documents TO authenticated;
GRANT INSERT (agency_id, source_lead_id, property_id, customer_name, phone, email, loan_amount, monthly_income, employment_type, city, preferred_bank, assigned_to, notes) ON TABLE public.loan_leads TO authenticated;
GRANT UPDATE (source_lead_id, property_id, customer_name, phone, email, loan_amount, monthly_income, employment_type, city, preferred_bank, status, assigned_to, notes) ON TABLE public.loan_leads TO authenticated;
GRANT INSERT (lead_id, agency_id, doc_type, file_path, file_name, content_type, file_size) ON TABLE public.loan_documents TO authenticated;
GRANT UPDATE (verified, verified_by, verified_at) ON TABLE public.loan_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.service_providers TO authenticated;
GRANT INSERT ON TABLE public.leads TO authenticated;
GRANT SELECT, INSERT ON TABLE public.activity TO authenticated;
GRANT SELECT, INSERT ON TABLE public.uploads TO authenticated;
REVOKE ALL ON FUNCTION public.realty_current_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.realty_current_agency_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.realty_is_super_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.realty_agency_is_active(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.realty_agency_feature_enabled(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.realty_can_enquire(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.realty_admin_delete_agency(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.realty_admin_delete_agency(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.realty_take_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.realty_take_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.realty_current_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.realty_current_agency_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.realty_is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.realty_agency_is_active(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.realty_agency_feature_enabled(TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.register_agency(TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_agency(TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- Dashboard aggregates run with the caller's permissions and existing RLS.
-- Safe to rerun: no records, roles, or policies are replaced.
CREATE INDEX IF NOT EXISTS properties_agency_status_idx ON public.properties (agency_id, status);
CREATE INDEX IF NOT EXISTS leads_agency_status_idx ON public.leads (agency_id, status);

CREATE OR REPLACE FUNCTION public.realty_dashboard_summary()
RETURNS TABLE (
  property_total BIGINT, published BIGINT, pending BIGINT,
  sold BIGINT, rented BIGINT, withdrawn BIGINT, rejected BIGINT,
  open_leads BIGINT, team_count BIGINT, agency_total BIGINT, pending_agencies BIGINT
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    (SELECT count(*) FROM public.properties),
    (SELECT count(*) FROM public.properties WHERE status = 'published'),
    (SELECT count(*) FROM public.properties WHERE status = 'pending'),
    (SELECT count(*) FROM public.properties WHERE status = 'sold'),
    (SELECT count(*) FROM public.properties WHERE status = 'rented'),
    (SELECT count(*) FROM public.properties WHERE status = 'withdrawn'),
    (SELECT count(*) FROM public.properties WHERE status = 'rejected'),
    (SELECT count(*) FROM public.leads WHERE status NOT IN ('closed', 'lost')),
    (SELECT count(*) FROM public.profiles WHERE role <> 'super_admin'),
    (SELECT count(*) FROM public.agencies),
    (SELECT count(*) FROM public.agencies WHERE status = 'pending');
$$;
REVOKE ALL ON FUNCTION public.realty_dashboard_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.realty_dashboard_summary() TO authenticated;

-- Curated public projection only. Workspace tables retain their existing RLS.
CREATE OR REPLACE FUNCTION public.realty_public_properties(
  search_text TEXT DEFAULT '', listing_intent TEXT DEFAULT '', property_type TEXT DEFAULT '',
  minimum_price DOUBLE PRECISION DEFAULT 0, maximum_price DOUBLE PRECISION DEFAULT 1000000000000,
  minimum_beds INTEGER DEFAULT 0, page_number INTEGER DEFAULT 1, target_id TEXT DEFAULT ''
) RETURNS TABLE (
  id TEXT, title TEXT, intent TEXT, type TEXT, price DOUBLE PRECISION, beds INTEGER,
  baths INTEGER, area DOUBLE PRECISION, locality TEXT, city TEXT, description TEXT,
  amenities TEXT, images TEXT, floor_number INTEGER, total_floors INTEGER,
  car_parking INTEGER, two_wheeler_parking INTEGER, furnishing TEXT, age_years INTEGER,
  map_lat DOUBLE PRECISION, map_lng DOUBLE PRECISION, agency_name TEXT, total_count BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT p.id,p.title,p.intent,p.type,p.price,p.beds,p.baths,p.area,p.locality,p.city,
 p.description,p.amenities,p.images,p.floor_number,p.total_floors,p.car_parking,
 p.two_wheeler_parking,p.furnishing,p.age_years,
 round(p.lat::numeric,2)::double precision,round(p.lng::numeric,2)::double precision,
 a.name,count(*) OVER()
 FROM public.properties p JOIN public.agencies a ON a.id=p.agency_id
 WHERE p.status='published' AND a.status='active'
 AND (target_id='' OR p.id=target_id)
 AND (listing_intent='' OR p.intent=listing_intent)
 AND (property_type='' OR p.type=property_type)
 AND p.price BETWEEN greatest(minimum_price,0) AND maximum_price
 AND p.beds>=greatest(minimum_beds,0)
 AND (search_text='' OR strpos(lower(p.title||' '||p.city||' '||p.locality),lower(left(search_text,100)))>0)
 ORDER BY p.created_at DESC,p.id
 LIMIT 12 OFFSET (least(greatest(page_number,1),10000)-1)*12;
$$;
REVOKE ALL ON FUNCTION public.realty_public_properties(TEXT,TEXT,TEXT,DOUBLE PRECISION,DOUBLE PRECISION,INTEGER,INTEGER,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.realty_public_properties(TEXT,TEXT,TEXT,DOUBLE PRECISION,DOUBLE PRECISION,INTEGER,INTEGER,TEXT) TO anon,authenticated;

-- Only published listing images and active agency logos are publicly readable.
CREATE OR REPLACE FUNCTION public.realty_public_photo_allowed(photo_name TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (
 SELECT 1 FROM public.uploads u JOIN public.properties p ON p.agency_id=u.agency_id
 JOIN public.agencies a ON a.id=p.agency_id
 WHERE u.name=photo_name AND p.status='published' AND a.status='active'
 AND p.images::jsonb ? ('/media/'||photo_name)
 ) OR EXISTS (
 SELECT 1 FROM public.uploads u JOIN public.agencies a ON a.id=u.agency_id
 WHERE u.name=photo_name AND a.status='active' AND a.logo_url='/media/'||photo_name
 );
$$;
REVOKE ALL ON FUNCTION public.realty_public_photo_allowed(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.realty_public_photo_allowed(TEXT) TO anon,authenticated;

-- Public, limited agency details used by printed or displayed agency QR codes.
DROP FUNCTION IF EXISTS public.realty_public_agency(TEXT);
CREATE OR REPLACE FUNCTION public.realty_public_agency(target_agency_id TEXT)
RETURNS TABLE (id TEXT, name TEXT, phone TEXT, whatsapp TEXT, logo_url TEXT, address TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT a.id,a.name,a.phone,a.whatsapp,a.logo_url,a.address,a.lat,a.lng
 FROM public.agencies a
 WHERE a.id=target_agency_id AND a.status='active';
$$;
REVOKE ALL ON FUNCTION public.realty_public_agency(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.realty_public_agency(TEXT) TO anon,authenticated;
COMMENT ON FUNCTION public.realty_public_agency(TEXT) IS
  'Returns only an active agency contact projection for QR visitors; private workspace records are not exposed.';

-- QR visitors can send an enquiry without an account. The RPC keeps rate limits
-- and agency checks in PostgreSQL and exposes no direct write access to leads.
CREATE OR REPLACE FUNCTION public.realty_submit_agency_enquiry(
 target_agency_id TEXT, customer_name TEXT, customer_phone TEXT,
 customer_email TEXT, enquiry_intent TEXT, customer_message TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE agency public.agencies%ROWTYPE;
BEGIN
 IF length(btrim(customer_name)) NOT BETWEEN 2 AND 100
 OR customer_phone !~ '^[+0-9 ()-]{7,25}$'
 OR (customer_email <> '' AND (customer_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(customer_email)>254))
 OR enquiry_intent NOT IN ('buy','sell','rent','lease')
 OR length(btrim(customer_message)) NOT BETWEEN 10 AND 2000 THEN
   RAISE EXCEPTION 'Please check your contact details and requirements';
 END IF;
 SELECT a.* INTO agency FROM public.agencies a
 WHERE a.id=target_agency_id AND a.status='active' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This agency is unavailable'; END IF;
 IF NOT public.realty_take_rate_limit('agency-qr-global',120,60)
 OR NOT public.realty_take_rate_limit(
   'agency-qr:'||md5(target_agency_id||COALESCE(NULLIF(lower(btrim(customer_email)),''),regexp_replace(customer_phone,'[^0-9]','','g'))),5,3600
 )
 OR NOT public.realty_take_rate_limit('agency-qr-phone:'||md5(target_agency_id||regexp_replace(customer_phone,'[^0-9]','','g')),3,3600) THEN
   RAISE EXCEPTION 'Too many enquiries. Please try again later';
 END IF;
 INSERT INTO public.leads(id,agency_id,property_id,name,phone,email,client_address,source,intent,requirements,status)
 VALUES(gen_random_uuid()::text,agency.id,NULL,btrim(customer_name),btrim(customer_phone),lower(btrim(customer_email)),'','website',enquiry_intent,btrim(customer_message),'new');
END;
$$;
REVOKE ALL ON FUNCTION public.realty_submit_agency_enquiry(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.realty_submit_agency_enquiry(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO service_role;


-- Called only by the application server. Never expose the service key to browsers.
CREATE OR REPLACE FUNCTION public.realty_submit_public_enquiry(
 target_id TEXT, customer_name TEXT, customer_phone TEXT, customer_email TEXT, customer_message TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE listing public.properties%ROWTYPE;
BEGIN
 IF length(btrim(customer_name)) NOT BETWEEN 2 AND 100
 OR customer_phone !~ '^[+0-9 ()-]{7,25}$'
 OR customer_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 OR length(customer_email)>254 OR length(btrim(customer_message)) NOT BETWEEN 10 AND 2000 THEN
 RAISE EXCEPTION 'Please check your contact details and message'; END IF;
 SELECT p.* INTO listing FROM public.properties p JOIN public.agencies a ON a.id=p.agency_id
 WHERE p.id=target_id AND p.status='published' AND a.status='active' FOR SHARE OF p,a;
 IF NOT FOUND THEN RAISE EXCEPTION 'This listing is no longer available'; END IF;
 IF NOT public.realty_take_rate_limit('public-enquiry-global',60,60)
 OR NOT public.realty_take_rate_limit('public-enquiry:'||md5(lower(btrim(customer_email))),3,3600)
 OR NOT public.realty_take_rate_limit('public-enquiry-phone:'||md5(regexp_replace(customer_phone,'[^0-9]','','g')),3,3600)
 THEN RAISE EXCEPTION 'Too many enquiries. Please try again later'; END IF;
 INSERT INTO public.leads(agency_id,property_id,name,phone,email,client_address,source,intent,requirements,status)
 VALUES(listing.agency_id,listing.id,btrim(customer_name),btrim(customer_phone),lower(btrim(customer_email)),'','website',
 CASE WHEN listing.intent='sale' THEN 'buy' ELSE listing.intent END,btrim(customer_message),'new');
END;
$$;
REVOKE ALL ON FUNCTION public.realty_submit_public_enquiry(TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.realty_submit_public_enquiry(TEXT,TEXT,TEXT,TEXT,TEXT) TO service_role;

-- Expose only a yes/no duplicate-owner check to the trusted server role.
CREATE OR REPLACE FUNCTION public.realty_owner_phone_registered_elsewhere(
 target_phone TEXT, target_agency_id TEXT, excluded_property_id TEXT DEFAULT NULL
) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (
   SELECT 1 FROM public.properties p
   WHERE p.agency_id <> target_agency_id
     AND (excluded_property_id IS NULL OR p.id <> excluded_property_id)
     AND regexp_replace(p.owner_phone,'[^0-9]','','g') = regexp_replace(target_phone,'[^0-9]','','g')
     AND regexp_replace(target_phone,'[^0-9]','','g') <> ''
 );
$$;
REVOKE ALL ON FUNCTION public.realty_owner_phone_registered_elsewhere(TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.realty_owner_phone_registered_elsewhere(TEXT,TEXT,TEXT) TO service_role;


-- Address and pin are saved together on the existing agency row.
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE OR REPLACE FUNCTION public.realty_stamp_agency_update()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.updated_at=CURRENT_TIMESTAMP; RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS agency_update_timestamp ON public.agencies;
CREATE TRIGGER agency_update_timestamp BEFORE UPDATE ON public.agencies
FOR EACH ROW EXECUTE FUNCTION public.realty_stamp_agency_update();


NOTIFY pgrst, 'reload schema';
COMMIT;
