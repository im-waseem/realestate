BEGIN;

-- Reassert the table privileges required for the existing RLS-scoped loan
-- workspace. RLS continues to enforce agency ownership and admin access.
GRANT SELECT ON TABLE public.loan_leads, public.loan_lead_history TO authenticated;
GRANT SELECT ON public.loan_leads_admin_v, public.loan_summary_by_agency_v TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
