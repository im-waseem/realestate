import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { saveProperty, deleteProperty, createLead } from "@/app/actions";

// --- Mock Next.js -----------------------------------------------------------
const redirectCalls: string[] = [];
const revalidateCalls: string[] = [];
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    redirectCalls.push(path);
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn((path: string) => {
    revalidateCalls.push(path);
  }),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(() => ({ get: () => undefined })),
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

// --- Mock lib/auth (requireUser) -------------------------------------------
vi.mock("@/lib/auth", () => ({
  requireUser: (...args: unknown[]) => requireUserImpl(...args),
}));
const requireUserImpl = vi.fn();

// --- Mock Supabase clients --------------------------------------------------
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createMockClient, clearClient, type TableRow } from "../helpers/supabase";

const mockCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);
const mockCreateSupabaseAdminClient = vi.mocked(createSupabaseAdminClient);

const agencyId = "ag-1";
const user = { id: "u-1", name: "Admin", email: "a@e.com", role: "agency_admin" as const, agency_id: agencyId };

beforeEach(() => {
  redirectCalls.length = 0;
  revalidateCalls.length = 0;
  vi.resetAllMocks();
  clearClient();
  requireUserImpl.mockResolvedValue(user);
});

afterEach(() => {
  clearClient();
});

function serverClientWithTables(tables: Record<string, TableRow[]>) {
  mockCreateSupabaseServerClient.mockResolvedValue(createMockClient({ tables }));
}

function adminClientWithRpc(rpc: Record<string, unknown>) {
  mockCreateSupabaseAdminClient.mockResolvedValue(createMockClient({ rpc }));
}

const validPropertyForm = () => {
  const form = new FormData();
  form.set("title", "3BHK Apartment");
  form.set("description", "A nice home");
  form.set("price", "2500000");
  form.set("type", "Apartment");
  form.set("intent", "sale");
  form.set("beds", "3");
  form.set("baths", "2");
  form.set("area", "1200");
  form.set("locality", "Indiranagar");
  form.set("city", "Bengaluru");
  form.set("address", "123 Main Street");
  form.set("owner_name", "Ramesh");
  form.set("owner_phone", "+91 9876543210");
  form.set("owner_email", "ramesh@example.com");
  form.set("lat", "12.97");
  form.set("lng", "77.59");
  form.set("amenities", "Lift, Parking");
  form.set("images", "/media/00000000-0000-0000-0000-000000000001.jpg");
  form.set("status", "draft");
  form.set("featured", "off");
  form.set("floor_number", "0");
  form.set("car_parking", "1");
  form.set("two_wheeler_parking", "1");
  form.set("furnishing", "unfurnished");
  form.set("age_years", "2");
  form.set("uploading", "no");
  return form;
};
describe("saveProperty", () => {
  it("creates a property for the user's approved agency", async () => {
    serverClientWithTables({ agencies: [{ id: agencyId, status: "approved" }], properties: [] });
    adminClientWithRpc({ realty_owner_phone_registered_elsewhere: false });
    const form = validPropertyForm();
    const result = await saveProperty(form);
    expect(result.ok).toBe(true);
    expect(result.message).toBe("Property saved.");
    expect(mockCreateSupabaseServerClient).toHaveBeenCalled();
    expect(revalidateCalls).toContain("/dashboard/properties");
  });

  it("rejects when the agency is not approved", async () => {
    serverClientWithTables({ agencies: [{ id: agencyId, status: "pending" }] });
    const form = validPropertyForm();
    const result = await saveProperty(form);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("not approved");
  });

  it("rejects invalid input (missing title)", async () => {
    serverClientWithTables({ agencies: [{ id: agencyId, status: "approved" }] });
    const form = new FormData();
    form.set("uploading", "no");
    const result = await saveProperty(form);
    expect(result.ok).toBe(false);
  });

  it("updates an existing property owned by the user's agency", async () => {
    serverClientWithTables({
      agencies: [{ id: agencyId, status: "approved" }],
      properties: [{ id: "p-1", agency_id: agencyId, title: "Old" }],
    });
    adminClientWithRpc({ realty_owner_phone_registered_elsewhere: false });
    const form = validPropertyForm();
    form.set("id", "p-1");
    const result = await saveProperty(form);
    expect(result.ok).toBe(true);
  });

  it("rejects updating a property belonging to another agency", async () => {
    serverClientWithTables({
      agencies: [{ id: agencyId, status: "approved" }],
      properties: [{ id: "p-1", agency_id: "other-agency", title: "Other" }],
    });
    const form = validPropertyForm();
    form.set("id", "p-1");
    const result = await saveProperty(form);
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Property not found.");
  });
});

describe("deleteProperty", () => {
  it("deletes a property owned by the user's agency", async () => {
    serverClientWithTables({
      properties: [{ id: "p-1", agency_id: agencyId, title: "Home" }],
      leads: [],
    });
    const form = new FormData();
    form.set("id", "p-1");
    const result = await deleteProperty(form);
    expect(result.ok).toBe(true);
    expect(revalidateCalls).toContain("/dashboard/properties");
  });

  it("rejects deleting a property with linked leads (non-super admin)", async () => {
    serverClientWithTables({
      properties: [{ id: "p-1", agency_id: agencyId, title: "Home" }],
      leads: [{ id: "l-1", property_id: "p-1" }],
    });
    const form = new FormData();
    form.set("id", "p-1");
    const result = await deleteProperty(form);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("enquiries");
  });

  it("rejects deleting a property owned by another agency", async () => {
    serverClientWithTables({
      properties: [{ id: "p-1", agency_id: "other-agency", title: "Home" }],
      leads: [],
    });
    const form = new FormData();
    form.set("id", "p-1");
    const result = await deleteProperty(form);
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Property not found.");
  });
});

describe("createLead (enquiry form)", () => {
  it("creates a lead routed to the user's approved agency", async () => {
    serverClientWithTables({
      agencies: [{ id: agencyId, status: "approved" }],
      leads: [],
    });
    const form = new FormData();
    form.set("name", "Visitor");
    form.set("phone", "+91 9876543210");
    form.set("email", "visitor@example.com");
    form.set("source", "walk_in");
    form.set("intent", "buy");
    form.set("requirements", "Looking for a 2BHK in Indiranagar");
    await createLead(form);
    expect(redirectCalls).toContain("/dashboard?message=Customer+requirement+saved#leads");
    expect(revalidateCalls).toContain("/dashboard");
  });

  it("rejects an invalid phone number", async () => {
    serverClientWithTables({ agencies: [{ id: agencyId, status: "approved" }] });
    const form = new FormData();
    form.set("name", "Visitor");
    form.set("phone", "not-a-phone");
    form.set("source", "walk_in");
    form.set("intent", "buy");
    form.set("requirements", "Looking for a home");
    await expect(createLead(form)).rejects.toThrow(/valid phone/);
  });

  it("rejects when the agency is not approved", async () => {
    serverClientWithTables({ agencies: [{ id: agencyId, status: "suspended" }] });
    const form = new FormData();
    form.set("name", "Visitor");
    form.set("phone", "+91 9876543210");
    form.set("source", "walk_in");
    form.set("intent", "buy");
    form.set("requirements", "Looking for a home");
    await expect(createLead(form)).rejects.toThrow(/approved agency/);
  });
});

