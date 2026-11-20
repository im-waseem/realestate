-- Existing projects: apply after 20261103_service_provider_directory.sql.
BEGIN;

ALTER TABLE public.leads ALTER COLUMN email SET DEFAULT '';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS client_address TEXT NOT NULL DEFAULT '';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'other';

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'leads_source_allowed'
      AND conrelid = 'public.leads'::pg_catalog.regclass
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_source_allowed
      CHECK (source IN ('walk_in', 'phone', 'website', 'referral', 'other'));
  END IF;
END
$constraint$;

CREATE OR REPLACE FUNCTION public.realty_submit_public_enquiry(
 target_id TEXT, customer_name TEXT, customer_phone TEXT, customer_email TEXT, customer_message TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE listing public.properties%ROWTYPE;
BEGIN
 IF length(btrim(customer_name)) NOT BETWEEN 2 AND 100
 OR customer_phone !~ '^[+0-9 ()-]{7,25}$'
 OR customer_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 OR length(customer_email)>254 OR length(btrim(customer_message)) NOT BETWEEN 10 AND 2000 THEN
 RAISE EXCEPTION 'Please check your contact details and message'; END IF;
 SELECT p.* INTO listing FROM public.properties p JOIN public.agencies a ON a.id=p.agency_id
 WHERE p.id=target_id AND p.status='published' AND a.status='active' FOR SHARE OF p,a;
 IF NOT FOUND THEN RAISE EXCEPTION 'This listing is no longer available'; END IF;
 IF NOT public.realty_take_rate_limit('public-enquiry-global',60,60)
 OR NOT public.realty_take_rate_limit('public-enquiry:'||md5(lower(btrim(customer_email))),3,3600)
 OR NOT public.realty_take_rate_limit('public-enquiry-phone:'||md5(regexp_replace(customer_phone,'[^0-9]','','g')),3,3600)
 THEN RAISE EXCEPTION 'Too many enquiries. Please try again later'; END IF;
 INSERT INTO public.leads(agency_id,property_id,name,phone,email,client_address,source,intent,requirements,status)
 VALUES(listing.agency_id,listing.id,btrim(customer_name),btrim(customer_phone),lower(btrim(customer_email)),'','website',
 CASE WHEN listing.intent='sale' THEN 'buy' ELSE listing.intent END,btrim(customer_message),'new');
END;
$$;
REVOKE ALL ON FUNCTION public.realty_submit_public_enquiry(TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.realty_submit_public_enquiry(TEXT,TEXT,TEXT,TEXT,TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
