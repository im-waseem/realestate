# Vercel deploy checklist

## Before you push
1. **Environment variables (Vercel Project Settings → Environment Variables):**
   - `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL (safe for browser)
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase **anon/publishable** key (safe for browser)
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase **service-role** key (server-only; **never** prefix with `NEXT_PUBLIC_`)
   - `NEXT_PUBLIC_SITE_URL` — deployed site origin (used for canonical QR links)
   - `ADMIN_NAME`, `ADMIN_EMAIL` — optional, used by `npm run setup:admin`

2. **Remove client-side secrets:** Do NOT commit `.env.local`. Ensure no `NEXT_PUBLIC_*` variable holds a service-role key or JWT. `app/.env.local` must contain only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. `SUPABASE_SERVICE_ROLE_KEY` must be server-only (it already is in `lib/supabase/admin.ts`, which rejects `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`).

3. **Apply SQL:** Run the migrations in order against the target Supabase project (postgres in the SQL editor), then the new hardening migration:
   - `sql/schema.postgres.sql` (new DB) or the migration chain (existing DB)
   - `sql/migrations/20261124_agency_uploads_hardening.sql` (latest)
   Verify `public.uploads`, `public.properties`, `public.leads` etc. have RLS enabled and agency-scoped policies.

4. **Storage:** Confirm the `property-photos` bucket exists and is **private** (`public = false`). Uploads are served through the authenticated `/media/[name]` proxy, never directly.

5. **Node:** Node.js **22.13 or later**.

## On Vercel
- Framework preset: Next.js
- Build command: `npm run build`
- Install command: `npm ci` (or `npm install`)
- Output: `.next` (detected automatically)
- Add the environment variables above (Production + Preview environments).

## Post-deploy verification
- `https://<site>/` renders the public catalogue.
- `https://<site>/dashboard` requires Supabase Auth (redirects to `/login` when unauthenticated).
- `https://<site>/api/uploads` rejects unauthenticated requests (401).
- Run `npm run test:sql` locally against a fresh PGlite DB to confirm role-isolated RLS boundaries.
