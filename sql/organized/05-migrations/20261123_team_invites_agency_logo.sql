ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS logo_url TEXT NOT NULL DEFAULT '';

ALTER TABLE public.agencies
  DROP CONSTRAINT IF EXISTS agencies_logo_url_length;
ALTER TABLE public.agencies
  ADD CONSTRAINT agencies_logo_url_length CHECK (length(logo_url) <= 1000) NOT VALID;

CREATE OR REPLACE FUNCTION public.realty_public_photo_allowed(photo_name TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (
   SELECT 1 FROM public.uploads u JOIN public.properties p ON p.agency_id=u.agency_id
   JOIN public.agencies a ON a.id=p.agency_id
   WHERE u.name=photo_name AND p.status='published' AND a.status='active'
   AND p.images::jsonb ? ('/media/'||photo_name)
 ) OR EXISTS (
   SELECT 1 FROM public.uploads u JOIN public.agencies a ON a.id=u.agency_id
   WHERE u.name=photo_name AND a.status='active' AND a.logo_url='/media/'||photo_name
 );
$$;

DROP FUNCTION IF EXISTS public.realty_public_agency(TEXT);
CREATE FUNCTION public.realty_public_agency(target_agency_id TEXT)
RETURNS TABLE (id TEXT, name TEXT, phone TEXT, whatsapp TEXT, logo_url TEXT, address TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT a.id,a.name,a.phone,a.whatsapp,a.logo_url,a.address,a.lat,a.lng
 FROM public.agencies a WHERE a.id=target_agency_id AND a.status='active';
$$;
REVOKE ALL ON FUNCTION public.realty_public_agency(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.realty_public_agency(TEXT) TO anon,authenticated;

COMMENT ON FUNCTION public.realty_public_agency(TEXT) IS
  'Returns limited active agency contact details, including its public logo, for QR visitors.';
