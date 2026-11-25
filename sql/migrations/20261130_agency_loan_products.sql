BEGIN;

ALTER TABLE public.loan_leads
  ADD COLUMN IF NOT EXISTS loan_type TEXT NOT NULL DEFAULT 'home_loan';
ALTER TABLE public.loan_leads
  DROP CONSTRAINT IF EXISTS loan_leads_loan_type_check;
ALTER TABLE public.loan_leads
  ADD CONSTRAINT loan_leads_loan_type_check
  CHECK (loan_type IN ('personal_loan', 'business_loan', 'home_loan', 'lap', 'education_loan'));

ALTER TABLE public.loan_documents
  DROP CONSTRAINT IF EXISTS loan_documents_doc_type_check;
ALTER TABLE public.loan_documents
  ADD CONSTRAINT loan_documents_doc_type_check
  CHECK (length(btrim(doc_type)) BETWEEN 1 AND 80);

CREATE TABLE IF NOT EXISTS public.agency_loan_products (
  agency_id TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  loan_type TEXT NOT NULL CHECK (loan_type IN ('personal_loan', 'business_loan', 'home_loan', 'lap', 'education_loan')),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (agency_id, loan_type)
);

DROP TRIGGER IF EXISTS agency_loan_products_updated_at ON public.agency_loan_products;
CREATE TRIGGER agency_loan_products_updated_at
BEFORE UPDATE ON public.agency_loan_products
FOR EACH ROW EXECUTE FUNCTION public.realty_stamp_loan_updated_at();

INSERT INTO public.agency_loan_products (agency_id, loan_type, enabled)
SELECT a.id, p.loan_type, (p.loan_type = 'home_loan' AND COALESCE((a.features->>'home_loans')::boolean, FALSE))
FROM public.agencies AS a
CROSS JOIN (VALUES ('personal_loan'), ('business_loan'), ('home_loan'), ('lap'), ('education_loan')) AS p(loan_type)
ON CONFLICT (agency_id, loan_type) DO NOTHING;

CREATE OR REPLACE FUNCTION public.realty_seed_agency_loan_products()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.agency_loan_products (agency_id, loan_type, enabled)
  SELECT NEW.id, p.loan_type, (p.loan_type = 'home_loan' AND COALESCE((NEW.features->>'home_loans')::boolean, FALSE))
  FROM (VALUES ('personal_loan'), ('business_loan'), ('home_loan'), ('lap'), ('education_loan')) AS p(loan_type)
  ON CONFLICT (agency_id, loan_type) DO NOTHING;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS agencies_seed_loan_products ON public.agencies;
CREATE TRIGGER agencies_seed_loan_products
AFTER INSERT ON public.agencies
FOR EACH ROW EXECUTE FUNCTION public.realty_seed_agency_loan_products();

CREATE OR REPLACE FUNCTION public.realty_guard_enabled_loan_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.agency_loan_products AS p
    WHERE p.agency_id = NEW.agency_id AND p.loan_type = NEW.loan_type AND p.enabled
  ) THEN
    RAISE EXCEPTION 'This loan type is not enabled for the selected agency.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS loan_leads_require_enabled_product ON public.loan_leads;
CREATE TRIGGER loan_leads_require_enabled_product
BEFORE INSERT OR UPDATE OF agency_id, loan_type ON public.loan_leads
FOR EACH ROW EXECUTE FUNCTION public.realty_guard_enabled_loan_product();

GRANT INSERT (loan_type) ON TABLE public.loan_leads TO authenticated;

ALTER TABLE public.agency_loan_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agency_loan_products_read_workspace ON public.agency_loan_products;
CREATE POLICY agency_loan_products_read_workspace ON public.agency_loan_products
FOR SELECT TO authenticated
USING (public.realty_is_super_admin() OR agency_id = (SELECT public.realty_current_agency_id()));
DROP POLICY IF EXISTS agency_loan_products_manage_admin ON public.agency_loan_products;
CREATE POLICY agency_loan_products_manage_admin ON public.agency_loan_products
FOR ALL TO authenticated
USING (public.realty_is_super_admin())
WITH CHECK (public.realty_is_super_admin());

REVOKE ALL ON TABLE public.agency_loan_products FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.agency_loan_products TO authenticated;
GRANT INSERT (agency_id, loan_type, enabled), UPDATE (agency_id, loan_type, enabled, updated_at)
  ON TABLE public.agency_loan_products TO authenticated;

COMMIT;
