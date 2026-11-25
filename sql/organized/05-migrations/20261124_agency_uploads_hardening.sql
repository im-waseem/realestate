-- Apply after 20261123_team_invites_agency_logo.sql.
-- Run in the Supabase SQL editor as postgres. Idempotent: safe to rerun.
-- Hardens agency row isolation, adds row-level timestamps, fixes agency deletion,
-- and keeps uploads agency-scoped (upload type/size limits are enforced in
-- app/api/uploads/route.ts and components/photo-input.tsx).
BEGIN;

-- 1. Row-level update timestamps on workspace tables.
--    (agencies.updated_at already exists via modules/03-agency-map.sql.)
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public.uploads
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public.activity
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public.service_providers
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Shared BEFORE UPDATE stamp trigger.
CREATE OR REPLACE FUNCTION public.realty_stamp_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS property_update_timestamp ON public.properties;
CREATE TRIGGER property_update_timestamp
BEFORE UPDATE ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.realty_stamp_update();

DROP TRIGGER IF EXISTS lead_update_timestamp ON public.leads;
CREATE TRIGGER lead_update_timestamp
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.realty_stamp_update();

DROP TRIGGER IF EXISTS upload_update_timestamp ON public.uploads;
CREATE TRIGGER upload_update_timestamp
BEFORE UPDATE ON public.uploads
FOR EACH ROW EXECUTE FUNCTION public.realty_stamp_update();

DROP TRIGGER IF EXISTS activity_update_timestamp ON public.activity;
CREATE TRIGGER activity_update_timestamp
BEFORE UPDATE ON public.activity
FOR EACH ROW EXECUTE FUNCTION public.realty_stamp_update();

DROP TRIGGER IF EXISTS service_provider_update_timestamp ON public.service_providers;
CREATE TRIGGER service_provider_update_timestamp
BEFORE UPDATE ON public.service_providers
FOR EACH ROW EXECUTE FUNCTION public.realty_stamp_update();

-- 2. Index so an agency can list its own uploads chronologically.
--    RLS policies on uploads still restrict rows to the caller's agency.
CREATE INDEX IF NOT EXISTS idx_uploads_agency_created
  ON public.uploads (agency_id, created_at DESC);

-- 3. Lead lifecycle consistency: status 'visit' exists in the check constraint
--    (20261122_enquiry_assignment.sql) but was missing from the workspace policy
--    guards, so agency users could not insert/update 'visit' leads.
DROP POLICY IF EXISTS leads_insert_enquiry ON public.leads;
CREATE POLICY leads_insert_enquiry ON public.leads
FOR INSERT TO authenticated
WITH CHECK (
  public.realty_is_super_admin()
  OR (
    status IN ('new', 'contacted', 'visit', 'visit scheduled', 'negotiating', 'closed', 'lost')
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
    status IN ('new', 'contacted', 'visit', 'visit scheduled', 'negotiating', 'closed', 'lost')
    AND agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
  )
);

-- 4. Fix: realty_admin_delete_agency referenced public.users, which does not exist
--    on Supabase/PostgreSQL. Workspace membership lives in public.profiles and
--    accounts live in auth.users.
CREATE OR REPLACE FUNCTION public.realty_admin_delete_agency(target_agency_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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

  -- Remove workspace memberships and their Auth accounts before the agency row
  -- itself (agency_id foreign keys use ON DELETE RESTRICT).
  DELETE FROM auth.users
  WHERE id IN (SELECT id FROM public.profiles WHERE agency_id = target_agency_id);
  DELETE FROM public.profiles WHERE agency_id = target_agency_id;

  DELETE FROM public.agencies WHERE id = target_agency_id;
END;
$$;

REVOKE ALL ON FUNCTION public.realty_admin_delete_agency(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.realty_admin_delete_agency(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;