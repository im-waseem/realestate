export const AREA_UNITS = [
  { value: "sqft", label: "Square feet (sq ft)", sqft: 1 },
  { value: "sqm", label: "Square metres (sq m)", sqft: 10.7639104167 },
  { value: "sqyd", label: "Square yards (sq yd)", sqft: 9 },
  { value: "acre", label: "Acres", sqft: 43560 },
  { value: "cent", label: "Cents", sqft: 435.6 },
  { value: "gunta", label: "Guntas", sqft: 1089 },
] as const;

export type AreaUnit = (typeof AREA_UNITS)[number]["value"];

export function calculateEmi(principal: number, annualRatePercent: number, months: number) {
  if (!Number.isFinite(principal) || principal <= 0 || !Number.isInteger(months) || months <= 0) return 0;
  const monthlyRate = annualRatePercent / 1200;
  if (monthlyRate === 0) return principal / months;
  const growth = (1 + monthlyRate) ** months;
  return principal * monthlyRate * growth / (growth - 1);
}

export function principalForEmi(emi: number, annualRatePercent: number, months: number) {
  if (!Number.isFinite(emi) || emi <= 0 || !Number.isInteger(months) || months <= 0) return 0;
  const monthlyRate = annualRatePercent / 1200;
  if (monthlyRate === 0) return emi * months;
  const growth = (1 + monthlyRate) ** months;
  return emi * (growth - 1) / (monthlyRate * growth);
}

export function convertArea(value: number, from: AreaUnit, to: AreaUnit) {
  const source = AREA_UNITS.find((unit) => unit.value === from);
  const target = AREA_UNITS.find((unit) => unit.value === to);
  if (!Number.isFinite(value) || value < 0 || !source || !target) return 0;
  return value * source.sqft / target.sqft;
}
