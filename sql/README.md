# SQL installation and migration

Run SQL using the Supabase SQL editor as `postgres`. Never put service-role keys
inside SQL or commit them. These files do not create Auth passwords.

## New database

Run **`schema.postgres.sql`** once. This is the complete, current PostgreSQL
schema: agency roles, private workspaces, storage, summaries, public catalogue,
public enquiries and office-map updates. No other migration is needed afterward.

For an existing Auth account, optionally edit the email in
`provision-super-admin.postgres.sql` and run it to grant platform-admin access.
Demo data is optional and belongs in a test project, not your production data.

## Existing database

Apply these in order (skip a migration already applied):

1. `migrations/20261101_dashboard_summary.sql`
2. **`migrations/20261102_marketplace_and_agency_map.sql`**

The marketplace migration contains all three feature modules in one transaction.
It can be rerun and does not delete records or change existing agency approvals.
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
