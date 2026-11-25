-- Existing projects: apply after 20261108_service_provider_crud_access.sql.
-- QR visitors receive one active agency's limited public contact details.
-- Agency workspace users can manage only service-provider rows for their own agency.
BEGIN;

CREATE OR REPLACE FUNCTION public.realty_public_agency(target_agency_id TEXT)
RETURNS TABLE (id TEXT, name TEXT, phone TEXT, address TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT a.id, a.name, a.phone, a.address, a.lat, a.lng
  FROM public.agencies AS a
  WHERE a.id = target_agency_id
    AND a.status = 'active';
$$;
REVOKE ALL ON FUNCTION public.realty_public_agency(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.realty_public_agency(TEXT) TO anon, authenticated;
COMMENT ON FUNCTION public.realty_public_agency(TEXT) IS
  'Returns only an active agency contact projection for QR visitors; private workspace records are not exposed.';

-- QR form submissions are routed through the server's service-role client,
-- which validates the agency and rate-limits each destination in this function.
REVOKE ALL ON FUNCTION public.realty_submit_agency_enquiry(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.realty_submit_agency_enquiry(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO service_role;

ALTER TABLE public.service_providers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_providers_read_workspace ON public.service_providers;
DROP POLICY IF EXISTS service_providers_insert_workspace ON public.service_providers;
DROP POLICY IF EXISTS service_providers_update_workspace ON public.service_providers;
DROP POLICY IF EXISTS service_providers_delete_workspace ON public.service_providers;

CREATE POLICY service_providers_read_workspace ON public.service_providers
FOR SELECT TO authenticated
USING (
  agency_id = (SELECT public.realty_current_agency_id())
  AND public.realty_current_role() IN ('agency_admin', 'agent')
  AND public.realty_agency_is_active(agency_id)
);

CREATE POLICY service_providers_insert_workspace ON public.service_providers
FOR INSERT TO authenticated
WITH CHECK (
  agency_id = (SELECT public.realty_current_agency_id())
  AND public.realty_current_role() IN ('agency_admin', 'agent')
  AND public.realty_agency_is_active(agency_id)
);

CREATE POLICY service_providers_update_workspace ON public.service_providers
FOR UPDATE TO authenticated
USING (
  agency_id = (SELECT public.realty_current_agency_id())
  AND public.realty_current_role() IN ('agency_admin', 'agent')
  AND public.realty_agency_is_active(agency_id)
)
WITH CHECK (
  agency_id = (SELECT public.realty_current_agency_id())
  AND public.realty_current_role() IN ('agency_admin', 'agent')
  AND public.realty_agency_is_active(agency_id)
);

CREATE POLICY service_providers_delete_workspace ON public.service_providers
FOR DELETE TO authenticated
USING (
  agency_id = (SELECT public.realty_current_agency_id())
  AND public.realty_current_role() IN ('agency_admin', 'agent')
  AND public.realty_agency_is_active(agency_id)
);

REVOKE ALL ON TABLE public.service_providers FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.service_providers TO authenticated;
COMMENT ON COLUMN public.service_providers.category IS
  'Agency-selected trade or property service; kept as flexible text so service types can evolve without schema changes.';

NOTIFY pgrst, 'reload schema';
COMMIT;
