-- SQLite demo fixtures. Seeded automatically by `npm run setup:demo`; safe to rerun manually.
-- These are fictional workspaces and customer enquiries. Safe to rerun.
PRAGMA foreign_keys=ON;
BEGIN IMMEDIATE;

INSERT INTO agencies(id,name,status,phone,address,lat,lng)
VALUES
  ('demo-agency-1','Demo Agency One','active','+91 90000 10001','12 Residency Road, Ashok Nagar, Bengaluru, Karnataka',12.9668,77.6017),
  ('demo-agency-2','Demo Agency Two','active','+91 90000 10002','42 Linking Road, Bandra West, Mumbai, Maharashtra',19.0606,72.8362)
ON CONFLICT(id) DO UPDATE SET
  name=excluded.name,phone=excluded.phone,address=excluded.address,lat=excluded.lat,lng=excluded.lng;

INSERT INTO properties(
  id,agency_id,title,intent,type,price,beds,baths,area,locality,city,address,lat,lng,
  description,amenities,images,status,floor_number,total_floors,car_parking,
  two_wheeler_parking,furnishing,age_years
) VALUES
  ('demo-property-sale-apartment','demo-agency-1','Sunlit 3 BHK Garden Apartment','sale','Apartment',18500000,3,2,1480,'Indiranagar','Bengaluru','12 Demo Garden Lane, Indiranagar',12.9784,77.6408,'A bright family apartment with a private balcony, practical storage and a landscaped shared garden. Close to metro access, schools and local shopping.','Lift, balcony, security, power backup, gym','["/images/interior.jpg","/images/architecture.jpg"]','published',0,5,1,2,'semi_furnished',6),
  ('demo-property-rent-villa','demo-agency-1','Courtyard Villa with a Home Office','rent','Villa',95000,4,3,2650,'Whitefield','Bengaluru','8 Demo Orchard Road, Whitefield',12.9698,77.7500,'A furnished independent villa with a shaded courtyard, flexible study and room for a family. Available for a 12-month residential rental.','Private garden, fitted kitchen, security, two-car driveway','["/images/architecture.jpg","/images/interior.jpg"]','published',0,2,2,3,'furnished',4),
  ('demo-property-lease-builder-floor','demo-agency-2','Quiet 2 BHK Builder Floor','lease','Builder floor',42000,2,2,1180,'Bandra West','Mumbai','24 Demo Palm Avenue, Bandra West',19.0606,72.8362,'A well-maintained upper-floor home offered on a long-term lease. Includes natural light, a balcony and convenient access to shops and transit.','Balcony, lift, water supply, gated entry','["/images/interior.jpg"]','pending',2,4,1,1,'unfurnished',11),
  ('demo-property-sale-plot','demo-agency-2','Residential Corner Plot','sale','Plot',24000000,0,0,2400,'Sarjapur Road','Bengaluru','Demo Layout, Sarjapur Road',12.9107,77.6871,'A residential plot in an established layout, suitable for a custom family home subject to local planning approvals.','Corner plot, paved road, utilities nearby','["/images/architecture.jpg"]','published',0,NULL,0,0,'not_applicable',NULL)
ON CONFLICT(id) DO UPDATE SET
  agency_id=excluded.agency_id,title=excluded.title,intent=excluded.intent,type=excluded.type,
  price=excluded.price,beds=excluded.beds,baths=excluded.baths,area=excluded.area,
  locality=excluded.locality,city=excluded.city,address=excluded.address,lat=excluded.lat,
  lng=excluded.lng,description=excluded.description,amenities=excluded.amenities,
  images=excluded.images,status=excluded.status,floor_number=excluded.floor_number,
  total_floors=excluded.total_floors,car_parking=excluded.car_parking,
  two_wheeler_parking=excluded.two_wheeler_parking,furnishing=excluded.furnishing,
  age_years=excluded.age_years;

INSERT INTO leads(id,agency_id,property_id,name,phone,email,intent,requirements,status,notes)
VALUES
  ('demo-lead-apartment','demo-agency-1','demo-property-sale-apartment','Demo Buyer','+91 00000 00001','buyer@example.test','buy','Looking for a 3 BHK near Indiranagar metro; budget around ₹2 crore.','visit scheduled','Demo record only.'),
  ('demo-lead-villa','demo-agency-1','demo-property-rent-villa','Demo Renter','+91 00000 00002','renter@example.test','rent','Family needs a furnished villa near Whitefield from next month.','contacted','Demo record only.'),
  ('demo-lead-lease','demo-agency-2','demo-property-lease-builder-floor','Demo Tenant','+91 00000 00003','tenant@example.test','lease','Interested in a long-term lease; would like to arrange a viewing.','new','Demo record only.')
ON CONFLICT(id) DO UPDATE SET
  agency_id=excluded.agency_id,property_id=excluded.property_id,name=excluded.name,
  phone=excluded.phone,email=excluded.email,intent=excluded.intent,
  requirements=excluded.requirements,status=excluded.status,notes=excluded.notes;

INSERT INTO activity(id,agency_id,actor,action)
VALUES
  ('demo-activity-1','demo-agency-1','Demo Agency One','Published demo apartment listing'),
  ('demo-activity-2','demo-agency-1','Demo Agency One','Received enquiry from Demo Buyer'),
  ('demo-activity-3','demo-agency-1','Demo Agency One','Contacted Demo Renter'),
  ('demo-activity-4','demo-agency-2','Demo Agency Two','Submitted builder floor for review'),
  ('demo-activity-5','demo-agency-2','Demo Agency Two','Published residential plot listing')
ON CONFLICT(id) DO UPDATE SET
  agency_id=excluded.agency_id,actor=excluded.actor,action=excluded.action;

COMMIT;
