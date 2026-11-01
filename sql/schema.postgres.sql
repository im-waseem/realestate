-- Supabase/PostgreSQL schema for Auth-backed role-based APIs.
-- Run the complete file in the Supabase SQL editor as postgres.
-- Public API reads of agency contact details are intentionally prohibited.
BEGIN;

CREATE TABLE IF NOT EXISTS public.agencies (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 150),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT profiles_role_membership CHECK (
    (role = 'super_admin' AND agency_id IS NULL)
    OR (role = 'agency_admin' AND agency_id IS NOT NULL)
    OR (role = 'agent' AND agency_id IS NOT NULL)
  )
);

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
  lat DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  description TEXT NOT NULL,
  amenities TEXT NOT NULL DEFAULT '',
  images TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected', 'sold', 'rented', 'withdrawn')),
  floor_number INTEGER NOT NULL DEFAULT 0 CHECK (floor_number BETWEEN 0 AND 200),
  total_floors INTEGER CHECK (total_floors BETWEEN 1 AND 200),
  car_parking INTEGER NOT NULL DEFAULT 0 CHECK (car_parking BETWEEN 0 AND 100),
  two_wheeler_parking INTEGER NOT NULL DEFAULT 0 CHECK (two_wheeler_parking BETWEEN 0 AND 100),
  furnishing TEXT NOT NULL DEFAULT 'unfurnished' CHECK (furnishing IN ('furnished', 'semi_furnished', 'unfurnished', 'not_applicable')),
  age_years INTEGER CHECK (age_years BETWEEN 0 AND 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT properties_floor_range CHECK (total_floors IS NULL OR floor_number <= total_floors)
);

CREATE TABLE IF NOT EXISTS public.leads (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agency_id TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE RESTRICT,
  property_id TEXT REFERENCES public.properties(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  intent TEXT NOT NULL CHECK (intent IN ('buy', 'sell', 'rent', 'lease')),
  requirements TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'visit scheduled', 'negotiating', 'closed', 'lost')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE public.agencies ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS floor_number INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS total_floors INTEGER;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS car_parking INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS two_wheeler_parking INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS furnishing TEXT NOT NULL DEFAULT 'unfurnished';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS age_years INTEGER;

DO $constraints$
BEGIN
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

DROP POLICY IF EXISTS property_photos_admin_delete ON storage.objects;
CREATE POLICY property_photos_admin_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'property-photos'
  AND public.realty_is_super_admin()
);

REVOKE ALL ON TABLE public.agencies, public.profiles, public.properties, public.leads, public.activity, public.uploads FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.server_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.agencies TO authenticated;
GRANT INSERT, UPDATE (name, phone, address, lat, lng, status) ON TABLE public.agencies TO authenticated;
GRANT SELECT, INSERT, UPDATE (name, email, role, agency_id), DELETE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.properties TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.leads TO authenticated;
GRANT INSERT ON TABLE public.leads TO authenticated;
GRANT SELECT, INSERT ON TABLE public.activity TO authenticated;
GRANT SELECT, INSERT ON TABLE public.uploads TO authenticated;
REVOKE ALL ON FUNCTION public.realty_current_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.realty_current_agency_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.realty_is_super_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.realty_agency_is_active(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.realty_can_enquire(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.realty_admin_delete_agency(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.realty_admin_delete_agency(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.realty_take_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.realty_take_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.realty_current_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.realty_current_agency_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.realty_is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.realty_agency_is_active(TEXT) TO authenticated;
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

NOTIFY pgrst, 'reload schema';
COMMIT;
