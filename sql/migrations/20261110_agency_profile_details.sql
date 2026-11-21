-- Add agency identity and contact fields used by the dashboard profile editor.
-- Existing agency logins are used only to prefill contact details; passwords
-- remain managed by Supabase Auth.
BEGIN;

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS contact_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_email TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS whatsapp TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS website TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS registration_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS postal_code TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS service_areas TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS working_hours TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

UPDATE public.agencies AS a
SET contact_name = p.name,
    contact_email = p.email
FROM public.profiles AS p
WHERE p.agency_id = a.id
  AND p.role = 'agency_admin'
  AND (a.contact_name = '' OR a.contact_email = '');

DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.agencies'::regclass AND conname = 'agencies_contact_details_lengths') THEN
    ALTER TABLE public.agencies ADD CONSTRAINT agencies_contact_details_lengths CHECK (
      length(contact_name) <= 100 AND length(contact_email) <= 254
      AND length(whatsapp) <= 25 AND length(website) <= 300
      AND length(registration_number) <= 100 AND length(city) <= 100
      AND length(state) <= 100 AND length(postal_code) <= 20
      AND length(service_areas) <= 1000 AND length(working_hours) <= 300
      AND length(description) <= 2000
    ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.agencies'::regclass AND conname = 'agencies_contact_email_format') THEN
    ALTER TABLE public.agencies ADD CONSTRAINT agencies_contact_email_format CHECK (
      contact_email = '' OR (contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
    ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.agencies'::regclass AND conname = 'agencies_whatsapp_format') THEN
    ALTER TABLE public.agencies ADD CONSTRAINT agencies_whatsapp_format CHECK (
      whatsapp = '' OR whatsapp ~ '^[+0-9 ()-]{7,25}$'
    ) NOT VALID;
  END IF;
END;
$constraints$;

GRANT UPDATE (contact_name, contact_email, whatsapp, website, registration_number,
  city, state, postal_code, service_areas, working_hours, description)
  ON TABLE public.agencies TO authenticated;

-- Expose only a yes/no duplicate-owner check to the trusted server role.
-- Agency users never receive another agency's id, listing, or owner details.
CREATE OR REPLACE FUNCTION public.realty_owner_phone_registered_elsewhere(
  target_phone TEXT,
  target_agency_id TEXT,
  excluded_property_id TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.properties AS p
    WHERE p.agency_id <> target_agency_id
      AND (excluded_property_id IS NULL OR p.id <> excluded_property_id)
      AND regexp_replace(p.owner_phone, '[^0-9]', '', 'g') = regexp_replace(target_phone, '[^0-9]', '', 'g')
      AND regexp_replace(target_phone, '[^0-9]', '', 'g') <> ''
  );
$$;
REVOKE ALL ON FUNCTION public.realty_owner_phone_registered_elsewhere(TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.realty_owner_phone_registered_elsewhere(TEXT, TEXT, TEXT)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
