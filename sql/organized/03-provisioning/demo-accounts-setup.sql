-- ============================================================================
-- DEMO ACCOUNTS SETUP FOR CLIENT TESTING
-- ============================================================================
-- IMPORTANT: Passwords are managed by Supabase Auth, NOT stored in SQL.
-- STEP 1: Create users in Supabase Dashboard → Authentication → Users
-- STEP 2: Run this SQL in Supabase SQL Editor to link profiles & agencies
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- STEP A: Create Demo Agencies
-- ---------------------------------------------------------------------------

-- Agency 1: Demo Agency One (for agency1@example.com)
INSERT INTO public.agencies(id, name, status, phone, address, contact_name, contact_email, city, state, description, features)
VALUES (
  'demo-agency-1',
  'Demo Agency One',
  'active',
  '+91 90000 10001',
  '12 Residency Road, Ashok Nagar, Bengaluru, Karnataka',
  'Demo Agency One Admin',
  'agency1@example.com',
  'Bengaluru',
  'Karnataka',
  'Demo real estate agency for client testing. Buy, sell, rent properties.',
  '{"home_loans":true,"tools":true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  status = 'active',
  contact_name = EXCLUDED.contact_name,
  contact_email = EXCLUDED.contact_email,
  features = EXCLUDED.features;

-- Agency 2: Demo Agency Two (for agency2@example.com)
INSERT INTO public.agencies(id, name, status, phone, address, contact_name, contact_email, city, state, description, features)
VALUES (
  'demo-agency-2',
  'Demo Agency Two',
  'active',
  '+91 90000 10002',
  '42 Linking Road, Bandra West, Mumbai, Maharashtra',
  'Demo Agency Two Admin',
  'agency2@example.com',
  'Mumbai',
  'Maharashtra',
  'Demo real estate agency for client testing.',
  '{"home_loans":false,"tools":true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  status = 'active',
  contact_name = EXCLUDED.contact_name,
  contact_email = EXCLUDED.contact_email,
  features = EXCLUDED.features;

-- ---------------------------------------------------------------------------
-- STEP B: Link Supabase Auth Users to Profiles
-- ---------------------------------------------------------------------------
-- Run this section AFTER creating users in Supabase Auth Dashboard.
-- Replace the email addresses with the ones you created in Supabase Auth.

DO $link_profiles$
DECLARE
  -- Agency 1 user
  uid1 UUID;
  name1 TEXT;
  
  -- Agency 2 user
  uid2 UUID;
  name2 TEXT;
  
  -- Agency 3 user (babywaseem786)
  uid3 UUID;
  name3 TEXT;
  
  -- Super admin user
  uid_sa UUID;
  name_sa TEXT;
BEGIN
  -- Look up users by email from auth.users
  SELECT id, COALESCE(NULLIF(raw_user_meta_data ->> 'full_name', ''),
                       NULLIF(raw_user_meta_data ->> 'name', ''),
                       split_part(email, '@', 1))
    INTO uid1, name1
    FROM auth.users
   WHERE lower(email) = lower('agency1@example.com');
   
  SELECT id, COALESCE(NULLIF(raw_user_meta_data ->> 'full_name', ''),
                       NULLIF(raw_user_meta_data ->> 'name', ''),
                       split_part(email, '@', 1))
    INTO uid2, name2
    FROM auth.users
   WHERE lower(email) = lower('agency2@example.com');
   
  SELECT id, COALESCE(NULLIF(raw_user_meta_data ->> 'full_name', ''),
                       NULLIF(raw_user_meta_data ->> 'name', ''),
                       split_part(email, '@', 1))
    INTO uid3, name3
    FROM auth.users
   WHERE lower(email) = lower('babywaseem786@gmail.com');
   
  SELECT id, COALESCE(NULLIF(raw_user_meta_data ->> 'full_name', ''),
                       NULLIF(raw_user_meta_data ->> 'name', ''),
                       split_part(email, '@', 1))
    INTO uid_sa, name_sa
    FROM auth.users
   WHERE lower(email) = lower('waseemakram060396@gmail.com');

  -- Insert/update profiles for each user
  IF uid1 IS NOT NULL THEN
    INSERT INTO public.profiles(id, name, email, role, agency_id, is_active)
    VALUES (uid1, name1, 'agency1@example.com', 'agency_admin', 'demo-agency-1', TRUE)
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          email = EXCLUDED.email,
          role = 'agency_admin',
          agency_id = 'demo-agency-1',
          is_active = TRUE;
  ELSE
    RAISE NOTICE 'User agency1@example.com not found in auth.users. Create it in Supabase Auth first.';
  END IF;

  IF uid2 IS NOT NULL THEN
    INSERT INTO public.profiles(id, name, email, role, agency_id, is_active)
    VALUES (uid2, name2, 'agency2@example.com', 'agency_admin', 'demo-agency-2', TRUE)
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          email = EXCLUDED.email,
          role = 'agency_admin',
          agency_id = 'demo-agency-2',
          is_active = TRUE;
  ELSE
    RAISE NOTICE 'User agency2@example.com not found in auth.users. Create it in Supabase Auth first.';
  END IF;

  IF uid3 IS NOT NULL THEN
    INSERT INTO public.profiles(id, name, email, role, agency_id, is_active)
    VALUES (uid3, name3, 'babywaseem786@gmail.com', 'agency_admin', 'demo-agency-bw786', TRUE)
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          email = EXCLUDED.email,
          role = 'agency_admin',
          agency_id = 'demo-agency-bw786',
          is_active = TRUE;
  ELSE
    RAISE NOTICE 'User babywaseem786@gmail.com not found in auth.users. Create it in Supabase Auth first.';
  END IF;

  IF uid_sa IS NOT NULL THEN
    INSERT INTO public.profiles(id, name, email, role, agency_id, is_active)
    VALUES (uid_sa, name_sa, 'waseemakram060396@gmail.com', 'super_admin', NULL, TRUE)
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          email = EXCLUDED.email,
          role = 'super_admin',
          agency_id = NULL,
          is_active = TRUE;
  ELSE
    RAISE NOTICE 'User waseemakram060396@gmail.com not found in auth.users. Create it in Supabase Auth first.';
  END IF;
END
$link_profiles$;

-- ---------------------------------------------------------------------------
-- STEP C: Seed Demo Properties for Baby Waseem Agency
-- ---------------------------------------------------------------------------
-- These properties start as 'pending' and need admin approval to show publicly

DO $seed_properties$
DECLARE
  target_agency_id TEXT := 'demo-agency-bw786';
BEGIN
  INSERT INTO public.properties
    (id, agency_id, title, intent, type, price, beds, baths, area,
     locality, city, address, lat, lng, description, amenities, images,
     status, floor_number, total_floors, car_parking, two_wheeler_parking,
     furnishing, age_years, publicly_visible)
  VALUES
    ('demo-bw786-whitefield-2bhk', target_agency_id, 'Bright 2 BHK near Whitefield', 'sale', 'Apartment', 9200000, 2, 2, 1180,
     'Whitefield', 'Bengaluru', 'Whitefield, Bengaluru', 12.9698, 77.7500,
     'A bright family apartment with balcony, power backup and clubhouse access. Close to IT parks and metro.',
     'Lift, power backup, security, clubhouse',
     '["/images/interior.jpg","/images/architecture.jpg"]',
     'pending', 5, 12, 1, 1, 'semi_furnished', 5, FALSE),
     
    ('demo-bw786-sarjapur-villa', target_agency_id, 'Family Villa in Sarjapur Road', 'sale', 'Villa', 18500000, 4, 4, 2450,
     'Sarjapur Road', 'Bengaluru', 'Sarjapur Road, Bengaluru', 12.9121, 77.6830,
     'Spacious independent villa in gated community with garden and covered parking.',
     'Garden, gated community, covered parking',
     '["/images/architecture.jpg"]',
     'pending', 0, 2, 2, 2, 'semi_furnished', 3, FALSE),
     
    ('demo-bw786-jp-nagar-rent', target_agency_id, 'Furnished 2 BHK in JP Nagar', 'rent', 'Apartment', 38000, 2, 2, 1120,
     'JP Nagar', 'Bengaluru', 'JP Nagar, Bengaluru', 12.9077, 77.5850,
     'Fully furnished 2 BHK apartment available for rent. Lift, balcony, water supply.',
     'Lift, balcony, water supply',
     '["/images/interior.jpg"]',
     'pending', 3, 8, 1, 1, 'furnished', 7, FALSE),
     
    ('demo-bw786-indiranagar-office', target_agency_id, 'Office Space in Indiranagar', 'lease', 'Office', 125000, 0, 2, 1650,
     'Indiranagar', 'Bengaluru', 'Indiranagar, Bengaluru', 12.9784, 77.6408,
     'Commercial office space with lift, reception and reserved parking.',
     'Lift, reception, reserved parking',
     '["/images/architecture.jpg"]',
     'pending', 2, 5, 2, 2, 'not_applicable', 4, FALSE),
     
    ('demo-bw786-kanakapura-plot', target_agency_id, 'Residential Plot near Kanakapura Road', 'sale', 'Plot', 6800000, 0, 0, 1200,
     'Kanakapura Road', 'Bengaluru', 'Kanakapura Road, Bengaluru', 12.8750, 77.5500,
     'Residential plot in gated layout with road access and utilities nearby.',
     'Gated layout, road access, utilities nearby',
     '["/images/architecture.jpg"]',
     'pending', 0, NULL, 0, 0, 'not_applicable', NULL, FALSE),
     
    ('demo-bw786-hsr-shop', target_agency_id, 'Retail Shop in HSR Layout', 'rent', 'Shop', 55000, 0, 1, 620,
     'HSR Layout', 'Bengaluru', 'HSR Layout, Bengaluru', 12.9116, 77.6389,
     'Street frontage retail shop with washroom and power backup.',
     'Street frontage, washroom, power backup',
     '["/images/interior.jpg"]',
     'pending', 0, 4, 1, 2, 'not_applicable', 2, FALSE)
  ON CONFLICT (id) DO NOTHING;
END
$seed_properties$;

-- ---------------------------------------------------------------------------
-- STEP D: Seed Demo Properties for Demo Agency One
-- ---------------------------------------------------------------------------

DO $seed_properties_2$
DECLARE
  target_agency_id TEXT := 'demo-agency-1';
BEGIN
  INSERT INTO public.properties
    (id, agency_id, title, intent, type, price, beds, baths, area,
     locality, city, address, lat, lng, description, amenities, images,
     status, floor_number, total_floors, car_parking, two_wheeler_parking,
     furnishing, age_years, publicly_visible)
  VALUES
    ('demo-property-sale-apartment', target_agency_id, 'Sunlit 3 BHK Garden Apartment', 'sale', 'Apartment', 18500000, 3, 2, 1480,
     'Indiranagar', 'Bengaluru', '12 Demo Garden Lane, Indiranagar', 12.9784, 77.6408,
     'A bright family apartment with private balcony and landscaped shared garden.',
     'Lift, balcony, security, power backup, gym',
     '["/images/interior.jpg","/images/architecture.jpg"]',
     'published', 0, 5, 1, 2, 'semi_furnished', 6, TRUE),
     
    ('demo-property-rent-villa', target_agency_id, 'Courtyard Villa with Home Office', 'rent', 'Villa', 95000, 4, 3, 2650,
     'Whitefield', 'Bengaluru', '8 Demo Orchard Road, Whitefield', 12.9698, 77.7500,
     'A furnished independent villa with shaded courtyard, flexible study and room for a family.',
     'Private garden, fitted kitchen, security, two-car driveway',
     '["/images/architecture.jpg","/images/interior.jpg"]',
     'published', 0, 2, 2, 3, 'furnished', 4, TRUE)
  ON CONFLICT (id) DO NOTHING;
END
$seed_properties_2$;

-- ---------------------------------------------------------------------------
-- STEP E: Seed Demo Properties for Demo Agency Two
-- ---------------------------------------------------------------------------

DO $seed_properties_3$
DECLARE
  target_agency_id TEXT := 'demo-agency-2';
BEGIN
  INSERT INTO public.properties
    (id, agency_id, title, intent, type, price, beds, baths, area,
     locality, city, address, lat, lng, description, amenities, images,
     status, floor_number, total_floors, car_parking, two_wheeler_parking,
     furnishing, age_years, publicly_visible)
  VALUES
    ('demo-property-lease-builder-floor', target_agency_id, 'Quiet 2 BHK Builder Floor', 'lease', 'Builder floor', 42000, 2, 2, 1180,
     'Bandra West', 'Mumbai', '24 Demo Palm Avenue, Bandra West', 19.0606, 72.8362,
     'Well-maintained upper-floor home on long-term lease. Natural light and balcony.',
     'Balcony, lift, water supply, gated entry',
     '["/images/interior.jpg"]',
     'pending', 2, 4, 1, 1, 'unfurnished', 11, FALSE),
     
    ('demo-property-sale-plot', target_agency_id, 'Residential Corner Plot', 'sale', 'Plot', 24000000, 0, 0, 2400,
     'Sarjapur Road', 'Bengaluru', 'Demo Layout, Sarjapur Road', 12.9107, 77.6871,
     'Residential plot in established layout, suitable for custom family home.',
     'Corner plot, paved road, utilities nearby',
     '["/images/architecture.jpg"]',
     'published', 0, NULL, 0, 0, 'not_applicable', NULL, TRUE)
  ON CONFLICT (id) DO NOTHING;
END
$seed_properties_3$;

-- ---------------------------------------------------------------------------
-- STEP F: Seed Demo Service Providers (visible across all agencies)
-- ---------------------------------------------------------------------------

INSERT INTO public.service_providers(id, agency_id, name, category, phone, email, service_area, address, notes, is_active)
VALUES
  ('sp-painter-001', 'demo-agency-1', 'Ravi Kumar', 'Painter', '+91 90000 11111', 'ravi@paintservices.com', 'Bengaluru', 'Indiranagar, Bengaluru', 'Interior and exterior painting, waterproofing, texture work', TRUE),
  ('sp-plumber-001', 'demo-agency-1', 'Suresh Plumbing Works', 'Plumber', '+91 90000 22222', 'suresh@plumbing.com', 'Bengaluru', 'Whitefield, Bengaluru', 'Pipe repair, bathroom fitting, water tank cleaning', TRUE),
  ('sp-electrician-001', 'demo-agency-1', 'Electric Care Services', 'Electrician', '+91 90000 33333', 'care@electrical.com', 'Bengaluru', 'Koramangala, Bengaluru', 'Wiring, MCB repair, lighting installation, fan repair', TRUE),
  ('sp-carpenter-001', 'demo-agency-2', 'Wood Craft Carpentry', 'Carpenter', '+91 90000 44444', 'wood@craft.com', 'Mumbai', 'Bandra West, Mumbai', 'Furniture repair, modular kitchen, door installation', TRUE),
  ('sp-cleaner-001', 'demo-agency-2', 'Clean Home Services', 'Cleaning', '+91 90000 55555', 'clean@home.com', 'Mumbai', 'Andheri, Mumbai', 'Deep cleaning, move-in/move-out, post-construction cleaning', TRUE),
  ('sp-painter-002', 'demo-agency-bw786', 'Blue Star Painters', 'Painter', '+91 90000 66666', 'bluestar@paint.com', 'Bengaluru', 'JP Nagar, Bengaluru', 'Residential painting, texture finish, waterproofing', TRUE),
  ('sp-ac-001', 'demo-agency-bw786', 'Cool Air AC Services', 'AC Service', '+91 90000 77777', 'cool@acservice.com', 'Bengaluru', 'HSR Layout, Bengaluru', 'AC installation, gas refilling, annual maintenance', TRUE),
  ('sp-pest-001', 'demo-agency-bw786', 'Pest Free Solutions', 'Pest Control', '+91 90000 88888', 'pestfree@solutions.com', 'Bengaluru', 'Whitefield, Bengaluru', 'Termite control, cockroach treatment, rodent control', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- STEP G: Seed Demo Leads and Activity
-- ---------------------------------------------------------------------------

INSERT INTO public.leads(id, agency_id, property_id, name, phone, email, intent, requirements, status, notes, source)
VALUES
  ('demo-lead-apartment', 'demo-agency-1', 'demo-property-sale-apartment', 'Demo Buyer', '+91 00000 00001', 'buyer@example.test', 'buy', 'Looking for a 3 BHK near Indiranagar metro; budget around ₹2 crore.', 'visit scheduled', 'Demo record only.', 'website'),
  ('demo-lead-villa', 'demo-agency-1', 'demo-property-rent-villa', 'Demo Renter', '+91 00000 00002', 'renter@example.test', 'rent', 'Family needs a furnished villa near Whitefield from next month.', 'contacted', 'Demo record only.', 'website'),
  ('demo-lead-lease', 'demo-agency-2', 'demo-property-lease-builder-floor', 'Demo Tenant', '+91 00000 00003', 'tenant@example.test', 'lease', 'Interested in a long-term lease; would like to arrange a viewing.', 'new', 'Demo record only.', 'walk_in')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.activity(id, agency_id, actor, action)
VALUES
  ('demo-activity-1', 'demo-agency-1', 'Demo Agency One', 'Published demo apartment listing'),
  ('demo-activity-2', 'demo-agency-1', 'Demo Agency One', 'Received enquiry from Demo Buyer'),
  ('demo-activity-3', 'demo-agency-1', 'Demo Agency One', 'Contacted Demo Renter'),
  ('demo-activity-4', 'demo-agency-2', 'Demo Agency Two', 'Submitted builder floor for review'),
  ('demo-activity-5', 'demo-agency-bw786', 'Baby Waseem', 'Added new property listings for demo')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- NOTIFY Supabase to reload schema
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================================
-- DEMO CREDENTIALS SUMMARY (Share with your client)
-- ============================================================================
-- Create these users in Supabase Dashboard → Authentication → Users FIRST,
-- then run this SQL to link their profiles.
--
-- | Email                      | Role           | Agency                  | Password (YOU SET in Supabase Auth) |
-- |----------------------------|----------------|-------------------------|--------------------------------------|
-- | agency1@example.com        | agency_admin   | Demo Agency One         | (set in Supabase Auth)              |
-- | agency2@example.com        | agency_admin   | Demo Agency Two         | (set in Supabase Auth)              |
-- | babywaseem786@gmail.com    | agency_admin   | Baby Waseem Agency      | (set in Supabase Auth)              |
-- | waseemakram060396@gmail.com| super_admin    | None (Super Admin)      | (set in Supabase Auth)              |
--
-- How to create users in Supabase Auth:
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Click "Add User"
-- 3. Enter email and set a password
-- 4. Enable "Auto Confirm Email"
-- 5. Click "Create User"
-- 6. Run this SQL file to link profiles to agencies
-- ============================================================================