-- Apply after 20261124_agency_uploads_hardening.sql.
-- Adds default-off agency feature flags and gates the tools directory in RLS.
BEGIN;

-- Keep auth queries compatible with databases where the earlier account
-- migration was skipped or applied to a different project.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS features JSONB NOT NULL
  DEFAULT '{"home_loans":false,"tools":false}'::jsonb;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.agencies'::regclass
      AND conname = 'agencies_features_shape'
  ) THEN
    ALTER TABLE public.agencies
      ADD CONSTRAINT agencies_features_shape CHECK (
        jsonb_typeof(features) = 'object'
        AND jsonb_typeof(features->'home_loans') = 'boolean'
        AND jsonb_typeof(features->'tools') = 'boolean'
        AND features - 'home_loans' - 'tools' = '{}'::jsonb
      ) NOT VALID;
  END IF;
END
$constraints$;

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

GRANT UPDATE (features) ON TABLE public.agencies TO authenticated;
REVOKE ALL ON FUNCTION public.realty_agency_feature_enabled(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.realty_agency_feature_enabled(TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
