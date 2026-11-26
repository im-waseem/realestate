BEGIN;

CREATE TABLE IF NOT EXISTS public.loan_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9_]{1,49}$'),
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 100),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO public.loan_types (code, name, sort_order)
VALUES
  ('personal_loan', 'Personal Loan', 10),
  ('business_loan', 'Business Loan', 20),
  ('home_loan', 'Home Loan', 30),
  ('lap', 'Loan Against Property (LAP)', 40),
  ('education_loan', 'Education Loan', 50)
ON CONFLICT (code) DO NOTHING;

-- Keep this migration retryable when the earlier loan-products migration was
-- skipped: the catalog and its agency join table are both required below.
CREATE TABLE IF NOT EXISTS public.agency_loan_products (
  agency_id TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  loan_type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (agency_id, loan_type)
);
ALTER TABLE public.loan_leads ADD COLUMN IF NOT EXISTS loan_type TEXT NOT NULL DEFAULT 'home_loan';
INSERT INTO public.agency_loan_products (agency_id, loan_type, enabled)
SELECT a.id, lt.code, (lt.code = 'home_loan' AND COALESCE((a.features->>'home_loans')::boolean, FALSE))
FROM public.agencies AS a CROSS JOIN public.loan_types AS lt
ON CONFLICT (agency_id, loan_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.lenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 150),
  lender_type TEXT NOT NULL CHECK (lender_type IN ('bank', 'nbfc', 'hfc')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS lenders_name_type_unique ON public.lenders (lower(name), lender_type);

CREATE TABLE IF NOT EXISTS public.commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_type_id UUID NOT NULL REFERENCES public.loan_types(id) ON DELETE RESTRICT,
  lender_id UUID REFERENCES public.lenders(id) ON DELETE RESTRICT,
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE CASCADE,
  basis TEXT NOT NULL CHECK (basis IN ('percent', 'flat')),
  percent NUMERIC(7,4),
  flat_amount NUMERIC(14,2),
  minimum_commission NUMERIC(14,2),
  maximum_commission NUMERIC(14,2),
  agency_share_percent NUMERIC(7,4) NOT NULL DEFAULT 0 CHECK (agency_share_percent BETWEEN 0 AND 100),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT commission_rules_basis_values CHECK (
    (basis = 'percent' AND percent IS NOT NULL AND percent BETWEEN 0 AND 100 AND flat_amount IS NULL)
    OR (basis = 'flat' AND flat_amount IS NOT NULL AND flat_amount >= 0 AND percent IS NULL)
  ),
  CONSTRAINT commission_rules_min_max CHECK (
    (minimum_commission IS NULL OR minimum_commission >= 0)
    AND (maximum_commission IS NULL OR maximum_commission >= 0)
    AND (minimum_commission IS NULL OR maximum_commission IS NULL OR minimum_commission <= maximum_commission)
  ),
  CONSTRAINT commission_rules_effective_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE INDEX IF NOT EXISTS commission_rules_match_idx
  ON public.commission_rules (loan_type_id, lender_id, agency_id, is_active, effective_from DESC);

-- New catalog entries are available for agency-level product configuration.
ALTER TABLE public.agency_loan_products DROP CONSTRAINT IF EXISTS agency_loan_products_loan_type_check;
ALTER TABLE public.loan_leads DROP CONSTRAINT IF EXISTS loan_leads_loan_type_check;
DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.agency_loan_products'::regclass AND conname = 'agency_loan_products_loan_type_fkey') THEN
    ALTER TABLE public.agency_loan_products ADD CONSTRAINT agency_loan_products_loan_type_fkey
      FOREIGN KEY (loan_type) REFERENCES public.loan_types(code) ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.loan_leads'::regclass AND conname = 'loan_leads_loan_type_fkey') THEN
    ALTER TABLE public.loan_leads ADD CONSTRAINT loan_leads_loan_type_fkey
      FOREIGN KEY (loan_type) REFERENCES public.loan_types(code) ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END
$constraints$;

CREATE OR REPLACE FUNCTION public.realty_seed_agency_loan_products()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  INSERT INTO public.agency_loan_products (agency_id, loan_type, enabled)
  SELECT NEW.id, lt.code, (lt.code = 'home_loan' AND COALESCE((NEW.features->>'home_loans')::boolean, FALSE))
  FROM public.loan_types AS lt
  ON CONFLICT (agency_id, loan_type) DO NOTHING;
  RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS agencies_seed_loan_products ON public.agencies;
CREATE TRIGGER agencies_seed_loan_products AFTER INSERT ON public.agencies
FOR EACH ROW EXECUTE FUNCTION public.realty_seed_agency_loan_products();

CREATE OR REPLACE FUNCTION public.realty_seed_loan_type_for_agencies()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  INSERT INTO public.agency_loan_products (agency_id, loan_type, enabled)
  SELECT a.id, NEW.code, FALSE FROM public.agencies AS a
  ON CONFLICT (agency_id, loan_type) DO NOTHING;
  RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS loan_types_seed_agencies ON public.loan_types;
CREATE TRIGGER loan_types_seed_agencies AFTER INSERT ON public.loan_types
FOR EACH ROW EXECUTE FUNCTION public.realty_seed_loan_type_for_agencies();

CREATE OR REPLACE FUNCTION public.realty_guard_enabled_loan_product()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.agency_loan_products AS p
    JOIN public.loan_types AS lt ON lt.code = p.loan_type
    WHERE p.agency_id = NEW.agency_id AND p.loan_type = NEW.loan_type
      AND p.enabled AND lt.is_active
  ) THEN
    RAISE EXCEPTION 'This loan type is not enabled for the selected agency.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.realty_stamp_loan_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $function$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS loan_leads_require_enabled_product ON public.loan_leads;
CREATE TRIGGER loan_leads_require_enabled_product
BEFORE INSERT OR UPDATE OF agency_id, loan_type ON public.loan_leads
FOR EACH ROW EXECUTE FUNCTION public.realty_guard_enabled_loan_product();
DROP TRIGGER IF EXISTS agency_loan_products_updated_at ON public.agency_loan_products;
CREATE TRIGGER agency_loan_products_updated_at BEFORE UPDATE ON public.agency_loan_products
FOR EACH ROW EXECUTE FUNCTION public.realty_stamp_loan_updated_at();
DROP TRIGGER IF EXISTS loan_types_updated_at ON public.loan_types;
CREATE TRIGGER loan_types_updated_at BEFORE UPDATE ON public.loan_types
FOR EACH ROW EXECUTE FUNCTION public.realty_stamp_loan_updated_at();
DROP TRIGGER IF EXISTS lenders_updated_at ON public.lenders;
CREATE TRIGGER lenders_updated_at BEFORE UPDATE ON public.lenders
FOR EACH ROW EXECUTE FUNCTION public.realty_stamp_loan_updated_at();
DROP TRIGGER IF EXISTS commission_rules_updated_at ON public.commission_rules;
CREATE TRIGGER commission_rules_updated_at BEFORE UPDATE ON public.commission_rules
FOR EACH ROW EXECUTE FUNCTION public.realty_stamp_loan_updated_at();

ALTER TABLE public.loan_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS loan_types_read_active ON public.loan_types;
CREATE POLICY loan_types_read_active ON public.loan_types FOR SELECT TO authenticated
USING (is_active OR public.realty_is_super_admin());
DROP POLICY IF EXISTS loan_types_manage_admin ON public.loan_types;
CREATE POLICY loan_types_manage_admin ON public.loan_types FOR ALL TO authenticated
USING (public.realty_is_super_admin()) WITH CHECK (public.realty_is_super_admin());

ALTER TABLE public.agency_loan_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agency_loan_products_read_workspace ON public.agency_loan_products;
CREATE POLICY agency_loan_products_read_workspace ON public.agency_loan_products FOR SELECT TO authenticated
USING (public.realty_is_super_admin() OR agency_id = (SELECT public.realty_current_agency_id()));
DROP POLICY IF EXISTS agency_loan_products_manage_admin ON public.agency_loan_products;
CREATE POLICY agency_loan_products_manage_admin ON public.agency_loan_products FOR ALL TO authenticated
USING (public.realty_is_super_admin()) WITH CHECK (public.realty_is_super_admin());

DROP POLICY IF EXISTS lenders_read_active ON public.lenders;
CREATE POLICY lenders_read_active ON public.lenders FOR SELECT TO authenticated
USING (is_active OR public.realty_is_super_admin());
DROP POLICY IF EXISTS lenders_manage_admin ON public.lenders;
CREATE POLICY lenders_manage_admin ON public.lenders FOR ALL TO authenticated
USING (public.realty_is_super_admin()) WITH CHECK (public.realty_is_super_admin());

DROP POLICY IF EXISTS commission_rules_manage_admin ON public.commission_rules;
CREATE POLICY commission_rules_manage_admin ON public.commission_rules FOR ALL TO authenticated
USING (public.realty_is_super_admin()) WITH CHECK (public.realty_is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_types, public.lenders, public.commission_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_loan_products TO authenticated;
GRANT INSERT (loan_type) ON TABLE public.loan_leads TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
