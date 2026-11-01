-- Existing projects: apply after 20261101_dashboard_summary.sql.
BEGIN;

-- Curated public projection only. Workspace tables retain their existing RLS.
CREATE OR REPLACE FUNCTION public.realty_public_properties(
  search_text TEXT DEFAULT '', listing_intent TEXT DEFAULT '', property_type TEXT DEFAULT '',
  minimum_price DOUBLE PRECISION DEFAULT 0, maximum_price DOUBLE PRECISION DEFAULT 1000000000000,
  minimum_beds INTEGER DEFAULT 0, page_number INTEGER DEFAULT 1, target_id TEXT DEFAULT ''
) RETURNS TABLE (
  id TEXT, title TEXT, intent TEXT, type TEXT, price DOUBLE PRECISION, beds INTEGER,
  baths INTEGER, area DOUBLE PRECISION, locality TEXT, city TEXT, description TEXT,
  amenities TEXT, images TEXT, floor_number INTEGER, total_floors INTEGER,
  car_parking INTEGER, two_wheeler_parking INTEGER, furnishing TEXT, age_years INTEGER,
  map_lat DOUBLE PRECISION, map_lng DOUBLE PRECISION, agency_name TEXT, total_count BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT p.id,p.title,p.intent,p.type,p.price,p.beds,p.baths,p.area,p.locality,p.city,
 p.description,p.amenities,p.images,p.floor_number,p.total_floors,p.car_parking,
 p.two_wheeler_parking,p.furnishing,p.age_years,
 round(p.lat::numeric,2)::double precision,round(p.lng::numeric,2)::double precision,
 a.name,count(*) OVER()
 FROM public.properties p JOIN public.agencies a ON a.id=p.agency_id
 WHERE p.status='published' AND a.status='active'
 AND (target_id='' OR p.id=target_id)
 AND (listing_intent='' OR p.intent=listing_intent)
 AND (property_type='' OR p.type=property_type)
 AND p.price BETWEEN greatest(minimum_price,0) AND maximum_price
 AND p.beds>=greatest(minimum_beds,0)
 AND (search_text='' OR strpos(lower(p.title||' '||p.city||' '||p.locality),lower(left(search_text,100)))>0)
 ORDER BY p.created_at DESC,p.id
 LIMIT 12 OFFSET (least(greatest(page_number,1),10000)-1)*12;
$$;
REVOKE ALL ON FUNCTION public.realty_public_properties(TEXT,TEXT,TEXT,DOUBLE PRECISION,DOUBLE PRECISION,INTEGER,INTEGER,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.realty_public_properties(TEXT,TEXT,TEXT,DOUBLE PRECISION,DOUBLE PRECISION,INTEGER,INTEGER,TEXT) TO anon,authenticated;

-- Only images attached to a published listing from their owning active agency.
CREATE OR REPLACE FUNCTION public.realty_public_photo_allowed(photo_name TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (
 SELECT 1 FROM public.uploads u JOIN public.properties p ON p.agency_id=u.agency_id
 JOIN public.agencies a ON a.id=p.agency_id
 WHERE u.name=photo_name AND p.status='published' AND a.status='active'
 AND p.images::jsonb ? ('/media/'||photo_name)
 );
$$;
REVOKE ALL ON FUNCTION public.realty_public_photo_allowed(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.realty_public_photo_allowed(TEXT) TO anon,authenticated;


-- Called only by the application server. Never expose the service key to browsers.
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
 INSERT INTO public.leads(agency_id,property_id,name,phone,email,intent,requirements,status)
 VALUES(listing.agency_id,listing.id,btrim(customer_name),btrim(customer_phone),lower(btrim(customer_email)),
 CASE WHEN listing.intent='sale' THEN 'buy' ELSE listing.intent END,btrim(customer_message),'new');
END;
$$;
REVOKE ALL ON FUNCTION public.realty_submit_public_enquiry(TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.realty_submit_public_enquiry(TEXT,TEXT,TEXT,TEXT,TEXT) TO service_role;


-- Address and pin are saved together on the existing agency row.
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE OR REPLACE FUNCTION public.realty_stamp_agency_update()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.updated_at=CURRENT_TIMESTAMP; RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS agency_update_timestamp ON public.agencies;
CREATE TRIGGER agency_update_timestamp BEFORE UPDATE ON public.agencies
FOR EACH ROW EXECUTE FUNCTION public.realty_stamp_agency_update();

NOTIFY pgrst, 'reload schema';
COMMIT;
