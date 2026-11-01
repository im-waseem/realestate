# Dashboard upgrade

The platform administrator and agency workspace now have separate navigation
and overview content. Each navigation item opens a focused view rather than
scrolling through every management form.

- **Platform admin:** agency approvals and suspension, agency business details,
  all property inventory, enquiries, user accounts and platform activity.
- **Agency admin:** agency inventory, customer follow-ups, team accounts and
  business profile. Existing permissions still control every server action.
- **Agents:** agency listings and enquiries with their existing permissions;
  agency profile editing and staff creation remain restricted to administrators.

The overview shows next actions, listing availability and current counts.
Agencies, properties and people support search. Agency details and account
editing expand when needed. Navigation works with direct links and browser
back/forward. Transitions respect the device's reduced-motion preference.

## Upgrade an existing Supabase project

1. Back up your database using your normal Supabase backup process.
2. In the Supabase SQL editor, run
   `sql/migrations/20261101_dashboard_summary.sql` as `postgres` **before
   starting this version of the dashboard**. It adds a summary function and
   indexes; it does not delete or rewrite existing records, roles or policies.
3. For a new project, run the complete `sql/schema.postgres.sql` instead. It
   includes the same upgrade. Do not run the legacy SQLite schema.
4. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and
   server-only `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` or your environment's
   secure settings. Do not commit keys. Existing accounts remain unchanged;
   this upgrade does not require seeding or sending invitations.
5. From the repository directory, run:

   ```sh
   npm ci --registry=https://registry.npmjs.org --replace-registry-host=registry.npmmirror.com
   npm run lint
   npm run build
   npm run test:smoke
   npm run dev
   ```

The summary function uses `SECURITY INVOKER`, so existing PostgreSQL row-level
security determines which agency records it can count. Only authenticated users
can execute it. Counts are computed in PostgreSQL rather than from a limited
API result page. An installation missing the migration reports a summary-loading
error rather than showing misleading zero counts.

## Validation and limits

The upgrade was checked with lint, TypeScript, actual dashboard components in a
browser using fictional data (admin and agency views, navigation, direct links,
search, mobile layout and reduced motion), and an isolated PostgreSQL-compatible
PGlite database. SQL checks applied the full schema and migration twice and
verified administrator totals, two agencies' isolated totals, anonymous denial
and suspended-agency inventory denial. These checks do not provision or change
your Supabase project.

The cloud environment currently has no Supabase URL or keys. Production build
compilation and TypeScript pass, but prerendering fails at the missing Supabase
configuration. Live sign-in, agency approvals, mutations and Storage uploads
must be verified against your configured project after applying the migration.
The existing smoke test also requires that configuration; its SQL text assertions
alone do not establish live RLS behavior.

## Dashboard visual refresh

The workspace now uses an explicitly imported CSS Module with a dark sidebar,
full-width responsive content, icon-based metric cards, and clear primary and
secondary actions. The custom Tailwind loader runs only on `globals.css`;
CSS Modules use Next.js native processing. This also restores the enquiry
table's scoped styles.

Save buttons show a spinner and disable during submission. Destructive actions
open a styled confirmation dialog with cancel focus, Escape dismissal, and a
separate confirmation step. Button hover/press effects, section transitions,
metric entrances, and inventory bars respect reduced-motion preferences.

After pulling this revision, **stop and restart the development server** because
`next.config.ts` has changed. Then reload the dashboard. Keep the Supabase
configuration and summary migration from the earlier upgrade.

The visual refresh was browser-tested with fictional data using the dashboard
CSS emitted by Next.js, including pending save/delete states and confirmation
focus/cancellation. Compilation and TypeScript pass without stylesheet
warnings; full production build still requires the missing Supabase settings.
