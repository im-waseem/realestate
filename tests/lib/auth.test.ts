import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { currentUser, requireAgencyFeature, requireUser } from "@/lib/auth";

const redirectCalls: string[] = [];
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirect: vi.fn((path: string) => {
    redirectCalls.push(path);
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { clearClient } from "../helpers/supabase";

const mockCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);

function signedIn(userId: string, email: string) {
  return { data: { user: { id: userId, email } }, error: null };
}

beforeEach(() => {
  redirectCalls.length = 0;
  mockCreateSupabaseServerClient.mockReset();
  clearClient();
});

afterEach(() => {
  clearClient();
});

function clientWithProfile(
  profile: Record<string, unknown> | null,
  agency: Record<string, unknown> | null,
  profileError: { message: string } | null = null,
) {
  mockCreateSupabaseServerClient.mockReturnValue({
    auth: { getUser: vi.fn().mockResolvedValue(profile ? signedIn(String(profile.id), String(profile.email)) : { data: { user: null }, error: null }) },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: profileError }),
        };
      }
      if (table === "agencies") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: agency, error: null }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
    }),
  } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
}

describe("currentUser", () => {
  it("explains how to repair a missing active-profile column", async () => {
    clientWithProfile(
      { id: "u-1", name: "Agent", email: "a@e.com", role: "agent", agency_id: "ag-1", is_active: true },
      null,
      { message: "column profiles.is_active does not exist" },
    );
    await expect(currentUser()).rejects.toThrow("Apply sql/migrations/20261125_agency_feature_flags.sql");
  });

  it("returns the user when session, active profile and approved agency exist", async () => {
    clientWithProfile(
      { id: "u-1", name: "Admin", email: "a@e.com", role: "agency_admin", agency_id: "ag-1", is_active: true },
      { id: "ag-1", status: "approved", features: { home_loans: true, tools: false } },
    );
    const user = await currentUser();
    expect(user).toMatchObject({
      id: "u-1",
      role: "agency_admin",
      agency_id: "ag-1",
      agency_status: "approved",
      features: { home_loans: true, tools: false },
    });
  });

  it("returns undefined when there is no session", async () => {
    clientWithProfile(null, null);
    expect(await currentUser()).toBeUndefined();
  });

  it("returns undefined when the profile is inactive", async () => {
    clientWithProfile(
      { id: "u-1", name: "Admin", email: "a@e.com", role: "agency_admin", agency_id: "ag-1", is_active: false },
      { id: "ag-1", status: "active" },
    );
    expect(await currentUser()).toBeUndefined();
  });

  it("returns the user with suspended agency status for the access-status page", async () => {
    clientWithProfile(
      { id: "u-1", name: "Agent", email: "a@e.com", role: "agent", agency_id: "ag-1", is_active: true },
      { id: "ag-1", status: "suspended" },
    );
    expect((await currentUser())?.agency_status).toBe("suspended");
  });
});

describe("requireAgencyFeature", () => {
  it("hides disabled features from agency users", async () => {
    clientWithProfile(
      { id: "u-1", name: "Agent", email: "a@e.com", role: "agent", agency_id: "ag-1", is_active: true },
      { id: "ag-1", status: "approved", features: { home_loans: false, tools: false } },
    );
    await expect(requireAgencyFeature("tools")).rejects.toThrow("NOT_FOUND");
  });

  it("does not gate platform admins", async () => {
    clientWithProfile(
      { id: "u-1", name: "Admin", email: "a@e.com", role: "super_admin", agency_id: null, is_active: true },
      null,
    );
    await expect(requireAgencyFeature("tools")).resolves.toMatchObject({ role: "super_admin" });
  });
});

describe("requireUser", () => {
  it("redirects to /no-access when there is no user", async () => {
    clientWithProfile(null, null);
    await expect(requireUser()).rejects.toThrow("REDIRECT:/no-access");
    expect(redirectCalls).toContain("/no-access");
  });

  it("keeps non-approved agency users on the dashboard access-status view", async () => {
    clientWithProfile(
      { id: "u-1", name: "Agent", email: "a@e.com", role: "agent", agency_id: "ag-1", is_active: true },
      { id: "ag-1", status: "suspended" },
    );
    await expect(requireUser()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("returns the user for a super_admin without requiring an active agency", async () => {
    clientWithProfile(
      { id: "u-1", name: "Admin", email: "a@e.com", role: "super_admin", agency_id: null, is_active: true },
      null,
    );
    const user = await requireUser();
    expect(user).toMatchObject({ id: "u-1", role: "super_admin" });
  });
});
