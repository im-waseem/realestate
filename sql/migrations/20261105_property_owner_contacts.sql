-- Existing projects: apply after 20261104_walk_in_enquiries.sql.
BEGIN;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS owner_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS owner_phone TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS owner_email TEXT NOT NULL DEFAULT '';

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'properties_owner_name_length'
      AND conrelid = 'public.properties'::pg_catalog.regclass
  ) THEN
    ALTER TABLE public.properties ADD CONSTRAINT properties_owner_name_length
      CHECK (length(owner_name) <= 100);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'properties_owner_phone_valid'
      AND conrelid = 'public.properties'::pg_catalog.regclass
  ) THEN
    ALTER TABLE public.properties ADD CONSTRAINT properties_owner_phone_valid
      CHECK (owner_phone = '' OR owner_phone ~ '^[+0-9 ()-]{7,25}$');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'properties_owner_email_valid'
      AND conrelid = 'public.properties'::pg_catalog.regclass
  ) THEN
    ALTER TABLE public.properties ADD CONSTRAINT properties_owner_email_valid
      CHECK (owner_email = '' OR (length(owner_email) <= 254 AND owner_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'));
  END IF;
END
$constraints$;

NOTIFY pgrst, 'reload schema';
COMMIT;
