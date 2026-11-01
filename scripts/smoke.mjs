import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const base = "http://localhost:3117";
const postgresSchema = readFileSync("sql/schema.postgres.sql", "utf8");
assert.match(postgresSchema, /ALTER TABLE public\.leads ENABLE ROW LEVEL SECURITY/);
assert.match(postgresSchema, /CREATE POLICY leads_read_workspace[\s\S]*?realty_is_super_admin\(\)[\s\S]*?realty_current_agency_id\(\)/);
assert.match(postgresSchema, /CREATE POLICY leads_insert_enquiry[\s\S]*?realty_is_super_admin\(\)/);
assert.match(postgresSchema, /CREATE POLICY leads_update_workspace[\s\S]*?realty_is_super_admin\(\)/);
assert.match(postgresSchema, /CREATE POLICY leads_delete_workspace[\s\S]*?realty_is_super_admin\(\)[\s\S]*?realty_current_agency_id\(\)/);
assert.match(postgresSchema, /CREATE OR REPLACE FUNCTION public\.realty_admin_delete_agency/);
assert.match(postgresSchema, /DELETE FROM public\.leads WHERE agency_id = target_agency_id/);
assert.match(postgresSchema, /CREATE TABLE IF NOT EXISTS public\.uploads/);
assert.match(postgresSchema, /CREATE POLICY property_photos_admin_delete ON storage\.objects[\s\S]*?public\.realty_is_super_admin\(\)/);
assert.match(postgresSchema, /VALUES \(new_agency_id, btrim\(p_agency_name\), 'pending'/);
assert.doesNotMatch(postgresSchema, /UPDATE public\.agencies SET status = 'active' WHERE status = 'pending'/);
assert.match(postgresSchema, /INSERT INTO storage\.buckets[\s\S]*?property-photos[\s\S]*?FALSE/);
assert.doesNotMatch(postgresSchema, /CREATE VIEW public\.published_properties/);
assert.match(readFileSync("app/actions.ts", "utf8"), /status: "pending"/);
assert.match(readFileSync("app/actions.ts", "utf8"), /supabase\.storage[\s\S]*?\.remove\(/);
assert.doesNotMatch(readFileSync("app/actions.ts", "utf8").match(/export async function deleteAgency[\s\S]*?export async function addStaff/)?.[0] || "", /createSupabaseAdminClient/);
assert.match(readFileSync("app/dashboard/page.tsx", "utf8"), /Approve agency/);
assert.match(readFileSync("lib/supabase/admin.ts", "utf8"), /SUPABASE_SERVICE_ROLE_KEY/);
assert.doesNotMatch(readFileSync("app\/HomeClient.tsx", "utf8"), /SUPABASE_SERVICE_ROLE_KEY/);

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--port", "3117"], {
  env: { ...process.env, REALTY_TEST_DIST: ".next-smoke" },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
child.stdout.on("data", (chunk) => { output += chunk; });
child.stderr.on("data", (chunk) => { output += chunk; });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null) throw new Error("Test server stopped before becoming ready.");
    try {
      const response = await fetch(`${base}/`, { redirect: "manual" });
      if (response.status === 200) {
        const html = await response.text();
        assert.match(html, /Waseem Realty|WASEEM REALTY/i);
        ready = true;
        break;
      }
    } catch {}
    await sleep(500);
  }
  assert.ok(ready, "Supabase-backed app did not become ready.");
  assert.equal((await fetch(`${base}/properties`)).status, 200, "Public property catalogue must render.");
  assert.equal((await fetch(`${base}/api/geocode?q=Bengaluru`)).status, 403, "Office address lookup must require administrator access.");
  assert.equal((await fetch(`${base}/dashboard`, { redirect: "manual" })).status, 307, "Workspace must require Supabase Auth.");
  assert.equal((await fetch(`${base}/api/uploads`, {
    method: "POST",
    headers: { Origin: base },
  })).status, 401, "Photo uploads must require authentication.");
  assert.equal((await fetch(`${base}/media/invalid.png`)).status, 404, "Invalid private media paths must be rejected.");
  console.log("PASS: Supabase RLS/delete schema, server-only service key boundary, public page rendering, protected dashboard, and unauthenticated upload/media denial.");
} catch (error) {
  console.error(error);
  console.error(output.slice(-10000));
  process.exitCode = 1;
} finally {
  child.kill();
}
