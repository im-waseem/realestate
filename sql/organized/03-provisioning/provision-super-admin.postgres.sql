-- Run as postgres in the Supabase SQL editor after creating the user in Supabase Auth.
-- Replace the email below with the Auth user's email. No password is stored in this file.
DO $provision$
DECLARE
  target_email TEXT := 'waseemakram060396@gmail.com';
  target_id UUID;
  target_name TEXT;
BEGIN
  SELECT id, email, COALESCE(
    NULLIF(raw_user_meta_data ->> 'full_name', ''),
    NULLIF(raw_user_meta_data ->> 'name', ''),
    split_part(email, '@', 1)
  )
  INTO target_id, target_email, target_name
  FROM auth.users
  WHERE lower(email) = lower(target_email);

  IF target_id IS NULL THEN
    RAISE EXCEPTION 'Create the Supabase Auth user for % before running this script', target_email;
  END IF;

  INSERT INTO public.profiles(id, name, email, role, agency_id)
  VALUES (target_id, target_name, target_email, 'super_admin', NULL)
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name, email = EXCLUDED.email, role = 'super_admin', agency_id = NULL;
END
$provision$;
