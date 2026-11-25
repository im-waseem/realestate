-- Apply in Supabase SQL Editor as postgres after 20261128_agency_enable_disable.sql.
-- Caps each agency at 30 property records, customer enquiries, and service providers.
-- Existing records remain unchanged; once an agency reaches a cap, further
-- inserts or transfers into that agency are rejected until a record is deleted.
BEGIN;

CREATE OR REPLACE FUNCTION public.realty_enforce_agency_record_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  agency_record_count BIGINT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.agency_id = NEW.agency_id THEN
    RETURN NEW;
  END IF;

  -- Serialize all inserts/transfers for this agency before checking its count.
  PERFORM 1
  FROM public.agencies
  WHERE id = NEW.agency_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agency not found.' USING ERRCODE = '23503';
  END IF;

  IF TG_TABLE_NAME = 'properties' THEN
    SELECT count(*) INTO agency_record_count
    FROM public.properties
    WHERE agency_id = NEW.agency_id;

    IF agency_record_count >= 30 THEN
      RAISE EXCEPTION 'Agency property limit reached: an agency can save up to 30 properties.'
        USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'leads' THEN
    SELECT count(*) INTO agency_record_count
    FROM public.leads
    WHERE agency_id = NEW.agency_id;

    IF agency_record_count >= 30 THEN
      RAISE EXCEPTION 'Agency enquiry limit reached: an agency can save up to 30 customer enquiries.'
        USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'service_providers' THEN
    SELECT count(*) INTO agency_record_count
    FROM public.service_providers
    WHERE agency_id = NEW.agency_id;

    IF agency_record_count >= 30 THEN
      RAISE EXCEPTION 'Agency service-provider limit reached: an agency can save up to 30 service providers.'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    RAISE EXCEPTION 'Agency record limit trigger attached to an unsupported table.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.realty_enforce_agency_record_limits() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS properties_agency_record_limit ON public.properties;
CREATE TRIGGER properties_agency_record_limit
BEFORE INSERT OR UPDATE ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.realty_enforce_agency_record_limits();

DROP TRIGGER IF EXISTS leads_agency_record_limit ON public.leads;
CREATE TRIGGER leads_agency_record_limit
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.realty_enforce_agency_record_limits();

DROP TRIGGER IF EXISTS service_providers_agency_record_limit ON public.service_providers;
CREATE TRIGGER service_providers_agency_record_limit
BEFORE INSERT OR UPDATE ON public.service_providers
FOR EACH ROW
EXECUTE FUNCTION public.realty_enforce_agency_record_limits();

COMMIT;
