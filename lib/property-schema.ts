import { z } from "zod";

export const PROPERTY_TYPES = [
  "Apartment", "Villa", "Independent house", "Builder floor", "Penthouse", "Studio", "Plot",
  "Farm house", "Office", "Shop", "Showroom", "Warehouse",
] as const;

const optionalNumber = (min: number, max: number, integer = false) =>
  z.preprocess((value) => value === "" || value === null || value === undefined ? null : value,
    z.coerce.number().min(min).max(max).refine((value) => !integer || Number.isInteger(value)).nullable());

const imageUrlIsAllowed = (value: string) => {
  if (/^\/media\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(value) || /^\/images\/(interior|architecture)\.jpg$/.test(value)) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
};

export const propertySchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters.").max(150),
  description: z.string().trim().min(1, "Add a property description.").max(5000),
  price: z.coerce.number().min(1).max(1e12),
  type: z.enum(PROPERTY_TYPES),
  intent: z.enum(["sale", "rent", "lease"]),
  beds: z.coerce.number().int().min(0).max(50),
  baths: z.coerce.number().int().min(0).max(50),
  area: z.coerce.number().min(1).max(1e8),
  locality: z.string().trim().min(1).max(150),
  city: z.string().trim().min(1).max(100),
  address: z.string().trim().min(1).max(500),
  owner_name: z.string().trim().max(100),
  owner_phone: z.string().trim().max(25).refine((value) => !value || /^[+\d ()-]{7,25}$/.test(value), "Enter a valid owner phone number."),
  owner_email: z.string().trim().max(254).refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "Enter a valid owner email address."),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  amenities: z.string().max(1000),
  images: z.string().max(6000)
    .refine((value) => value.split(/\r?\n/).filter(Boolean).length <= 12, "Use up to 12 images.")
    .refine((value) => value.split(/\r?\n/).filter(Boolean).every(imageUrlIsAllowed), "Images must be uploaded photos or HTTPS URLs."),
  status: z.enum(["draft", "active", "sold", "rented"]),
  featured: z.preprocess((value) => value === true || value === "on", z.boolean()),
  floor_number: z.coerce.number().int().min(0).max(200),
  total_floors: optionalNumber(1, 200, true),
  car_parking: z.coerce.number().int().min(0).max(100),
  two_wheeler_parking: z.coerce.number().int().min(0).max(100),
  furnishing: z.enum(["furnished", "semi_furnished", "unfurnished", "not_applicable"]),
  age_years: optionalNumber(0, 200, true),
}).refine((value) => value.total_floors === null || value.floor_number <= value.total_floors, {
  path: ["total_floors"],
  message: "Total floors must be at least the selected floor.",
});

export type PropertyFormInput = z.input<typeof propertySchema>;
export type PropertyFormValues = z.output<typeof propertySchema>;

export function propertyStatusFromDatabase(status: string): PropertyFormValues["status"] {
  if (status === "published") return "active";
  if (status === "sold" || status === "rented") return status;
  return "draft";
}

export function propertyStatusToDatabase(status: PropertyFormValues["status"]) {
  if (status === "active") return "published";
  if (status === "draft") return "pending";
  return status;
}
