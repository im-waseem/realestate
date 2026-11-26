BEGIN;

-- Add a separate agency feature switch while preserving the existing home_loans
-- feature used by the legacy pipeline.
ALTER TABLE public.agencies DROP CONSTRAINT IF EXISTS agencies_features_shape;
DROP TRIGGER IF EXISTS agencies_guard_features ON public.agencies;
UPDATE public.agencies
SET features = jsonb_set(COALESCE(features, '{}'::jsonb), '{loans}', COALESCE(features->'loans', 'false'::jsonb), TRUE);
ALTER TABLE public.agencies
  ALTER COLUMN features SET DEFAULT '{"home_loans":false,"loans":false,"tools":false}'::jsonb,
  ADD CONSTRAINT agencies_features_shape CHECK (
    jsonb_typeof(features) = 'object'
    AND jsonb_typeof(features->'home_loans') = 'boolean'
    AND jsonb_typeof(features->'loans') = 'boolean'
    AND jsonb_typeof(features->'tools') = 'boolean'
    AND features - 'home_loans' - 'loans' - 'tools' = '{}'::jsonb
  );
CREATE OR REPLACE FUNCTION public.realty_agency_feature_enabled(target_agency_id TEXT, feature_key TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $function$
  SELECT COALESCE((SELECT (a.features->>feature_key)::BOOLEAN FROM public.agencies AS a
    WHERE a.id = target_agency_id AND feature_key IN ('home_loans', 'loans', 'tools')
      AND (target_agency_id = (SELECT public.realty_current_agency_id()) OR public.realty_is_super_admin())), FALSE)
$function$;
CREATE OR REPLACE FUNCTION public.realty_guard_agency_features()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  IF NEW.features IS DISTINCT FROM OLD.features AND NOT public.realty_is_super_admin() THEN
    RAISE EXCEPTION 'Only the main admin can change agency features';
  END IF;
  RETURN NEW;
END
$function$;
CREATE TRIGGER agencies_guard_features BEFORE UPDATE OF features ON public.agencies
FOR EACH ROW EXECUTE FUNCTION public.realty_guard_agency_features();

ALTER TABLE public.loan_leads
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tenure_months INTEGER NOT NULL DEFAULT 0 CHECK (tenure_months BETWEEN 0 AND 600),
  ADD COLUMN IF NOT EXISTS consent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS preferred_lender_id UUID REFERENCES public.lenders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_lender_id UUID REFERENCES public.lenders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS forwarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_remarks TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sanctioned_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS sanctioned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disbursed_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS disbursed_at TIMESTAMPTZ;

ALTER TABLE public.loan_leads DROP CONSTRAINT IF EXISTS loan_leads_status_check;
UPDATE public.loan_leads SET
  status = CASE status
    WHEN 'new' THEN 'submitted_to_admin'
    WHEN 'docs-collected' THEN 'submitted_to_admin'
    WHEN 'submitted' THEN 'submitted_to_admin'
    ELSE status
  END,
  forwarded_at = CASE
    WHEN status IN ('new', 'docs-collected', 'submitted') THEN COALESCE(updated_at, created_at)
    ELSE forwarded_at
  END;
ALTER TABLE public.loan_leads
  ALTER COLUMN status SET DEFAULT 'draft',
  ADD CONSTRAINT loan_leads_status_check CHECK (status IN (
    'draft', 'info_requested', 'submitted_to_admin', 'under_review',
    'sanctioned', 'disbursed', 'rejected', 'cancelled'
  )),
  ADD CONSTRAINT loan_leads_sanctioned_amount_check CHECK (sanctioned_amount IS NULL OR sanctioned_amount >= 0),
  ADD CONSTRAINT loan_leads_disbursed_amount_check CHECK (disbursed_amount IS NULL OR disbursed_amount >= 0);

CREATE TABLE IF NOT EXISTS public.loan_lead_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_lead_id UUID NOT NULL REFERENCES public.loan_leads(id) ON DELETE CASCADE,
  agency_id TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'updated', 'submitted', 'status_changed', 'document_uploaded')),
  from_status TEXT,
  to_status TEXT,
  remark TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS loan_lead_history_timeline_idx ON public.loan_lead_history (loan_lead_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.realty_guard_loan_lead_workflow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF public.realty_current_role() = 'super_admin' THEN RETURN NEW; END IF;
    IF NEW.agency_id IS DISTINCT FROM (SELECT public.realty_current_agency_id())
      OR NEW.created_by IS DISTINCT FROM (SELECT auth.uid())
      OR NEW.status <> 'draft'
      OR NEW.admin_remarks <> ''
      OR NEW.assigned_lender_id IS NOT NULL
      OR NEW.sanctioned_amount IS NOT NULL OR NEW.sanctioned_at IS NOT NULL
      OR NEW.disbursed_amount IS NOT NULL OR NEW.disbursed_at IS NOT NULL
      OR NEW.forwarded_at IS NOT NULL THEN
      RAISE EXCEPTION 'Agency loan leads must be created from the signed-in agency session';
    END IF;
    RETURN NEW;
  END IF;

  IF public.realty_current_role() = 'super_admin' THEN RETURN NEW; END IF;
  IF NEW.agency_id IS DISTINCT FROM OLD.agency_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.admin_remarks IS DISTINCT FROM OLD.admin_remarks
    OR NEW.assigned_lender_id IS DISTINCT FROM OLD.assigned_lender_id
    OR NEW.sanctioned_amount IS DISTINCT FROM OLD.sanctioned_amount
    OR NEW.sanctioned_at IS DISTINCT FROM OLD.sanctioned_at
    OR NEW.disbursed_amount IS DISTINCT FROM OLD.disbursed_amount
    OR NEW.disbursed_at IS DISTINCT FROM OLD.disbursed_at
    OR NEW.forwarded_at IS DISTINCT FROM OLD.forwarded_at THEN
    RAISE EXCEPTION 'Only the platform admin can change admin loan fields';
  END IF;
  IF OLD.status NOT IN ('draft', 'info_requested') THEN
    RAISE EXCEPTION 'This loan request is locked after submission';
  END IF;
  IF NEW.status NOT IN (OLD.status, 'submitted_to_admin') THEN
    RAISE EXCEPTION 'Agency users cannot set this loan status';
  END IF;
  IF NEW.status = 'submitted_to_admin' AND OLD.status <> 'submitted_to_admin' THEN
    IF NOT NEW.consent OR NEW.customer_name = '' OR NEW.phone = '' OR NEW.city = ''
      OR NEW.loan_amount <= 0 OR NEW.monthly_income <= 0 OR NEW.tenure_months <= 0 THEN
      RAISE EXCEPTION 'Consent and all required loan details are required before submission';
    END IF;
    NEW.forwarded_at := pg_catalog.now();
    NEW.consent_at := pg_catalog.now();
  END IF;
  RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS loan_leads_guard_workflow ON public.loan_leads;
CREATE TRIGGER loan_leads_guard_workflow BEFORE INSERT OR UPDATE ON public.loan_leads
FOR EACH ROW EXECUTE FUNCTION public.realty_guard_loan_lead_workflow();

-- Replace the prior broad policies with agency-scoped, feature-gated access.
DROP POLICY IF EXISTS loan_leads_read_workspace ON public.loan_leads;
CREATE POLICY loan_leads_read_workspace ON public.loan_leads FOR SELECT TO authenticated
USING (public.realty_is_super_admin() OR (
  agency_id = (SELECT public.realty_current_agency_id())
  AND public.realty_current_role() IN ('agency_admin', 'agent')
  AND public.realty_agency_is_active(agency_id)
  AND public.realty_agency_feature_enabled(agency_id, 'loans')
));
DROP POLICY IF EXISTS loan_leads_insert_workspace ON public.loan_leads;
CREATE POLICY loan_leads_insert_workspace ON public.loan_leads FOR INSERT TO authenticated
WITH CHECK (public.realty_is_super_admin() OR (
  agency_id = (SELECT public.realty_current_agency_id())
  AND created_by = (SELECT auth.uid())
  AND public.realty_current_role() IN ('agency_admin', 'agent')
  AND public.realty_agency_is_active(agency_id)
  AND public.realty_agency_feature_enabled(agency_id, 'loans')
));
DROP POLICY IF EXISTS loan_leads_update_workspace ON public.loan_leads;
CREATE POLICY loan_leads_update_workspace ON public.loan_leads FOR UPDATE TO authenticated
USING (public.realty_is_super_admin() OR (
  agency_id = (SELECT public.realty_current_agency_id())
  AND public.realty_current_role() IN ('agency_admin', 'agent')
  AND public.realty_agency_is_active(agency_id)
  AND public.realty_agency_feature_enabled(agency_id, 'loans')
  AND status IN ('draft', 'info_requested')
))
WITH CHECK (public.realty_is_super_admin() OR (
  agency_id = (SELECT public.realty_current_agency_id())
  AND public.realty_current_role() IN ('agency_admin', 'agent')
  AND public.realty_agency_is_active(agency_id)
  AND public.realty_agency_feature_enabled(agency_id, 'loans')
));

ALTER TABLE public.loan_lead_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loan_lead_history_read_workspace ON public.loan_lead_history;
CREATE POLICY loan_lead_history_read_workspace ON public.loan_lead_history FOR SELECT TO authenticated
USING (public.realty_is_super_admin() OR (
  agency_id = (SELECT public.realty_current_agency_id())
  AND public.realty_agency_is_active(agency_id)
  AND public.realty_agency_feature_enabled(agency_id, 'loans')
));

-- Existing documents are shared by both loan workflows; use the new feature flag
-- for the loan portal while retaining compatibility with the old home-loans tool.
DROP POLICY IF EXISTS loan_documents_read_workspace ON public.loan_documents;
CREATE POLICY loan_documents_read_workspace ON public.loan_documents FOR SELECT TO authenticated
USING (public.realty_is_super_admin() OR (
  agency_id = (SELECT public.realty_current_agency_id())
  AND public.realty_current_role() IN ('agency_admin', 'agent')
  AND public.realty_agency_is_active(agency_id)
  AND (public.realty_agency_feature_enabled(agency_id, 'loans') OR public.realty_agency_feature_enabled(agency_id, 'home_loans'))
));
DROP POLICY IF EXISTS loan_documents_insert_workspace ON public.loan_documents;
CREATE POLICY loan_documents_insert_workspace ON public.loan_documents FOR INSERT TO authenticated
WITH CHECK (public.realty_is_super_admin() OR (
  agency_id = (SELECT public.realty_current_agency_id())
  AND public.realty_current_role() IN ('agency_admin', 'agent')
  AND public.realty_agency_is_active(agency_id)
  AND (public.realty_agency_feature_enabled(agency_id, 'loans') OR public.realty_agency_feature_enabled(agency_id, 'home_loans'))
  AND EXISTS (SELECT 1 FROM public.loan_leads AS l WHERE l.id = lead_id AND l.agency_id = loan_documents.agency_id
    AND ((public.realty_agency_feature_enabled(agency_id, 'loans') AND l.status IN ('draft', 'info_requested'))
      OR public.realty_agency_feature_enabled(agency_id, 'home_loans')))
));

CREATE OR REPLACE VIEW public.loan_leads_admin_v WITH (security_invoker = true) AS
SELECT l.id, l.agency_id, a.name AS agency_name, l.loan_type, lt.name AS loan_type_name,
       l.preferred_lender_id, pl.name AS preferred_lender_name,
       l.assigned_lender_id, al.name AS lender_name,
       l.customer_name, l.phone, l.email, l.city, l.employment_type,
       l.monthly_income, l.loan_amount, l.tenure_months, l.property_id, l.source_lead_id,
       l.preferred_bank, l.notes, l.consent, l.consent_at, l.status, l.forwarded_at,
       l.admin_remarks, l.sanctioned_amount, l.sanctioned_at, l.disbursed_amount,
       l.disbursed_at, l.created_by, l.created_at, l.updated_at
FROM public.loan_leads AS l
JOIN public.agencies AS a ON a.id = l.agency_id
LEFT JOIN public.loan_types AS lt ON lt.code = l.loan_type
LEFT JOIN public.lenders AS pl ON pl.id = l.preferred_lender_id
LEFT JOIN public.lenders AS al ON al.id = l.assigned_lender_id
WHERE public.realty_is_super_admin();

CREATE OR REPLACE VIEW public.loan_summary_by_agency_v WITH (security_invoker = true) AS
SELECT a.id AS agency_id, a.name AS agency_name,
       count(l.id)::BIGINT AS total_leads,
       count(l.id) FILTER (WHERE l.status = 'submitted_to_admin')::BIGINT AS submitted_to_admin,
       count(l.id) FILTER (WHERE l.status = 'under_review')::BIGINT AS under_review,
       count(l.id) FILTER (WHERE l.status = 'info_requested')::BIGINT AS info_requested,
       count(l.id) FILTER (WHERE l.status = 'sanctioned')::BIGINT AS sanctioned,
       count(l.id) FILTER (WHERE l.status = 'disbursed')::BIGINT AS disbursed,
       count(l.id) FILTER (WHERE l.status = 'rejected')::BIGINT AS rejected
FROM public.agencies AS a LEFT JOIN public.loan_leads AS l ON l.agency_id = a.id
WHERE public.realty_is_super_admin()
GROUP BY a.id, a.name;

REVOKE ALL ON public.loan_leads_admin_v, public.loan_summary_by_agency_v FROM PUBLIC, anon;
GRANT SELECT ON public.loan_leads_admin_v, public.loan_summary_by_agency_v TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.loan_leads FROM authenticated;
GRANT SELECT ON TABLE public.loan_leads, public.loan_lead_history TO authenticated;
GRANT INSERT (agency_id, created_by, loan_type, customer_name, phone, email, city, employment_type,
              monthly_income, loan_amount, tenure_months, property_id, source_lead_id,
              preferred_lender_id, preferred_bank, notes, consent, status)
  ON TABLE public.loan_leads TO authenticated;
GRANT UPDATE (loan_type, customer_name, phone, email, city, employment_type, monthly_income,
              loan_amount, tenure_months, property_id, source_lead_id, preferred_lender_id,
              preferred_bank, notes, consent, consent_at, status, admin_remarks,
              assigned_lender_id, sanctioned_amount, sanctioned_at, disbursed_amount,
              disbursed_at, forwarded_at, updated_at)
  ON TABLE public.loan_leads TO authenticated;
GRANT SELECT ON TABLE public.loan_types, public.lenders TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
