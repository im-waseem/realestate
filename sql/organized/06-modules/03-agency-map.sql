-- Address and pin are saved together on the existing agency row.
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE OR REPLACE FUNCTION public.realty_stamp_agency_update()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.updated_at=CURRENT_TIMESTAMP; RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS agency_update_timestamp ON public.agencies;
CREATE TRIGGER agency_update_timestamp BEFORE UPDATE ON public.agencies
FOR EACH ROW EXECUTE FUNCTION public.realty_stamp_agency_update();
