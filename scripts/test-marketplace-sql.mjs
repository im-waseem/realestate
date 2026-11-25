import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
(async()=>{
 const db=new PGlite();
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE SCHEMA storage;
 CREATE TABLE auth.users(id uuid primary key,email text);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
 CREATE TABLE storage.buckets(id text primary key,name text,public boolean);
 CREATE TABLE storage.objects(id uuid primary key,bucket_id text,name text); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`);
 const schema=fs.readFileSync('sql/schema.postgres.sql','utf8');
 const migration=fs.readFileSync('sql/migrations/20261101_dashboard_summary.sql','utf8');
 // Simulate an existing installation before applying the marketplace upgrade twice.
 const marker=schema.indexOf('-- Curated public projection only.');
 const oldSchema=schema.slice(0,marker)+"NOTIFY pgrst, 'reload schema';\nCOMMIT;";
 await db.exec(oldSchema); await db.exec(migration);
 const marketplace=fs.readFileSync('sql/migrations/20261102_marketplace_and_agency_map.sql','utf8');
 for (const file of fs.readdirSync('sql/modules').filter(file=>file.endsWith('.sql'))) {
  const sqlModule=fs.readFileSync(`sql/modules/${file}`,'utf8');
  const functionNames=[...sqlModule.matchAll(/CREATE OR REPLACE FUNCTION\s+public\.([a-z0-9_]+)/gi)].map(match=>match[1]);
  assert.ok(functionNames.length,`Module declares functions: ${file}`);
  for (const functionName of functionNames) {
   const declaration=new RegExp(`CREATE OR REPLACE FUNCTION\\s+public\\.${functionName}\\b`,'i');
   assert.match(schema,declaration,`Fresh schema includes ${functionName}`);
   assert.match(marketplace,declaration,`Migration includes ${functionName}`);
  }
 }
 await db.exec(marketplace); await db.exec(marketplace);
 const featureFlags=fs.readFileSync('sql/migrations/20261125_agency_feature_flags.sql','utf8');
 await db.exec('DROP POLICY IF EXISTS loan_leads_insert_workspace ON public.loan_leads; DROP POLICY IF EXISTS loan_leads_update_workspace ON public.loan_leads; ALTER TABLE public.profiles DROP COLUMN is_active;');
 await db.exec(featureFlags); await db.exec(featureFlags);
 assert.equal((await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='is_active'")).rows.length,1);
 const homeLoans=fs.readFileSync('sql/migrations/20261126_home_loans.sql','utf8');
 await db.exec(homeLoans); await db.exec(homeLoans);
 await db.exec(`INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001','demo.admin@example.com'),('00000000-0000-0000-0000-000000000002','agency1@example.com'),('00000000-0000-0000-0000-000000000003','agency2@example.com');`);
 await db.exec(fs.readFileSync('sql/demo-data.postgres.sql','utf8'));
 async function summary(id){await db.exec(`RESET ROLE; SET request.jwt.claim.sub='${id}'; SET ROLE authenticated;`); return (await db.query('SELECT * FROM public.realty_dashboard_summary()')).rows[0];}
 const admin=await summary('00000000-0000-0000-0000-000000000001');
 const agency1=await summary('00000000-0000-0000-0000-000000000002');
 const agency2=await summary('00000000-0000-0000-0000-000000000003');
 assert.equal(Number(admin.property_total),4); assert.equal(Number(admin.open_leads),3); assert.equal(Number(admin.agency_total),2);
 assert.equal(Number(agency1.property_total),2); assert.equal(Number(agency1.open_leads),2); assert.equal(Number(agency1.pending),0);
 assert.equal(Number(agency2.property_total),2); assert.equal(Number(agency2.open_leads),1); assert.equal(Number(agency2.pending),1);
 await db.exec('RESET ROLE;');
 const defaultFeatures=(await db.query("SELECT features FROM public.agencies WHERE id='demo-agency-1'")).rows[0].features;
 assert.deepEqual(defaultFeatures,{home_loans:false,tools:false});
 await db.exec(`RESET ROLE; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'; SET ROLE authenticated;
 UPDATE public.agencies SET features='{"home_loans":true,"tools":false}' WHERE id='demo-agency-1';
 RESET ROLE; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002'; SET ROLE authenticated;`);
 const loanLead=(await db.query(`INSERT INTO public.loan_leads(agency_id,customer_name,phone,loan_amount,monthly_income,employment_type,city)
 VALUES('demo-agency-1','Loan Customer','+91 90000 10001',5000000,150000,'salaried','Bengaluru') RETURNING id`)).rows[0];
 await db.query(`INSERT INTO public.loan_documents(lead_id,agency_id,doc_type,file_path,file_name,content_type,file_size)
 VALUES('${loanLead.id}','demo-agency-1','id','demo-agency-1/${loanLead.id}/id.pdf','identity.pdf','application/pdf',1024)`);
 await db.exec(`RESET ROLE; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003'; SET ROLE authenticated;`);
 assert.equal((await db.query("SELECT count(*) AS count FROM public.loan_leads")).rows[0].count,0);
 assert.equal((await db.query("SELECT count(*) AS count FROM public.loan_documents")).rows[0].count,0);
 await assert.rejects(()=>db.query(`INSERT INTO public.loan_leads(agency_id,customer_name,phone,loan_amount,monthly_income,employment_type,city)
 VALUES('demo-agency-2','Blocked Customer','+91 90000 10002',5000000,150000,'salaried','Mumbai')`),/row-level security/);
 await db.exec(`RESET ROLE; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'; SET ROLE authenticated;`);
 const adminLoan=(await db.query(`INSERT INTO public.loan_leads(agency_id,customer_name,phone,loan_amount,monthly_income,employment_type,city)
 VALUES('demo-agency-2','Admin Customer','+91 90000 10002',6000000,180000,'self_employed','Mumbai') RETURNING id`)).rows[0];
 assert.equal((await db.query("SELECT count(*) AS count FROM public.loan_leads")).rows[0].count,2);
 await db.exec(`RESET ROLE; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002'; SET ROLE authenticated;`);
 assert.equal((await db.query(`UPDATE public.loan_documents SET verified=true,verified_by='00000000-0000-0000-0000-000000000001',verified_at=now() WHERE lead_id='${loanLead.id}' RETURNING id`)).rows.length,0);
 await db.exec(`RESET ROLE; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'; SET ROLE authenticated;`);
 await db.query(`UPDATE public.loan_documents SET verified=true,verified_by='00000000-0000-0000-0000-000000000001',verified_at=now() WHERE lead_id='${loanLead.id}'`);
 assert.equal((await db.query(`SELECT verified FROM public.loan_documents WHERE lead_id='${loanLead.id}'`)).rows[0].verified,true);
 assert.ok(adminLoan.id);
 await db.exec(`RESET ROLE; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002'; SET ROLE authenticated;`);
 await assert.rejects(()=>db.query("INSERT INTO public.service_providers(id,agency_id,name,category,phone,service_area) VALUES('provider-disabled','demo-agency-1','Local plumber','Plumber','+91 90000 10001','Bengaluru')"),/row-level security/);
 await assert.rejects(()=>db.query("UPDATE public.agencies SET features='{\"home_loans\":false,\"tools\":true}' WHERE id='demo-agency-1'"),/Only the main admin/);
 await db.exec(`RESET ROLE; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'; SET ROLE authenticated;
 UPDATE public.agencies SET features='{\"home_loans\":true,\"tools\":true}' WHERE id='demo-agency-1';
 RESET ROLE; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002'; SET ROLE authenticated;
 INSERT INTO public.service_providers(id,agency_id,name,category,phone,service_area) VALUES('provider-enabled','demo-agency-1','Local plumber','Plumber','+91 90000 10001','Bengaluru');`);
 assert.equal((await db.query("SELECT count(*) AS count FROM public.service_providers")).rows[0].count,1);
 await db.exec(`RESET ROLE; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'; SET ROLE authenticated;
 UPDATE public.agencies SET features='{\"home_loans\":true,\"tools\":false}' WHERE id='demo-agency-1';`);
 await db.exec(`RESET ROLE; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002'; SET ROLE authenticated;`);
 assert.equal((await db.query("SELECT count(*) AS count FROM public.service_providers")).rows[0].count,0);
 assert.equal((await db.query("DELETE FROM public.service_providers WHERE id='provider-enabled' RETURNING id")).rows.length,0);
 await db.exec(`RESET ROLE; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'; SET ROLE authenticated;`);
 assert.equal((await db.query("SELECT count(*) AS count FROM public.service_providers")).rows[0].count,1);
 await db.exec('RESET ROLE; SET ROLE anon;');
 await assert.rejects(()=>db.query('SELECT * FROM public.realty_dashboard_summary()'),/permission denied/);
 await db.exec(`RESET ROLE; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'; UPDATE public.agencies SET status='suspended' WHERE id='demo-agency-1';`);
 const suspended=await summary('00000000-0000-0000-0000-000000000002');
 assert.equal(Number(suspended.property_total),0); assert.equal(Number(suspended.open_leads),0);
 // Office address and pin update together and are visible to platform admins.
 await db.exec(`RESET ROLE; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003'; SET ROLE authenticated;
 UPDATE public.agencies SET address='Updated office in Mumbai',lat=19.1,lng=72.9 WHERE id='demo-agency-2'; RESET ROLE;`);
 const office=(await db.query("SELECT address,lat,lng,updated_at FROM public.agencies WHERE id='demo-agency-2'")).rows[0];
 assert.equal(office.address,'Updated office in Mumbai'); assert.equal(office.lat,19.1); assert.equal(office.lng,72.9); assert.ok(office.updated_at);
 assert.equal((await db.query("SELECT lat FROM public.properties WHERE id='demo-property-lease-builder-floor'")).rows[0].lat,19.0606);
 // Public APIs expose only published listings of active agencies, with a safe projection.
 await db.exec(`RESET ROLE; SET request.jwt.claim.sub=''; SET ROLE anon;`);
 let catalogue=(await db.query('SELECT * FROM public.realty_public_properties()')).rows;
 assert.equal(catalogue.length,1); // Agency one is suspended; agency two has one published property.
 assert.ok(!('agency_id' in catalogue[0])); assert.ok(!('address' in catalogue[0])); assert.ok(!('phone' in catalogue[0]));
 assert.ok(!('lat' in catalogue[0])); assert.ok('map_lat' in catalogue[0]);
 assert.equal((await db.query("SELECT * FROM public.realty_public_properties(target_id=>'demo-property-lease-builder-floor')")).rows.length,0);
 await assert.rejects(()=>db.query('SELECT * FROM public.properties'),/permission denied/);
 await assert.rejects(()=>db.query('SELECT * FROM public.leads'),/permission denied/);
 await assert.rejects(()=>db.query('SELECT * FROM public.agencies'),/permission denied/);
 await assert.rejects(()=>db.query("SELECT public.realty_submit_public_enquiry('x','Visitor','9876543210','visitor@example.test','Please arrange a visit')"),/permission denied/);
 await db.exec(`RESET ROLE; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'; UPDATE public.agencies SET status='active' WHERE id='demo-agency-1';`);
 await db.exec(`INSERT INTO public.uploads(name,agency_id) VALUES('11111111-1111-1111-1111-111111111111.jpg','demo-agency-1'),('22222222-2222-2222-2222-222222222222.jpg','demo-agency-2'); UPDATE public.properties SET images='["/media/11111111-1111-1111-1111-111111111111.jpg","/media/22222222-2222-2222-2222-222222222222.jpg"]' WHERE id='demo-property-sale-apartment'; SET ROLE anon;`);
 assert.equal((await db.query("SELECT public.realty_public_photo_allowed('11111111-1111-1111-1111-111111111111.jpg') AS allowed")).rows[0].allowed,true);
 assert.equal((await db.query("SELECT public.realty_public_photo_allowed('22222222-2222-2222-2222-222222222222.jpg') AS allowed")).rows[0].allowed,false);
 await db.exec(`RESET ROLE; UPDATE public.properties SET status='withdrawn' WHERE id='demo-property-sale-apartment'; SET ROLE anon;`);
 assert.equal((await db.query("SELECT public.realty_public_photo_allowed('11111111-1111-1111-1111-111111111111.jpg') AS allowed")).rows[0].allowed,false);
 await db.exec(`RESET ROLE; UPDATE public.properties SET status='published' WHERE id='demo-property-sale-apartment'; SET ROLE anon;`);
 assert.equal((await db.query("SELECT * FROM public.realty_public_properties(search_text=>'Indiranagar',listing_intent=>'sale',minimum_beds=>3)")).rows.length,1);
 assert.equal((await db.query("SELECT * FROM public.realty_public_properties(minimum_price=>30000000)")).rows.length,0);
 await db.exec('RESET ROLE; SET ROLE service_role;');
 for(let i=0;i<3;i++) await db.query("SELECT public.realty_submit_public_enquiry('demo-property-sale-apartment','Visitor','9876543210','visitor@example.test','Please arrange a visit this week')");
 await assert.rejects(()=>db.query("SELECT public.realty_submit_public_enquiry('demo-property-sale-apartment','Visitor','9876543210','visitor@example.test','Please arrange a visit this week')"),/Too many enquiries/);
 await assert.rejects(()=>db.query("SELECT public.realty_submit_public_enquiry('demo-property-lease-builder-floor','Visitor','9876543211','other@example.test','Please arrange a visit this week')"),/no longer available/);
 await db.exec('RESET ROLE;');
 const enquiries=(await db.query("SELECT * FROM public.leads WHERE email='visitor@example.test'")).rows;
 assert.equal(enquiries.length,3); assert.ok(enquiries.every(row=>row.agency_id==='demo-agency-1'&&row.property_id==='demo-property-sale-apartment'&&row.status==='new'));
 // A fresh installation includes the same upgrade and preserves existing records on rerun.
 await db.exec(schema);
 assert.equal((await db.query("SELECT count(*) AS count FROM public.leads WHERE email='visitor@example.test'")).rows[0].count,3);
 console.log('PASS: repeatable upgrade and fresh schema; default-off feature flags; agency-isolated home-loan leads/documents with admin bypass; feature-gated service-provider CRUD; role-isolated counts; curated public search; private-table denial; photo ownership; enquiry routing, validation and throttling; existing data preserved.');
 await db.close();
})().catch(e=>{console.error(e);process.exitCode=1});
