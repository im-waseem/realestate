-- Existing projects: apply after 20261106_flexible_service_providers_and_lead_ids.sql.
BEGIN;

CREATE OR REPLACE FUNCTION public.realty_public_agency(target_agency_id TEXT)
RETURNS TABLE (id TEXT, name TEXT, phone TEXT, address TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT a.id,a.name,a.phone,a.address,a.lat,a.lng
 FROM public.agencies a
 WHERE a.id=target_agency_id AND a.status='active';
$$;
REVOKE ALL ON FUNCTION public.realty_public_agency(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.realty_public_agency(TEXT) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.realty_submit_agency_enquiry(
 target_agency_id TEXT, customer_name TEXT, customer_phone TEXT,
 customer_email TEXT, enquiry_intent TEXT, customer_message TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE agency public.agencies%ROWTYPE;
BEGIN
 IF length(btrim(customer_name)) NOT BETWEEN 2 AND 100
 OR customer_phone !~ '^[+0-9 ()-]{7,25}$'
 OR (customer_email <> '' AND (customer_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(customer_email)>254))
 OR enquiry_intent NOT IN ('buy','sell','rent','lease')
 OR length(btrim(customer_message)) NOT BETWEEN 10 AND 2000 THEN
   RAISE EXCEPTION 'Please check your contact details and requirements';
 END IF;

 SELECT a.* INTO agency FROM public.agencies a
 WHERE a.id=target_agency_id AND a.status='active' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This agency is unavailable'; END IF;

 IF NOT public.realty_take_rate_limit('agency-qr-global',120,60)
 OR NOT public.realty_take_rate_limit(
   'agency-qr:'||md5(target_agency_id||COALESCE(NULLIF(lower(btrim(customer_email)),''),regexp_replace(customer_phone,'[^0-9]','','g'))),5,3600
 )
 OR NOT public.realty_take_rate_limit(
   'agency-qr-phone:'||md5(target_agency_id||regexp_replace(customer_phone,'[^0-9]','','g')),3,3600
 ) THEN
   RAISE EXCEPTION 'Too many enquiries. Please try again later';
 END IF;

 INSERT INTO public.leads(id,agency_id,property_id,name,phone,email,client_address,source,intent,requirements,status)
 VALUES(gen_random_uuid()::text,agency.id,NULL,btrim(customer_name),btrim(customer_phone),lower(btrim(customer_email)),'','website',enquiry_intent,btrim(customer_message),'new');
END;
$$;
REVOKE ALL ON FUNCTION public.realty_submit_agency_enquiry(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.realty_submit_agency_enquiry(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
