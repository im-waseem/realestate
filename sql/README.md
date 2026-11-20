# SQL installation and migration

Run SQL using the Supabase SQL editor as `postgres`. Never put service-role keys
inside SQL or commit them. These files do not create Auth passwords.

## New database

Run **`schema.postgres.sql`** once. This is the complete, current PostgreSQL
schema: agency roles, private workspaces, storage, summaries, public catalogue,
public enquiries and office-map updates. No other migration is needed afterward.

To add sample listings to the agency attached to `babywaseem786@gmail.com`,
run `seed-demo-properties-babywaseem786.postgres.sql` after that Auth user has
an `agency_admin` profile. The six Bengaluru examples are marked `pending` and
use placeholder descriptions and local sample photos; review and replace their
details before publishing.

For an existing Auth account, optionally edit the email in
`provision-super-admin.postgres.sql` and run it to grant platform-admin access.
Demo data is optional and belongs in a test project, not your production data.

For a single test agency login, run `provision-demo-agency.postgres.sql`. It
creates the active `Demo Agency One` workspace. If `demoagency1@gmail.com` is
not in Auth yet, it prints a notice; create or invite the user in Supabase Auth,
then rerun the SQL to grant agency-admin access. Set the password in Supabase
Auth; the SQL file does not contain or change passwords.

Each agency admin and staff member signs in with their own Supabase Auth email
and password. The matching `profiles.id` is the Auth user ID, and
`profiles.agency_id` assigns that account to exactly one agency workspace. Do
not put passwords in SQL or share one login across agencies. Agency QR links
show a limited contact card for that active agency without requiring a client
login; submitted enquiries are routed to that same agency and are not publicly
readable.

## Existing database

Apply these in order (skip a migration already applied):

1. `migrations/20261101_dashboard_summary.sql`
2. **`migrations/20261102_marketplace_and_agency_map.sql`**
3. `migrations/20261103_service_provider_directory.sql`
4. `migrations/20261104_walk_in_enquiries.sql`
5. `migrations/20261105_property_owner_contacts.sql`
6. `migrations/20261106_flexible_service_providers_and_lead_ids.sql`
7. `migrations/20261107_agency_qr_enquiries.sql`
8. `migrations/20261108_service_provider_crud_access.sql`
9. `migrations/20261109_agency_qr_service_provider_rls.sql`
10. `migrations/20261110_agency_profile_details.sql`

The marketplace migration contains all three feature modules in one transaction.
The service-provider migration adds an agency-owned directory for local trades.
The walk-in enquiry migration makes manual lead email optional and adds source
and client-area fields. These migrations can be rerun and do not delete records
or change existing agency approvals. The property owner-contact migration adds
private listing-owner details, which are excluded from public property results.
The service-provider update permits any 2–60 character trade or local service,
and restores the database-generated id default for customer enquiries.
The agency QR migration exposes a limited active-agency contact projection and
adds rate-limited enquiry capture without granting public access to lead records.
The service-provider CRUD migration reapplies agency-scoped read, create, update,
and delete policies and grants those operations only to authenticated users.
The final security migration restricts service-provider rows to the signed-in
user's active agency, exposes only limited active-agency contact details to QR
visitors, and keeps QR enquiry insertion behind the server-side service role.
Trade categories remain flexible text in SQL; the agency form provides a broad
real-estate service dropdown without requiring future schema changes.
The agency-profile migration adds contact, registration, location and business
details to each workspace and prefills the agency-admin contact from its login
profile. Run the demo property seed only when you intentionally want sample data
inside that agency; it never changes passwords or publishes the listings.
Published listings belonging to active agencies become publicly discoverable,
including sale, rent and lease listings. Withdraw listings first if they should
remain private. Workspace tables remain inaccessible to anonymous API clients.
The existing agency/property permissions remain in effect.

## Separate feature files

For reviewing each feature independently:

- `modules/01-public-catalog.sql`: curated listing/search projection and public
  photo eligibility. No office address, account details, customer details,
  property street address, or exact coordinates are exposed by the projection.
- `modules/02-public-enquiries.sql`: validated, throttled enquiry insertion.
  Only the application server's service role can execute it. The destination
  agency is derived from the property, never trusted from the visitor's form.
- `modules/03-agency-map.sql`: agency update timestamp and trigger. Existing
  address/latitude/longitude columns store the office location together.

Prefer the combined migration when installing. Do not run the legacy SQLite
files (`schema.sql`, `demo-data.sql`) for this Supabase application.

## Verification

`npm run test:sql` creates an isolated PGlite PostgreSQL-compatible database,
applies migrations twice, and checks public/private boundaries, image ownership,
agency-isolated counts, enquiry routing and rate limits. It does not connect to,
seed, or modify your Supabase project. Run live role checks against your configured
project before deployment.
