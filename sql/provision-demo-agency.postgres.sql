-- One-time test agency setup.
-- First create demoagency1@gmail.com in Supabase Authentication > Users and
-- set its password there. Never put a password in this SQL file.
-- Run as postgres in the Supabase SQL editor.
BEGIN;

DO $provision$
DECLARE
  target_email CONSTANT TEXT := 'demoagency1@gmail.com';
  target_agency_id CONSTANT TEXT := 'demo-agency-1';
  target_agency_name CONSTANT TEXT := 'Demo Agency One';
  target_user_id UUID;
  email_owner UUID;
  existing_profile_role TEXT;
  existing_profile_agency TEXT;
  existing_agency_name TEXT;
  profile_exists BOOLEAN;
  account_name TEXT;
BEGIN
  SELECT name INTO existing_agency_name
    FROM public.agencies
   WHERE id = target_agency_id;
  IF existing_agency_name IS NOT NULL AND existing_agency_name <> target_agency_name THEN
    RAISE EXCEPTION 'Agency ID % already belongs to another agency', target_agency_id;
  END IF;

  INSERT INTO public.agencies(id, name, status, phone, address)
  VALUES (target_agency_id, target_agency_name, 'approved', '+91 90000 10001', 'Demo testing office')
  ON CONFLICT (id) DO UPDATE SET status = 'approved';

  SELECT id,
         COALESCE(NULLIF(raw_user_meta_data ->> 'full_name', ''),
                  NULLIF(raw_user_meta_data ->> 'name', ''),
                  split_part(email, '@', 1))
    INTO target_user_id, account_name
    FROM auth.users
   WHERE lower(email) = lower(target_email);

  IF target_user_id IS NULL THEN
    RAISE NOTICE 'Agency is ready. Create or invite % in Supabase Auth, then rerun this script to grant login access.', target_email;
    RETURN;
  END IF;

  SELECT id INTO email_owner
    FROM public.profiles
   WHERE lower(email) = lower(target_email);
  IF email_owner IS NOT NULL AND email_owner <> target_user_id THEN
    RAISE EXCEPTION 'That email is already linked to a different workspace account';
  END IF;

  SELECT role, agency_id
    INTO existing_profile_role, existing_profile_agency
    FROM public.profiles
   WHERE id = target_user_id;
  profile_exists := FOUND;

  IF profile_exists AND (
    existing_profile_role <> 'agency_admin'
    OR existing_profile_agency <> target_agency_id
  ) THEN
    RAISE EXCEPTION 'This account already has a different role or agency; no access was changed';
  END IF;

  INSERT INTO public.profiles(id, name, email, role, agency_id)
  VALUES (target_user_id, account_name, target_email, 'agency_admin', target_agency_id)
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        agency_id = EXCLUDED.agency_id;
END
$provision$;

COMMIT;
