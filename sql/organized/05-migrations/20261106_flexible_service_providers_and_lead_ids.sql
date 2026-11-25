-- Existing projects: apply after 20261105_property_owner_contacts.sql.
BEGIN;

-- Let each agency record the trade or local service it actually needs.
ALTER TABLE public.service_providers
  DROP CONSTRAINT IF EXISTS service_providers_category_check;
ALTER TABLE public.service_providers
  ADD CONSTRAINT service_providers_category_length
  CHECK (length(btrim(category)) BETWEEN 2 AND 60);

-- Keep lead inserts working on projects where the original id default was absent.
ALTER TABLE public.leads
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

NOTIFY pgrst, 'reload schema';
COMMIT;
