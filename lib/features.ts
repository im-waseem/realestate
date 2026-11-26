export const AGENCY_FEATURES = ["home_loans", "loans", "tools"] as const;
export type AgencyFeature = (typeof AGENCY_FEATURES)[number];
export type AgencyFeatures = Record<AgencyFeature, boolean>;

const DEFAULT_FEATURES: AgencyFeatures = {
  home_loans: false,
  loans: false,
  tools: false,
};

export function normalizeAgencyFeatures(value: unknown): AgencyFeatures {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_FEATURES };
  }
  const features = value as Partial<Record<AgencyFeature, unknown>>;
  return {
    home_loans: features.home_loans === true,
    loans: features.loans === true,
    tools: features.tools === true,
  };
}

export function hasAgencyFeature(
  user: { role: "super_admin" | "agency_admin" | "agent"; features?: AgencyFeatures },
  feature: AgencyFeature,
) {
  return user.role === "super_admin" || user.features?.[feature] === true;
}
