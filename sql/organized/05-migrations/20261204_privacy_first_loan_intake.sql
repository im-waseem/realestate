BEGIN;

-- Extend the loan intake to the explicitly requested applicant fields.
ALTER TABLE public.loan_leads
  ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS middle_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mother_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS father_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS pincode TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS applicant_address TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.agency_loan_field_settings (
  agency_id TEXT PRIMARY KEY REFERENCES public.agencies(id) ON DELETE CASCADE,
  enabled_fields TEXT[] NOT NULL DEFAULT ARRAY['first_name','middle_name','mother_name','father_name','date_of_birth','pincode','applicant_address']::TEXT[],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT agency_loan_field_settings_valid_fields CHECK (enabled_fields <@ ARRAY['first_name','middle_name','mother_name','father_name','date_of_birth','pincode','applicant_address']::TEXT[])
);

INSERT INTO public.agency_loan_field_settings (agency_id)
SELECT id FROM public.agencies ON CONFLICT (agency_id) DO NOTHING;

ALTER TABLE public.agency_loan_field_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agency_loan_field_settings_read ON public.agency_loan_field_settings;
CREATE POLICY agency_loan_field_settings_read ON public.agency_loan_field_settings
  FOR SELECT TO authenticated USING (public.realty_is_super_admin() OR agency_id = (SELECT public.realty_current_agency_id()));
DROP POLICY IF EXISTS agency_loan_field_settings_admin ON public.agency_loan_field_settings;
CREATE POLICY agency_loan_field_settings_admin ON public.agency_loan_field_settings
  FOR ALL TO authenticated USING (public.realty_is_super_admin()) WITH CHECK (public.realty_is_super_admin());
REVOKE ALL ON public.agency_loan_field_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.agency_loan_field_settings TO authenticated;
GRANT INSERT (agency_id, enabled_fields), UPDATE (agency_id, enabled_fields, updated_at) ON public.agency_loan_field_settings TO authenticated;

CREATE OR REPLACE FUNCTION public.realty_guard_loan_intake_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE allowed TEXT[];
BEGIN
  SELECT s.enabled_fields INTO allowed FROM public.agency_loan_field_settings s WHERE s.agency_id = NEW.agency_id;
  allowed := COALESCE(allowed, ARRAY['first_name','middle_name','mother_name','father_name','date_of_birth','pincode','applicant_address']::TEXT[]);
  IF NOT ('first_name' = ANY(allowed)) AND NEW.first_name <> '' AND (TG_OP = 'INSERT' OR NEW.first_name IS DISTINCT FROM OLD.first_name) THEN RAISE EXCEPTION 'First name is disabled for this agency.'; END IF;
  IF NOT ('middle_name' = ANY(allowed)) AND NEW.middle_name <> '' AND (TG_OP = 'INSERT' OR NEW.middle_name IS DISTINCT FROM OLD.middle_name) THEN RAISE EXCEPTION 'Middle name is disabled for this agency.'; END IF;
  IF NOT ('mother_name' = ANY(allowed)) AND NEW.mother_name <> '' AND (TG_OP = 'INSERT' OR NEW.mother_name IS DISTINCT FROM OLD.mother_name) THEN RAISE EXCEPTION 'Mother name is disabled for this agency.'; END IF;
  IF NOT ('father_name' = ANY(allowed)) AND NEW.father_name <> '' AND (TG_OP = 'INSERT' OR NEW.father_name IS DISTINCT FROM OLD.father_name) THEN RAISE EXCEPTION 'Father name is disabled for this agency.'; END IF;
  IF NOT ('date_of_birth' = ANY(allowed)) AND NEW.date_of_birth IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth) THEN RAISE EXCEPTION 'Date of birth is disabled for this agency.'; END IF;
  IF NOT ('pincode' = ANY(allowed)) AND NEW.pincode <> '' AND (TG_OP = 'INSERT' OR NEW.pincode IS DISTINCT FROM OLD.pincode) THEN RAISE EXCEPTION 'PIN code is disabled for this agency.'; END IF;
  IF NOT ('applicant_address' = ANY(allowed)) AND NEW.applicant_address <> '' AND (TG_OP = 'INSERT' OR NEW.applicant_address IS DISTINCT FROM OLD.applicant_address) THEN RAISE EXCEPTION 'Applicant address is disabled for this agency.'; END IF;
  NEW.customer_name := COALESCE(NULLIF(concat_ws(' ',
    CASE WHEN 'first_name' = ANY(allowed) THEN NEW.first_name END,
    CASE WHEN 'middle_name' = ANY(allowed) THEN NEW.middle_name END), ''), 'Applicant');
  RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS loan_leads_guard_intake_fields ON public.loan_leads;
CREATE TRIGGER loan_leads_guard_intake_fields BEFORE INSERT OR UPDATE ON public.loan_leads
  FOR EACH ROW EXECUTE FUNCTION public.realty_guard_loan_intake_fields();

DROP POLICY IF EXISTS loan_leads_read_workspace ON public.loan_leads;
CREATE POLICY loan_leads_read_workspace ON public.loan_leads FOR SELECT TO authenticated
USING (public.realty_is_super_admin() OR (
  agency_id = (SELECT public.realty_current_agency_id())
  AND public.realty_current_role() IN ('agency_admin', 'agent')
  AND public.realty_agency_is_active(agency_id)
  AND public.realty_agency_feature_enabled(agency_id, 'loans')
));

GRANT INSERT (first_name, middle_name, mother_name, father_name, date_of_birth, pincode, applicant_address)
  ON public.loan_leads TO authenticated;
GRANT UPDATE (first_name, middle_name, mother_name, father_name, date_of_birth, pincode, applicant_address)
  ON public.loan_leads TO authenticated;

DROP VIEW IF EXISTS public.loan_leads_admin_v;
CREATE VIEW public.loan_leads_admin_v WITH (security_invoker = true) AS
SELECT l.id, l.agency_id, a.name AS agency_name, l.loan_type, lt.name AS loan_type_name,
       l.preferred_lender_id, pl.name AS preferred_lender_name,
       l.assigned_lender_id, al.name AS lender_name,
       COALESCE(NULLIF(concat_ws(' ', CASE WHEN 'first_name' = ANY(COALESCE(s.enabled_fields, ARRAY['first_name','middle_name','mother_name','father_name','date_of_birth','pincode','applicant_address']::TEXT[])) THEN l.first_name END,
         CASE WHEN 'middle_name' = ANY(COALESCE(s.enabled_fields, ARRAY['first_name','middle_name','mother_name','father_name','date_of_birth','pincode','applicant_address']::TEXT[])) THEN l.middle_name END), ''), 'Applicant') AS customer_name,
       CASE WHEN 'first_name' = ANY(COALESCE(s.enabled_fields, ARRAY['first_name','middle_name','mother_name','father_name','date_of_birth','pincode','applicant_address']::TEXT[])) THEN l.first_name ELSE '' END AS first_name,
       CASE WHEN 'middle_name' = ANY(COALESCE(s.enabled_fields, ARRAY['first_name','middle_name','mother_name','father_name','date_of_birth','pincode','applicant_address']::TEXT[])) THEN l.middle_name ELSE '' END AS middle_name,
       CASE WHEN 'mother_name' = ANY(COALESCE(s.enabled_fields, ARRAY['first_name','middle_name','mother_name','father_name','date_of_birth','pincode','applicant_address']::TEXT[])) THEN l.mother_name ELSE '' END AS mother_name,
       CASE WHEN 'father_name' = ANY(COALESCE(s.enabled_fields, ARRAY['first_name','middle_name','mother_name','father_name','date_of_birth','pincode','applicant_address']::TEXT[])) THEN l.father_name ELSE '' END AS father_name,
       CASE WHEN 'date_of_birth' = ANY(COALESCE(s.enabled_fields, ARRAY['first_name','middle_name','mother_name','father_name','date_of_birth','pincode','applicant_address']::TEXT[])) THEN l.date_of_birth END AS date_of_birth,
       l.phone, l.email,
       CASE WHEN 'pincode' = ANY(COALESCE(s.enabled_fields, ARRAY['first_name','middle_name','mother_name','father_name','date_of_birth','pincode','applicant_address']::TEXT[])) THEN l.pincode ELSE '' END AS pincode,
       CASE WHEN 'applicant_address' = ANY(COALESCE(s.enabled_fields, ARRAY['first_name','middle_name','mother_name','father_name','date_of_birth','pincode','applicant_address']::TEXT[])) THEN l.applicant_address ELSE '' END AS applicant_address,
       l.city, l.employment_type, l.monthly_income, l.loan_amount, l.tenure_months,
       l.property_id, l.source_lead_id, l.preferred_bank, l.notes, l.consent,
       l.consent_at, l.status, l.forwarded_at, l.admin_remarks, l.sanctioned_amount,
       l.sanctioned_at, l.disbursed_amount, l.disbursed_at, l.created_by, l.created_at, l.updated_at
FROM public.loan_leads l
JOIN public.agencies a ON a.id = l.agency_id
LEFT JOIN public.loan_types lt ON lt.code = l.loan_type
LEFT JOIN public.lenders pl ON pl.id = l.preferred_lender_id
LEFT JOIN public.lenders al ON al.id = l.assigned_lender_id
LEFT JOIN public.agency_loan_field_settings s ON s.agency_id = l.agency_id
WHERE public.realty_is_super_admin();
GRANT SELECT ON public.loan_leads_admin_v TO authenticated;

CREATE OR REPLACE VIEW public.loan_summary_by_agency_v WITH (security_invoker = true) AS
SELECT a.id AS agency_id, a.name AS agency_name,
       count(l.id)::BIGINT AS total_leads,
       count(l.id) FILTER (WHERE l.status IN ('draft', 'submitted_to_admin'))::BIGINT AS submitted_to_admin,
       count(l.id) FILTER (WHERE l.status = 'under_review')::BIGINT AS under_review,
       count(l.id) FILTER (WHERE l.status = 'info_requested')::BIGINT AS info_requested,
       count(l.id) FILTER (WHERE l.status = 'sanctioned')::BIGINT AS sanctioned,
       count(l.id) FILTER (WHERE l.status = 'disbursed')::BIGINT AS disbursed,
       count(l.id) FILTER (WHERE l.status = 'rejected')::BIGINT AS rejected
FROM public.agencies a LEFT JOIN public.loan_leads l ON l.agency_id = a.id
WHERE public.realty_is_super_admin()
GROUP BY a.id, a.name;
GRANT SELECT ON public.loan_summary_by_agency_v TO authenticated;

-- Disable new loan document uploads. Existing records are retained until they
-- are reviewed for an explicit retention/purge decision.
DROP POLICY IF EXISTS loan_documents_insert_workspace ON public.loan_documents;
CREATE POLICY loan_documents_insert_workspace ON public.loan_documents
  FOR INSERT TO authenticated WITH CHECK (FALSE);
REVOKE INSERT (lead_id, agency_id, doc_type, file_path, file_name, content_type, file_size)
  ON public.loan_documents FROM authenticated;
REVOKE SELECT, UPDATE ON public.loan_documents FROM authenticated;
REVOKE UPDATE (verified, verified_by, verified_at) ON public.loan_documents FROM authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
