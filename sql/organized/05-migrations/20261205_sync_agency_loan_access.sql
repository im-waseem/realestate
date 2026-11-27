BEGIN;

-- Loan product switches are the source of truth for agency access. This keeps
-- agencies enabled in older databases visible even if agencies.features.loans
-- was never synchronized with their already-enabled products.
CREATE OR REPLACE FUNCTION public.realty_agency_feature_enabled(target_agency_id TEXT, feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COALESCE((
    SELECT COALESCE((a.features->>feature_key)::BOOLEAN, FALSE)
      OR (feature_key = 'loans' AND EXISTS (
        SELECT 1 FROM public.agency_loan_products p
        WHERE p.agency_id = a.id AND p.enabled
      ))
    FROM public.agencies a
    WHERE a.id = target_agency_id
      AND feature_key IN ('home_loans', 'loans', 'tools')
      AND (target_agency_id = (SELECT public.realty_current_agency_id()) OR public.realty_is_super_admin())
  ), FALSE)
$function$;

NOTIFY pgrst, 'reload schema';
COMMIT;
