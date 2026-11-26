BEGIN;

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rera_agent_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rera_state TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rera_certificate_path TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rera_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rera_verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rera_verified_at TIMESTAMPTZ;

ALTER TABLE public.agencies DROP CONSTRAINT IF EXISTS agencies_status_check;
-- This migration may be run from the Supabase SQL editor, where there is no
-- authenticated super-admin profile in auth.uid(). Temporarily remove the
-- application guard while converting legacy statuses, then restore it below.
DROP TRIGGER IF EXISTS agencies_guard_status ON public.agencies;
-- Existing active agencies are already approved in the current application.
UPDATE public.agencies SET status = 'approved' WHERE status = 'active';
ALTER TABLE public.agencies
  ADD CONSTRAINT agencies_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'suspended'));

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

CREATE TRIGGER agencies_guard_status
BEFORE UPDATE OF status ON public.agencies
FOR EACH ROW EXECUTE FUNCTION public.realty_guard_agency_status();

CREATE OR REPLACE FUNCTION public.realty_agency_is_active(target_agency_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.agencies AS a
    WHERE a.id = target_agency_id AND a.status = 'approved'
  )
$function$;

-- Keep the public listing, photo, agency-contact, and enquiry RPCs aligned with
-- the new agency status value while preserving their existing validation.
DO $functions$
DECLARE
  function_definition TEXT;
  target_function REGPROCEDURE;
BEGIN
  FOR target_function IN
    SELECT p.oid::regprocedure
    FROM pg_catalog.pg_proc AS p
    JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'realty_public_properties',
        'realty_public_photo_allowed',
        'realty_public_agency',
        'realty_submit_agency_enquiry',
        'realty_submit_public_enquiry'
      )
  LOOP
    function_definition := pg_catalog.pg_get_functiondef(target_function::oid);
    function_definition := pg_catalog.replace(function_definition, 'status=''active''', 'status=''approved''');
    function_definition := pg_catalog.replace(function_definition, 'status = ''active''', 'status = ''approved''');
    EXECUTE function_definition;
  END LOOP;
END
$functions$;

CREATE OR REPLACE FUNCTION public.realty_guard_agency_approval_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT public.realty_is_super_admin() AND (
    NEW.is_active IS DISTINCT FROM OLD.is_active
    OR
    NEW.approved_by IS DISTINCT FROM OLD.approved_by
    OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
    OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
    OR NEW.rera_verified IS DISTINCT FROM OLD.rera_verified
    OR NEW.rera_verified_by IS DISTINCT FROM OLD.rera_verified_by
    OR NEW.rera_verified_at IS DISTINCT FROM OLD.rera_verified_at
  ) THEN
    RAISE EXCEPTION 'Only the platform admin can change agency approval or RERA verification';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS agencies_guard_approval_fields ON public.agencies;
CREATE TRIGGER agencies_guard_approval_fields
BEFORE UPDATE OF is_active, approved_by, approved_at, rejection_reason, rera_verified, rera_verified_by, rera_verified_at
ON public.agencies
FOR EACH ROW EXECUTE FUNCTION public.realty_guard_agency_approval_fields();

GRANT UPDATE (status, is_active, approved_by, approved_at, rejection_reason,
              rera_verified, rera_verified_by, rera_verified_at, features)
  ON TABLE public.agencies TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'agency-rera-documents',
  'agency-rera-documents',
  FALSE,
  5242880,
  ARRAY['application/pdf', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

NOTIFY pgrst, 'reload schema';
COMMIT;
