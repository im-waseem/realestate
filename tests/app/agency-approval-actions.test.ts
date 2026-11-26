import { beforeEach, describe, expect, it, vi } from "vitest";
import { decideAgencyApproval, updateAgencyFeature, verifyAgencyRera } from "@/app/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const requireUserImpl = vi.fn();
vi.mock("@/lib/auth", () => ({ requireUser: (...args: unknown[]) => requireUserImpl(...args) }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockCreateServerClient = vi.mocked(createSupabaseServerClient);

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("agency approval protections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserImpl.mockResolvedValue({
      id: "agency-admin-1",
      name: "Agency Admin",
      email: "admin@example.com",
      role: "agency_admin",
      agency_id: "agency-1",
      agency_status: "approved",
    });
  });

  it("prevents an agency user from changing its status", async () => {
    await expect(decideAgencyApproval(form({
      agency_id: "agency-1", decision: "suspend", reason: "",
    }))).rejects.toThrow("REDIRECT:/dashboard/admin/agencies?");
    expect(mockCreateServerClient).not.toHaveBeenCalled();
  });

  it("prevents an agency user from changing its feature flags", async () => {
    await expect(updateAgencyFeature(form({
      agency_id: "agency-1", feature: "tools", enabled: "false",
    }))).rejects.toThrow("REDIRECT:/dashboard?");
    expect(mockCreateServerClient).not.toHaveBeenCalled();
  });

  it("prevents an agency user from marking its RERA details verified", async () => {
    await expect(verifyAgencyRera(form({ agency_id: "agency-1" }))).rejects.toThrow("REDIRECT:/dashboard/admin/agencies?");
    expect(mockCreateServerClient).not.toHaveBeenCalled();
  });
});
