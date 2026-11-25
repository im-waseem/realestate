-- Run after the existing schema, in Supabase SQL editor as postgres.
BEGIN;

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
