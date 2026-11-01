# Waseem Realty

Run commands from this directory using Node.js 22.13 or later.

## Supabase configuration and accounts

The application uses Supabase Auth, PostgreSQL, and a private Supabase Storage
bucket at runtime. Configure these variables in `.env.local` beside
`package.json` and in the deployment environment:

```sh
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
npm run setup:demo
npm run dev
```

Keep `SUPABASE_SERVICE_ROLE_KEY` server-only; never give it a `NEXT_PUBLIC_`
prefix or expose it in browser code. Run `sql/schema.postgres.sql` in the
Supabase SQL editor before using the app. `npm run setup:admin` matches the
configured administrator by email, invites the account if it is missing, and
ensures its `super_admin` profile. `npm run setup:demo` does the same for the
demo agency accounts and seeds fictional agencies, listings, enquiries, and
activity. Missing accounts must accept their Supabase invitation and set a
password; existing Supabase passwords are not changed.

Account variables: `ADMIN_NAME`, `ADMIN_EMAIL`, and
`DEMO_AGENCY_1_NAME`, `DEMO_AGENCY_1_EMAIL` (also `_2_`). The setup script
matches these emails against Supabase Auth and does not import records or
password hashes from SQLite.

## SQL and roles

- `sql/schema.postgres.sql`: Supabase Auth profiles, PostgreSQL tables, role-based RLS, safe admin deletion functions, upload metadata, rate limiting, and the private Storage bucket.
- `sql/schema.sql`: legacy SQLite schema only; it is not used by the current application.
- `sql/provision-super-admin.postgres.sql`: maps an already-created Supabase Auth user to the `super_admin` database role. Replace the example email before running.
- `sql/demo-data.sql` and `data/accounts-update.sqlite.sql`: legacy SQLite setup only; they do not seed or update the Supabase runtime.
- `sql/demo-data.postgres.sql`: optional Supabase/PostgreSQL demo records. `npm run setup:demo` also provisions the demo records using the service key.

The application reads and writes Supabase only. Existing local SQLite data is
intentionally not imported; existing Supabase rows are left in place except
when rerunning the demo seed for its fixed demo IDs.

To showcase the demo inventory, accept the invitations sent to the configured
demo agency emails, set passwords through Supabase Auth, then sign in and open
`/dashboard/properties`. Each agency sees only its own listings.

Super admins can manage all agencies, profiles, listings, enquiries, and team
members. They can update agency details, approve or suspend agencies, edit and
reassign team accounts, and delete an agency with its workspace data. New
agency registrations stay pending until the main admin approves them; pending
agencies cannot access their workspace. After approval, agency admins manage
their profile, listings, enquiries, and
agents. Agents work on their own agency's listings and enquiries and cannot add
staff. Suspended agencies cannot access the workspace. Applying the updated
database schema preserves each existing agency's current status.
Roles come from Supabase profiles; the setup commands provision profiles only
when explicitly run.

The super-admin dashboard provides cross-agency management and recent activity.
Agency dashboards show only their own listings, enquiries, and staff; the
agency dashboard does not include the recent-activity panel. Both database
schemas add indexes for tenant-scoped dashboard lists and newest-first activity
feeds.

Agency address, phone and optional coordinates are visible only in authorized
agency workspaces, including the signed-in agency homepage. Only agency admins
can update their business details; updates refresh the workspace homepage.
Property
listings cover apartments, villas, houses, builder floors, penthouses, studios,
plots, farm houses and commercial spaces, with ground/upper-floor, car-parking,
two-wheeler parking, furnishing and property-age fields. Published properties
are private to their owning agency workspace; the dedicated
`/dashboard/properties` page shows only listings belonging to the signed-in
agency. Public property catalog and detail pages do not expose listings, and
uploaded property photos require an authorized agency session. PostgreSQL RLS
likewise restricts property and enquiry access to authorized workspace users.

Agency users can edit and delete their own properties. Deleting a property with
customer enquiries is blocked for agency users. The main admin can manage
properties and enquiries across agencies, and can delete an agency along with
its dependent records. The PostgreSQL schema applies role-aware RLS and provides
a privileged deletion function that removes dependent rows safely.

## Checks

```sh
npx tsc --noEmit
npm run lint
npm run test:smoke
```

On Windows PowerShell with script execution disabled, use `npm.cmd` and `npx.cmd`.

## Supabase Auth and API setup

Run `sql/schema.postgres.sql` as the Supabase SQL editor's `postgres` role. It
also adds the new columns to older PostgreSQL installations and removes the
former public listings view. Create Auth users through Supabase Auth; SQL does not
create or store passwords. Run `sql/provision-super-admin.postgres.sql` after
replacing its example email to grant the platform administrator role.

Agency sign-up is handled by `/register`: the server validates and rate-limits
the request, creates the Supabase Auth user, then creates the agency and
`agency_admin` profile. The form requires the server-only service-role key.
The `register_agency` RPC remains available for authenticated integrations but
is not called by the current registration form. Agency users manage properties
only within their own workspace; listings are not exposed through a public
property view. Do not accept a role or agency ID from an untrusted client when
assigning account roles. Server actions use the authenticated Supabase session
and RLS; account provisioning and private Storage access use the server-only
service-role key.

Alternatively, to seed demo rows through SQL, first create Auth users for
`demo.admin@example.com`, `agency1@example.com`, and `agency2@example.com`, then
run `sql/demo-data.postgres.sql`. This seeds records only for those existing
Auth users. Set their passwords in Supabase Auth, not in SQL.

## Updated admin and agency dashboards

See [Dashboard upgrade](docs/dashboard-upgrade.md) for the new focused workspace
navigation, role-specific overviews, and database migration instructions. Existing
Supabase projects must apply
`sql/migrations/20261101_dashboard_summary.sql` before running this dashboard.
New projects can use the updated complete `sql/schema.postgres.sql`.
