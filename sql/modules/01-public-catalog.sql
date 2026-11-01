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
