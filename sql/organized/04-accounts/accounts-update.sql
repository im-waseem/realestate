-- PostgreSQL / Supabase SQL Editor. Run the ENTIRE file as the postgres role.
-- For a new project or existing tables matching this application's schema.
-- Keeps custom scrypt password hashes; does NOT provision Supabase Auth users.
-- The Next.js app still uses local SQLite until its database adapter is migrated.
BEGIN;
    CREATE TABLE IF NOT EXISTS public.agencies(id TEXT PRIMARY KEY,name TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS public.users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL,agency_id TEXT REFERENCES public.agencies(id));
    CREATE TABLE IF NOT EXISTS public.sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES public.users(id),expires BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS public.properties(id TEXT PRIMARY KEY,agency_id TEXT NOT NULL REFERENCES public.agencies(id),title TEXT NOT NULL,intent TEXT NOT NULL,type TEXT NOT NULL,price DOUBLE PRECISION NOT NULL,beds INTEGER NOT NULL,baths INTEGER NOT NULL,area DOUBLE PRECISION NOT NULL,locality TEXT NOT NULL,city TEXT NOT NULL,address TEXT NOT NULL,lat DOUBLE PRECISION NOT NULL,lng DOUBLE PRECISION NOT NULL,description TEXT NOT NULL,amenities TEXT NOT NULL,images TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS public.leads(id TEXT PRIMARY KEY,agency_id TEXT NOT NULL REFERENCES public.agencies(id),property_id TEXT REFERENCES public.properties(id),name TEXT NOT NULL,phone TEXT NOT NULL,email TEXT NOT NULL,intent TEXT NOT NULL,requirements TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'new',notes TEXT NOT NULL DEFAULT '',created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS public.activity(id TEXT PRIMARY KEY,agency_id TEXT REFERENCES public.agencies(id),actor TEXT NOT NULL,action TEXT NOT NULL,created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS public.throttles(key TEXT PRIMARY KEY,attempts INTEGER NOT NULL,expires BIGINT NOT NULL);

-- Validate role membership on new and existing tables.
CREATE OR REPLACE FUNCTION public.realty_validate_user_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NEW.role IS NULL OR NEW.role NOT IN ('super_admin','agency_admin','agent')
     OR (NEW.role = 'super_admin' AND NEW.agency_id IS NOT NULL)
     OR (NEW.role IN ('agency_admin','agent') AND NEW.agency_id IS NULL) THEN
    RAISE EXCEPTION 'Invalid role or agency membership' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS realty_users_role_check ON public.users;
CREATE TRIGGER realty_users_role_check
BEFORE INSERT OR UPDATE OF role,agency_id ON public.users
FOR EACH ROW EXECUTE FUNCTION public.realty_validate_user_role();

-- This schema retains the application's custom server-side scrypt login.
-- It does not create auth.users or Supabase Auth sessions.
-- Block direct client API access until the server/database migration is complete.
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agencies FROM anon, authenticated;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.users FROM anon, authenticated;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.sessions FROM anon, authenticated;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.properties FROM anon, authenticated;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.leads FROM anon, authenticated;
ALTER TABLE public.activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.activity FROM anon, authenticated;
ALTER TABLE public.throttles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.throttles FROM anon, authenticated;

-- Provision the requested main admin and two active demo agency admins.

DELETE FROM public.sessions WHERE user_id IN (SELECT id FROM public.users WHERE email='waseemakram060396@gmail.com');
INSERT INTO public.users(id,name,email,password,role,agency_id) VALUES('2b20abdb-292a-4447-9dc7-5fc3b58a2b8e','Waseem Akram','waseemakram060396@gmail.com','b33a3645904ca2c6b295e381b1cddf90:65a74c902c614a77b5d1566b767352ea8030ab55ec0c8aa20322b60ede95ca8980785033d184a4675770d3102b3912937cc516e6f5b8b4171156bb87d831f7e0','super_admin',NULL) ON CONFLICT(email) DO UPDATE SET name=excluded.name,password=excluded.password,role=excluded.role,agency_id=excluded.agency_id;
INSERT INTO public.agencies(id,name,status) VALUES('demo-agency-1','Demo Agency One','active') ON CONFLICT(id) DO UPDATE SET name=excluded.name,status='active';
DELETE FROM public.sessions WHERE user_id IN (SELECT id FROM public.users WHERE email='agency1@example.com');
INSERT INTO public.users(id,name,email,password,role,agency_id) VALUES('d8130d36-250f-488f-8145-d7956a160f3f','Demo Agency One','agency1@example.com','7798cb5573364a42fcd5d6f803021a0d:f1480e7f4898d01dfb8c752e3905e3ea5b50bbd2f52a0375aa181a695910141b82f491776371d312dd0e397297d9beb1af8dcfd6cd6901e513cfe2faddcfeb60','agency_admin','demo-agency-1') ON CONFLICT(email) DO UPDATE SET name=excluded.name,password=excluded.password,role=excluded.role,agency_id=excluded.agency_id;
INSERT INTO public.agencies(id,name,status) VALUES('demo-agency-2','Demo Agency Two','active') ON CONFLICT(id) DO UPDATE SET name=excluded.name,status='active';
DELETE FROM public.sessions WHERE user_id IN (SELECT id FROM public.users WHERE email='agency2@example.com');
INSERT INTO public.users(id,name,email,password,role,agency_id) VALUES('1e0ba6b8-c78d-4553-89c4-1cb40f00b802','Demo Agency Two','agency2@example.com','42978f10eb144610e4aec81e0044a429:5287b92c1dca09e8061c36c47aacd00c3254abf86444080027418b1cc5c7d894e910f3ac21d6f81ab46ec46a3864ca06f6c36e07ef7af314e43bba6e5a90eca5','agency_admin','demo-agency-2') ON CONFLICT(email) DO UPDATE SET name=excluded.name,password=excluded.password,role=excluded.role,agency_id=excluded.agency_id;
COMMIT;
