import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const supplied = { ...process.env };
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
Object.assign(process.env, supplied);

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Configure ${name} in the server environment.`);
  return value;
}

function check(error) {
  if (error) throw new Error(error.message);
}

const emailAddress = (prefix) => required(`${prefix}_EMAIL`).toLowerCase();
const accountName = (prefix) => process.env[`${prefix}_NAME`]?.trim() || "Agency administrator";
const supabase = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findAuthUser(email) {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    check(error);
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 1000) return undefined;
  }
}

async function ensureAuthUser(prefix) {
  const email = emailAddress(prefix);
  const existing = await findAuthUser(email);
  if (existing) return existing;
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { full_name: accountName(prefix) },
  });
  check(error);
  if (!data.user) throw new Error(`Supabase did not create an invitation for ${email}.`);
  console.log(`Invited ${email}; the user must accept the invitation and set a password.`);
  return data.user;
}

async function upsertRows(table, rows) {
  const { error } = await supabase.from(table).upsert(rows);
  check(error);
}

async function setup() {
  const adminUser = await ensureAuthUser("ADMIN");
  await upsertRows("profiles", [{
    id: adminUser.id,
    name: accountName("ADMIN"),
    email: emailAddress("ADMIN"),
    role: "super_admin",
    agency_id: null,
  }]);

  if (!process.argv.includes("--demo")) {
    console.log("Main admin profile is ready in Supabase.");
    return;
  }

  const agencyRows = [];
  const profiles = [];
  for (let index = 1; index <= 2; index++) {
    const prefix = `DEMO_AGENCY_${index}`;
    const user = await ensureAuthUser(prefix);
    const agencyId = `demo-agency-${index}`;
    agencyRows.push({
      id: agencyId,
      name: accountName(prefix),
      status: "active",
      phone: index === 1 ? "+91 90000 10001" : "+91 90000 10002",
      address: index === 1
        ? "12 Residency Road, Ashok Nagar, Bengaluru, Karnataka"
        : "42 Linking Road, Bandra West, Mumbai, Maharashtra",
      lat: index === 1 ? 12.9668 : 19.0606,
      lng: index === 1 ? 77.6017 : 72.8362,
    });
    profiles.push({
      id: user.id,
      name: accountName(prefix),
      email: emailAddress(prefix),
      role: "agency_admin",
      agency_id: agencyId,
    });
  }
  await upsertRows("agencies", agencyRows);
  await upsertRows("profiles", profiles);
  await upsertRows("properties", [
    { id: "demo-property-sale-apartment", agency_id: "demo-agency-1", title: "Sunlit 3 BHK Garden Apartment", intent: "sale", type: "Apartment", price: 18500000, beds: 3, baths: 2, area: 1480, locality: "Indiranagar", city: "Bengaluru", address: "12 Demo Garden Lane, Indiranagar", lat: 12.9784, lng: 77.6408, description: "A bright family apartment with a private balcony, practical storage and a landscaped shared garden. Close to metro access, schools and local shopping.", amenities: "Lift, balcony, security, power backup, gym", images: '["/images/interior.jpg","/images/architecture.jpg"]', status: "published", floor_number: 0, total_floors: 5, car_parking: 1, two_wheeler_parking: 2, furnishing: "semi_furnished", age_years: 6 },
    { id: "demo-property-rent-villa", agency_id: "demo-agency-1", title: "Courtyard Villa with a Home Office", intent: "rent", type: "Villa", price: 95000, beds: 4, baths: 3, area: 2650, locality: "Whitefield", city: "Bengaluru", address: "8 Demo Orchard Road, Whitefield", lat: 12.9698, lng: 77.75, description: "A furnished independent villa with a shaded courtyard, flexible study and room for a family. Available for a 12-month residential rental.", amenities: "Private garden, fitted kitchen, security, two-car driveway", images: '["/images/architecture.jpg","/images/interior.jpg"]', status: "published", floor_number: 0, total_floors: 2, car_parking: 2, two_wheeler_parking: 3, furnishing: "furnished", age_years: 4 },
    { id: "demo-property-lease-builder-floor", agency_id: "demo-agency-2", title: "Quiet 2 BHK Builder Floor", intent: "lease", type: "Builder floor", price: 42000, beds: 2, baths: 2, area: 1180, locality: "Bandra West", city: "Mumbai", address: "24 Demo Palm Avenue, Bandra West", lat: 19.0606, lng: 72.8362, description: "A well-maintained upper-floor home offered on a long-term lease. Includes natural light, a balcony and convenient access to shops and transit.", amenities: "Balcony, lift, water supply, gated entry", images: '["/images/interior.jpg"]', status: "pending", floor_number: 2, total_floors: 4, car_parking: 1, two_wheeler_parking: 1, furnishing: "unfurnished", age_years: 11 },
    { id: "demo-property-sale-plot", agency_id: "demo-agency-2", title: "Residential Corner Plot", intent: "sale", type: "Plot", price: 24000000, beds: 0, baths: 0, area: 2400, locality: "Sarjapur Road", city: "Bengaluru", address: "Demo Layout, Sarjapur Road", lat: 12.9107, lng: 77.6871, description: "A residential plot in an established layout, suitable for a custom family home subject to local planning approvals.", amenities: "Corner plot, paved road, utilities nearby", images: '["/images/architecture.jpg"]', status: "published", floor_number: 0, total_floors: null, car_parking: 0, two_wheeler_parking: 0, furnishing: "not_applicable", age_years: null },
  ]);
  await upsertRows("leads", [
    { id: "demo-lead-apartment", agency_id: "demo-agency-1", property_id: "demo-property-sale-apartment", name: "Demo Buyer", phone: "+91 00000 00001", email: "buyer@example.test", intent: "buy", requirements: "Looking for a 3 BHK near Indiranagar metro; budget around ₹2 crore.", status: "visit scheduled", notes: "Demo record only." },
    { id: "demo-lead-villa", agency_id: "demo-agency-1", property_id: "demo-property-rent-villa", name: "Demo Renter", phone: "+91 00000 00002", email: "renter@example.test", intent: "rent", requirements: "Family needs a furnished villa near Whitefield from next month.", status: "contacted", notes: "Demo record only." },
    { id: "demo-lead-lease", agency_id: "demo-agency-2", property_id: "demo-property-lease-builder-floor", name: "Demo Tenant", phone: "+91 00000 00003", email: "tenant@example.test", intent: "lease", requirements: "Interested in a long-term lease; would like to arrange a viewing.", status: "new", notes: "Demo record only." },
  ]);
  await upsertRows("activity", [
    { id: "demo-activity-1", agency_id: "demo-agency-1", actor: "Demo Agency One", action: "Published demo apartment listing" },
    { id: "demo-activity-2", agency_id: "demo-agency-1", actor: "Demo Agency One", action: "Received enquiry from Demo Buyer" },
    { id: "demo-activity-3", agency_id: "demo-agency-1", actor: "Demo Agency One", action: "Contacted Demo Renter" },
    { id: "demo-activity-4", agency_id: "demo-agency-2", actor: "Demo Agency Two", action: "Submitted builder floor for review" },
    { id: "demo-activity-5", agency_id: "demo-agency-2", actor: "Demo Agency Two", action: "Published residential plot listing" },
  ]);
  console.log("Demo agencies, sample listings, enquiries, and team invitations are ready in Supabase.");
}

setup().catch((error) => {
  console.error(error instanceof Error ? error.message : "Supabase setup failed.");
  process.exitCode = 1;
});
