# Waseem Realty

A real estate marketplace with public property discovery and separate platform
admin, agency admin and agent workspaces. Use Node.js **22.13 or later**.

## Setup

1. Create/configure a Supabase project (Auth, PostgreSQL and private Storage).
2. Follow [SQL installation](sql/README.md). New databases use
   `sql/schema.postgres.sql`; existing databases apply the migrations in order.
3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and
   server-only `SUPABASE_SERVICE_ROLE_KEY` securely in `.env.local` or deployment
   settings. Never commit API keys or prefix the service key with `NEXT_PUBLIC_`.
4. Install and run:

   ```sh
   npm ci --registry=https://registry.npmjs.org --replace-registry-host=registry.npmmirror.com
   npm run dev
   ```

See [Marketplace and map setup](docs/marketplace-setup.md) for network access,
map configuration, upgrade instructions and validation limitations.

## Roles and visibility

- **Visitors:** search published sale/rent/lease listings from active agencies,
  see property details and approximate neighbourhood maps, and submit enquiries.
- **Platform admin:** approve/suspend agencies and manage agency details,
  properties, enquiries and account access across the platform.
- **Agency admin:** manage their own listings, enquiries, office profile/map
  and team. Pending or suspended agencies cannot access the workspace.
- **Agent:** manage their agency's properties and enquiries with existing role
  permissions; cannot edit the agency business profile or create staff accounts.

Public listing projection excludes property street addresses, exact coordinates,
agency office contact details, account data and customer records. Workspaces
remain protected by authentication and PostgreSQL row-level security. Public
photos are served only for eligible published properties; Storage stays private.
Changing the office pin does not move property locations. Recent activity is
removed from the dashboard UI.

## SQL files

- `sql/schema.postgres.sql`: complete schema for a new Supabase installation.
- `sql/migrations/20261101_dashboard_summary.sql`: existing dashboard upgrade.
- `sql/migrations/20261102_marketplace_and_agency_map.sql`: combined marketplace,
  enquiry and agency-map upgrade for an existing database.
- `sql/modules/`: separate feature SQL files for review; use the combined
  migration to install atomically.
- `sql/provision-super-admin.postgres.sql`: edit the example email and run for
  an existing Supabase Auth account to grant platform-admin access.

Legacy SQLite scripts are not used by this application. Do not run them for
Supabase. The migrations do not import SQLite data or create passwords.

## Accounts and optional demo data

Agency registrations remain pending until a platform admin approves them.
`npm run setup:admin` provisions the configured administrator profile;
`npm run setup:demo` also seeds fictional agencies/listings/enquiries. These
commands can invite missing Auth accounts and modify remote records, so run
only against the intended project. Existing Supabase passwords are unchanged.
Configure `ADMIN_NAME`, `ADMIN_EMAIL`, and optional `DEMO_AGENCY_1_NAME`,
`DEMO_AGENCY_1_EMAIL` (also `_2_`). New invitees accept the Supabase invitation
and set their own password. Keep demo data in a development project.

## Checks

```sh
npm run lint
npm run test:sql
npm run build
npm run test:smoke
```

SQL tests run entirely locally with fictional data. Build and HTTP smoke tests
need the Supabase configuration. The smoke suite checks public rendering and
unauthenticated access boundaries; it does not replace authenticated end-to-end
checks against a real Supabase project. On PowerShell use `npm.cmd` if required.
