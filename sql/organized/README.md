# Organized SQL Files

All SQL scripts for the Real Estate project have been consolidated into this single folder.
Files are grouped by purpose into numbered subfolders for logical execution order.

## Folder Structure

### `01-schema/` — Database Schema Definitions
| File | Database | Description |
|------|----------|-------------|
| `schema.sql` | SQLite | Local SQLite schema with tables, indexes, and triggers |
| `schema.postgres.sql` | PostgreSQL / Supabase | Full Supabase schema with RLS policies, functions, and triggers |

### `02-seeds/` — Demo / Seed Data
| File | Database | Description |
|------|----------|-------------|
| `demo-data.sql` | SQLite | Demo agencies, properties, leads, and activity |
| `demo-data.postgres.sql` | PostgreSQL / Supabase | Demo data for Supabase (run after schema.postgres.sql) |
| `seed-demo-properties-babywaseem786.postgres.sql` | PostgreSQL / Supabase | Optional demo listings for agency_admin `babywaseem786@gmail.com` |

### `03-provisioning/` — Admin & Agency Provisioning
| File | Database | Description |
|------|----------|-------------|
| `provision-super-admin.postgres.sql` | PostgreSQL / Supabase | Creates a super_admin profile for a given auth email |
| `provision-demo-agency.postgres.sql` | PostgreSQL / Supabase | Sets up a demo agency and links an agency_admin auth user |

### `04-accounts/` — Account Management (mixed from `data/`)
| File | Database | Description |
|------|----------|-------------|
| `accounts-update.sql` | PostgreSQL / Supabase | Creates/updates admin and demo agency user accounts with scrypt password hashes |
| `accounts-update.sqlite.sql` | SQLite | SQLite equivalent of accounts-update.sql |

### `05-migrations/` — Schema Migrations (in date order)
All migration files must be applied sequentially by their filename prefix (YYYYMMDD_):

| # | File | Description |
|---|------|-------------|
| 1 | `20261101_dashboard_summary.sql` | Dashboard summary function + indexes |
| 2 | `20261102_marketplace_and_agency_map.sql` | Public property listing functions + agency update trigger |
| 3 | `20261103_service_provider_directory.sql` | Service providers table + RLS policies |
| 4 | `20261104_walk_in_enquiries.sql` | Walk-in enquiry support on leads table |
| 5 | `20261105_property_owner_contacts.sql` | Owner contact fields on properties table |
| 6 | `20261106_flexible_service_providers_and_lead_ids.sql` | Flexible service provider category + lead ID defaults |
| 7 | `20261107_agency_qr_enquiries.sql` | Public agency lookup + agency enquiry submission |
| 8 | `20261108_service_provider_crud_access.sql` | Reassert service provider CRUD RLS policies |
| 9 | `20261109_agency_qr_service_provider_rls.sql` | QR visitor agency access + service provider RLS |
| 10 | `20261110_agency_profile_details.sql` | Agency contact/profile detail fields |
| 11 | `20261111_property_featured.sql` | Featured listing flag on properties |
| 12 | `20261122_enquiry_assignment.sql` | Lead assignment + status check constraint |
| 13 | `20261123_team_invites_agency_logo.sql` | Profile is_active + agency logo_url |
| 14 | `20261124_agency_uploads_hardening.sql` | Updated_at timestamps + upload indexing + delete agency fix |
| 15 | `20261125_agency_feature_flags.sql` | Agency feature flags (home_loans, tools) |
| 16 | `20261126_home_loans.sql` | Loan leads and loan documents tables + RLS |

### `06-modules/` — Reusable Module Functions
| File | Description |
|------|-------------|
| `01-public-catalog.sql` | Public property search function + photo access check |
| `02-public-enquiries.sql` | Public enquiry submission function |
| `03-agency-map.sql` | Agency update timestamp trigger |

## Execution Order (for a fresh PostgreSQL/Supabase setup)

1. `01-schema/schema.postgres.sql`
2. `03-provisioning/provision-super-admin.postgres.sql`
3. `03-provisioning/provision-demo-agency.postgres.sql`
4. `02-seeds/demo-data.postgres.sql`
5. `05-migrations/` — apply all 16 files in numeric order
6. `06-modules/` — apply all 3 module files
7. `02-seeds/seed-demo-properties-babywaseem786.postgres.sql` (optional)

## Execution Order (for SQLite local development)

1. `01-schema/schema.sql`
2. `04-accounts/accounts-update.sqlite.sql`
3. `02-seeds/demo-data.sql`

## Notes

- SQLite files use `PRAGMA` directives and `TEXT`/`REAL`/`INTEGER` types.
- PostgreSQL/Supabase files use `TIMESTAMPTZ`, `UUID`, `JSONB`, RLS policies, and `gen_random_uuid()`.
- Do NOT store passwords in SQL files except the pre-hashed scrypt values already present in `accounts-update.*` files.
- All migration files are idempotent (safe to rerun) where possible.