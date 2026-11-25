-- Existing projects: apply after 20261127_property_public_visibility.sql.
-- Adds is_active column to agencies for simple enable/disable toggle.
-- Works alongside the existing status field (pending/active/suspended).
BEGIN;

-- Add is_active column to agencies table
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Create index for faster lookups by active status
CREATE INDEX IF NOT EXISTS agencies_is_active_idx ON public.agencies (is_active);

-- Update existing agencies: active status = is_active true, others = false
UPDATE public.agencies
SET is_active = (status = 'active')
WHERE is_active IS DISTINCT FROM (status = 'active');

NOTIFY pgrst, 'reload schema';
COMMIT;

-- ============================================================================
-- USAGE
-- ============================================================================
-- Enable an agency:
--   UPDATE public.agencies SET is_active = TRUE, status = 'active' WHERE id = 'agency-id';
--
-- Disable an agency:
--   UPDATE public.agencies SET is_active = FALSE, status = 'suspended' WHERE id = 'agency-id';
--
-- Query only active agencies:
--   SELECT * FROM public.agencies WHERE is_active = TRUE;
-- ============================================================================