-- Optional demo listings for the agency_admin account babywaseem786@gmail.com.
-- Run only in the intended Supabase project as postgres. All records start as
-- pending and remain private until reviewed and explicitly published.
BEGIN;
DO $seed$
DECLARE
  target_agency_id TEXT;
BEGIN
  SELECT agency_id INTO target_agency_id
  FROM public.profiles
  WHERE lower(email) = lower('babywaseem786@gmail.com')
    AND role = 'agency_admin'
  LIMIT 1;

  IF target_agency_id IS NULL THEN
    RAISE EXCEPTION 'No agency_admin profile found for babywaseem786@gmail.com. Create/invite that Auth user and assign its agency first.';
  END IF;

  INSERT INTO public.properties
    (id, agency_id, title, intent, type, price, beds, baths, area,
     locality, city, address, lat, lng, description, amenities, images,
     status, floor_number, total_floors, car_parking, two_wheeler_parking,
     furnishing, age_years)
  VALUES
    ('demo-bw786-whitefield-2bhk', target_agency_id, 'DEMO — Bright 2 BHK near Whitefield', 'sale', 'Apartment', 9200000, 2, 2, 1180,
     'Whitefield', 'Bengaluru', 'Whitefield, Bengaluru', 12.9698, 77.7500, 'DEMO SAMPLE: Replace this description, price and photos with verified listing details before publishing.', 'Lift, power backup, security, clubhouse', '["/images/interior.jpg"]', 'pending', 5, 12, 1, 1, 'semi_furnished', 5),
    ('demo-bw786-sarjapur-villa', target_agency_id, 'DEMO — Family villa in Sarjapur Road', 'sale', 'Villa', 18500000, 4, 4, 2450,
     'Sarjapur Road', 'Bengaluru', 'Sarjapur Road, Bengaluru', 12.9121, 77.6830, 'DEMO SAMPLE: Replace this description, price and photos with verified listing details before publishing.', 'Garden, gated community, covered parking', '["/images/architecture.jpg"]', 'pending', 0, 2, 2, 2, 'semi_furnished', 3),
    ('demo-bw786-jp-nagar-rent', target_agency_id, 'DEMO — Furnished 2 BHK in JP Nagar', 'rent', 'Apartment', 38000, 2, 2, 1120,
     'JP Nagar', 'Bengaluru', 'JP Nagar, Bengaluru', 12.9077, 77.5850, 'DEMO SAMPLE: Replace this description, rent and photos with verified listing details before publishing.', 'Lift, balcony, water supply', '["/images/interior.jpg"]', 'pending', 3, 8, 1, 1, 'furnished', 7),
    ('demo-bw786-indiranagar-office', target_agency_id, 'DEMO — Office space in Indiranagar', 'lease', 'Office', 125000, 0, 2, 1650,
     'Indiranagar', 'Bengaluru', 'Indiranagar, Bengaluru', 12.9784, 77.6408, 'DEMO SAMPLE: Replace this description, lease terms and photos with verified listing details before publishing.', 'Lift, reception, reserved parking', '["/images/architecture.jpg"]', 'pending', 2, 5, 2, 2, 'not_applicable', 4),
    ('demo-bw786-kanakapura-plot', target_agency_id, 'DEMO — Residential plot near Kanakapura Road', 'sale', 'Plot', 6800000, 0, 0, 1200,
     'Kanakapura Road', 'Bengaluru', 'Kanakapura Road, Bengaluru', 12.8750, 77.5500, 'DEMO SAMPLE: Replace this description, price and photos with verified listing details before publishing.', 'Gated layout, road access, utilities nearby', '["/images/architecture.jpg"]', 'pending', 0, NULL, 0, 0, 'not_applicable', NULL),
    ('demo-bw786-hsr-shop', target_agency_id, 'DEMO — Retail shop in HSR Layout', 'rent', 'Shop', 55000, 0, 1, 620,
     'HSR Layout', 'Bengaluru', 'HSR Layout, Bengaluru', 12.9116, 77.6389, 'DEMO SAMPLE: Replace this description, rent and photos with verified listing details before publishing.', 'Street frontage, washroom, power backup', '["/images/interior.jpg"]', 'pending', 0, 4, 1, 2, 'not_applicable', 2)
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Demo properties are attached to agency % and marked pending.', target_agency_id;
END;
$seed$;
COMMIT;
