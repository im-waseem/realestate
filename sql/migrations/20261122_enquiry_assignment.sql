ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_status_check
  CHECK (status IN ('new', 'contacted', 'visit', 'visit scheduled', 'negotiating', 'closed', 'lost'));

CREATE INDEX IF NOT EXISTS leads_assigned_to_idx ON public.leads (assigned_to) WHERE assigned_to IS NOT NULL;
