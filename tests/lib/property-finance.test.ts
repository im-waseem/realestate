import { describe, expect, it } from "vitest";
import { calculateEmi, convertArea, principalForEmi } from "@/lib/property-finance";
import { INDIA_STAMP_DUTY_RATES } from "@/components/tools/india-stamp-duty-rates";

describe("property finance calculations", () => {
  it("calculates a standard EMI and handles a zero-interest loan", () => {
    expect(calculateEmi(1_000_000, 12, 120)).toBeCloseTo(14_347.09, 2);
    expect(calculateEmi(120_000, 0, 12)).toBe(10_000);
  });

  it("inverts EMI to an equivalent principal, including at zero interest", () => {
    expect(principalForEmi(calculateEmi(2_500_000, 8.5, 240), 8.5, 240)).toBeCloseTo(2_500_000, 4);
    expect(principalForEmi(10_000, 0, 12)).toBe(120_000);
  });

  it("converts the specified Indian land-area units consistently", () => {
    expect(convertArea(1, "acre", "gunta")).toBe(40);
    expect(convertArea(1, "acre", "cent")).toBe(100);
    expect(convertArea(100, "sqm", "sqft")).toBeCloseTo(1_076.391, 2);
  });

  it("includes each Indian state and union territory in the editable rate config", () => {
    expect(INDIA_STAMP_DUTY_RATES).toHaveLength(36);
    expect(new Set(INDIA_STAMP_DUTY_RATES.map((rate) => rate.state)).size).toBe(36);
    expect(INDIA_STAMP_DUTY_RATES.every((rate) => rate.stampDutyPercent >= 0 && rate.registrationPercent >= 0)).toBe(true);
  });
});
