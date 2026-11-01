# Marketplace and agency map upgrade

## What changes

Visitors can browse `/properties`, filter by city/locality, sale/rent/lease,
property type, price and bedrooms, and open a property detail page. Results are
paginated. The homepage shows recent public listings to visitors. Property pages
show a neighbourhood map with approximate coordinates and an enquiry form.

Public enquiries are delivered to the property's agency as `new` enquiries.
The server validates contact details and message length and applies contact and
global submission limits. Office addresses, agency phone numbers, account data,
customer lists and management actions remain protected. Photos are public only
when they belong to an active agency's published listing; the Storage bucket
remains private. Withdrawing a listing removes it and its unattached private
photos from public access.

The platform admin manages agencies, listings, enquiries and account access.
Agency admins manage their own office profile, listings, enquiries and team.
Agents retain their existing workspace permissions. The **Recent activity**
section and navigation item have been removed. Internal server activity records
are retained for administration; the dashboard no longer queries/displays them.

## Apply SQL separately

See [SQL installation](../sql/README.md). For an existing installation, first
apply the dashboard summary migration if needed, then run
`sql/migrations/20261102_marketplace_and_agency_map.sql` in the Supabase SQL editor.
For a fresh database, use `sql/schema.postgres.sql` instead. The three feature
modules are also provided separately under `sql/modules` for review.

**Visibility change:** all `published` sale/rent/lease properties from `active`
agencies are now public. Change any listing that should stay private to
`withdrawn` before enabling this version. Other statuses remain private.

## Configure and run

Use Node >=22.13. Set the following securely in `.env.local` or environment
settings (never commit values):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only, needed for enquiries and photo access)

Allow your exact Supabase project hostname, plus `www.openstreetmap.org`,
`tile.openstreetmap.org` and `nominatim.openstreetmap.org` if outbound networking
is restricted. Address searches go through the authenticated server route;
map tiles are requested by the user's browser. Nominatim receives the address
only when an administrator explicitly clicks “Find address on map”. Its public
service is suitable for low-volume use; for a larger deployment, use a managed
geocoder or a shared distributed request queue to enforce provider-wide limits.
The current route limits requests per server instance.

```sh
npm ci --registry=https://registry.npmjs.org --replace-registry-host=registry.npmmirror.com
npm run lint
npm run test:sql
npm run build
npm run test:smoke
npm run dev
```

## Edit an agency office

Open Agency profile (agency admin) or expand an agency under Agencies (platform
admin). Edit the office address, click “Find address on map” and select a result,
or click the map to choose a pin. Zoom controls and arrow-key pin adjustment are
available. Coordinates can also be entered manually if the lookup is unavailable.
After an address/coordinate edit, confirm the location before saving.
“Save agency & map” writes the office details and coordinates in one update.
The dashboard and signed-in agency homepage reload the saved office map. This
never changes individual property coordinates.

## Validation limits

Automated SQL checks use an isolated PostgreSQL-compatible engine with mocked
Supabase Auth/Storage system tables. Browser tests use fictional data and
mocked geocoder responses. The production build passes without embedding runtime credentials. Live sign-in,
real map-provider responses, HTTP smoke tests and deployed enquiries still need
a configured Supabase project and allowed network access; the cloud instance
currently lacks Supabase URL/keys.
