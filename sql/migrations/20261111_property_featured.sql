-- Add the private workspace flag used to mark featured listings.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE;

NOTIFY pgrst, 'reload schema';
