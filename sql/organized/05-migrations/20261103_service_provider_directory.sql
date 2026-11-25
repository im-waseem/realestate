-- Existing projects: apply after 20261102_marketplace_and_agency_map.sql.
BEGIN;

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
CREATE INDEX IF NOT EXISTS service_providers_agency_category_idx
  ON public.service_providers (agency_id, category, name);

ALTER TABLE public.service_providers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_providers_read_workspace ON public.service_providers;
CREATE POLICY service_providers_read_workspace ON public.service_providers
FOR SELECT TO authenticated
USING (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
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
  )
)
WITH CHECK (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
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
  )
);

REVOKE ALL ON TABLE public.service_providers FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.service_providers TO authenticated;

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
  DELETE FROM public.users WHERE agency_id = target_agency_id;
  DELETE FROM auth.users
  WHERE id IN (SELECT id FROM public.profiles WHERE agency_id = target_agency_id);
  DELETE FROM public.profiles WHERE agency_id = target_agency_id;
  DELETE FROM public.agencies WHERE id = target_agency_id;
END
$function$;
REVOKE ALL ON FUNCTION public.realty_admin_delete_agency(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.realty_admin_delete_agency(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
