-- Existing projects: apply after 20261107_agency_qr_enquiries.sql.
-- Reassert agency-scoped CRUD access for the service-provider directory.
BEGIN;

ALTER TABLE public.service_providers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_providers_read_workspace ON public.service_providers;
DROP POLICY IF EXISTS service_providers_insert_workspace ON public.service_providers;
DROP POLICY IF EXISTS service_providers_update_workspace ON public.service_providers;
DROP POLICY IF EXISTS service_providers_delete_workspace ON public.service_providers;

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

NOTIFY pgrst, 'reload schema';
COMMIT;
