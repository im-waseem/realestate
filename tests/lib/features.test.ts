import { describe, expect, it } from "vitest";
import { hasAgencyFeature, normalizeAgencyFeatures } from "@/lib/features";

describe("agency feature flags", () => {
  it("defaults missing, malformed, and non-true values to disabled", () => {
    expect(normalizeAgencyFeatures(null)).toEqual({ home_loans: false, tools: false });
    expect(normalizeAgencyFeatures({ home_loans: true, tools: "true" })).toEqual({
      home_loans: true,
      tools: false,
    });
  });

  it("allows platform admins regardless of the agency flags", () => {
    expect(hasAgencyFeature({
      role: "super_admin",
      features: { home_loans: false, tools: false },
    }, "tools")).toBe(true);
  });

  it("checks agency feature state for agency users", () => {
    expect(hasAgencyFeature({
      role: "agency_admin",
      features: { home_loans: true, tools: false },
    }, "home_loans")).toBe(true);
    expect(hasAgencyFeature({
      role: "agent",
      features: { home_loans: true, tools: false },
    }, "tools")).toBe(false);
  });
});
