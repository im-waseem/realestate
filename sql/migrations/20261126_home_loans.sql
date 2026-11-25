BEGIN;

CREATE TABLE IF NOT EXISTS public.loan_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  source_lead_id TEXT REFERENCES public.leads(id) ON DELETE SET NULL,
  property_id TEXT REFERENCES public.properties(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL CHECK (length(btrim(customer_name)) BETWEEN 1 AND 100),
  phone TEXT NOT NULL CHECK (phone ~ '^[+0-9 ()-]{7,25}$'),
  email TEXT NOT NULL DEFAULT '' CHECK (email = '' OR (length(email) <= 254 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  loan_amount NUMERIC(14, 2) NOT NULL CHECK (loan_amount > 0),
  monthly_income NUMERIC(14, 2) NOT NULL CHECK (monthly_income > 0),
  employment_type TEXT NOT NULL CHECK (employment_type IN ('salaried', 'self_employed', 'business_owner', 'other')),
  city TEXT NOT NULL CHECK (length(btrim(city)) BETWEEN 1 AND 100),
  preferred_bank TEXT NOT NULL DEFAULT '' CHECK (length(preferred_bank) <= 150),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'docs-collected', 'submitted', 'sanctioned', 'disbursed', 'rejected')),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT loan_leads_id_agency_unique UNIQUE (id, agency_id)
);

CREATE TABLE IF NOT EXISTS public.loan_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  agency_id TEXT NOT NULL,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('id', 'address', 'income', 'bank_statements', 'property_papers')),
  file_path TEXT NOT NULL UNIQUE CHECK (length(file_path) BETWEEN 1 AND 500),
  file_name TEXT NOT NULL CHECK (length(file_name) BETWEEN 1 AND 150),
  content_type TEXT NOT NULL CHECK (content_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  file_size INTEGER NOT NULL CHECK (file_size BETWEEN 1 AND 10485760),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT loan_documents_lead_agency_fk
    FOREIGN KEY (lead_id, agency_id)
    REFERENCES public.loan_leads(id, agency_id)
    ON DELETE CASCADE,
  CONSTRAINT loan_documents_verification_state CHECK (
    (verified = FALSE AND verified_by IS NULL AND verified_at IS NULL)
    OR (verified = TRUE AND verified_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS loan_leads_agency_status_created_idx
  ON public.loan_leads (agency_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS loan_leads_agency_assignee_status_idx
  ON public.loan_leads (agency_id, assigned_to, status);
CREATE INDEX IF NOT EXISTS loan_documents_lead_created_idx
  ON public.loan_documents (lead_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.realty_stamp_loan_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS loan_leads_updated_at ON public.loan_leads;
CREATE TRIGGER loan_leads_updated_at
BEFORE UPDATE ON public.loan_leads
FOR EACH ROW EXECUTE FUNCTION public.realty_stamp_loan_updated_at();

DROP TRIGGER IF EXISTS loan_documents_updated_at ON public.loan_documents;
CREATE TRIGGER loan_documents_updated_at
BEFORE UPDATE ON public.loan_documents
FOR EACH ROW EXECUTE FUNCTION public.realty_stamp_loan_updated_at();

ALTER TABLE public.loan_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS loan_leads_read_workspace ON public.loan_leads;
CREATE POLICY loan_leads_read_workspace ON public.loan_leads
FOR SELECT TO authenticated
USING (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
    AND public.realty_agency_feature_enabled(agency_id, 'home_loans')
  )
);

DROP POLICY IF EXISTS loan_leads_insert_workspace ON public.loan_leads;
CREATE POLICY loan_leads_insert_workspace ON public.loan_leads
FOR INSERT TO authenticated
WITH CHECK (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
    AND public.realty_agency_feature_enabled(agency_id, 'home_loans')
    AND (
      property_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.properties AS p
        WHERE p.id = property_id AND p.agency_id = loan_leads.agency_id
      )
    )
    AND (
      source_lead_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.leads AS l
        WHERE l.id = source_lead_id AND l.agency_id = loan_leads.agency_id
      )
    )
    AND (
      assigned_to IS NULL
      OR EXISTS (
        SELECT 1 FROM public.profiles AS p
        WHERE p.id = assigned_to
          AND p.agency_id = loan_leads.agency_id
          AND p.role IN ('agency_admin', 'agent')
          AND p.is_active
      )
    )
  )
);

DROP POLICY IF EXISTS loan_leads_update_workspace ON public.loan_leads;
CREATE POLICY loan_leads_update_workspace ON public.loan_leads
FOR UPDATE TO authenticated
USING (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
    AND public.realty_agency_feature_enabled(agency_id, 'home_loans')
  )
)
WITH CHECK (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
    AND public.realty_agency_feature_enabled(agency_id, 'home_loans')
    AND (
      property_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.properties AS p
        WHERE p.id = property_id AND p.agency_id = loan_leads.agency_id
      )
    )
    AND (
      source_lead_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.leads AS l
        WHERE l.id = source_lead_id AND l.agency_id = loan_leads.agency_id
      )
    )
    AND (
      assigned_to IS NULL
      OR EXISTS (
        SELECT 1 FROM public.profiles AS p
        WHERE p.id = assigned_to
          AND p.agency_id = loan_leads.agency_id
          AND p.role IN ('agency_admin', 'agent')
          AND p.is_active
      )
    )
  )
);

DROP POLICY IF EXISTS loan_documents_read_workspace ON public.loan_documents;
CREATE POLICY loan_documents_read_workspace ON public.loan_documents
FOR SELECT TO authenticated
USING (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
    AND public.realty_agency_feature_enabled(agency_id, 'home_loans')
  )
);

DROP POLICY IF EXISTS loan_documents_insert_workspace ON public.loan_documents;
CREATE POLICY loan_documents_insert_workspace ON public.loan_documents
FOR INSERT TO authenticated
WITH CHECK (
  public.realty_is_super_admin()
  OR (
    agency_id = (SELECT public.realty_current_agency_id())
    AND public.realty_current_role() IN ('agency_admin', 'agent')
    AND public.realty_agency_is_active(agency_id)
    AND public.realty_agency_feature_enabled(agency_id, 'home_loans')
    AND EXISTS (
      SELECT 1 FROM public.loan_leads AS l
      WHERE l.id = lead_id AND l.agency_id = loan_documents.agency_id
    )
    AND verified = FALSE
    AND verified_by IS NULL
    AND verified_at IS NULL
  )
);

DROP POLICY IF EXISTS loan_documents_verify_admin ON public.loan_documents;
CREATE POLICY loan_documents_verify_admin ON public.loan_documents
FOR UPDATE TO authenticated
USING (public.realty_is_super_admin())
WITH CHECK (
  public.realty_is_super_admin()
  AND (
    (verified = FALSE AND verified_by IS NULL AND verified_at IS NULL)
    OR (verified = TRUE AND verified_by = (SELECT auth.uid()) AND verified_at IS NOT NULL)
  )
);

REVOKE ALL ON TABLE public.loan_leads, public.loan_documents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.loan_leads, public.loan_documents TO authenticated;
GRANT INSERT (agency_id, source_lead_id, property_id, customer_name, phone, email, loan_amount, monthly_income, employment_type, city, preferred_bank, assigned_to, notes)
  ON TABLE public.loan_leads TO authenticated;
GRANT UPDATE (source_lead_id, property_id, customer_name, phone, email, loan_amount, monthly_income, employment_type, city, preferred_bank, status, assigned_to, notes)
  ON TABLE public.loan_leads TO authenticated;
GRANT INSERT (lead_id, agency_id, doc_type, file_path, file_name, content_type, file_size)
  ON TABLE public.loan_documents TO authenticated;
GRANT UPDATE (verified, verified_by, verified_at)
  ON TABLE public.loan_documents TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('loan-documents', 'loan-documents', FALSE)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, public = FALSE;

COMMIT;
