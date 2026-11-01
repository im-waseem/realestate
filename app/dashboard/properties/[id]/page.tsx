import { notFound } from "next/navigation";
import { PhotoInput } from "@/components/photo-input";
import { saveProperty } from "@/app/actions";
import { PlatformHeader, Notice } from "@/components/platform";
import { requireUser } from "@/lib/auth";
import type { Agency, Property } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseData } from "@/lib/supabase/results";

const propertyTypes = [
  "Apartment",
  "Villa",
  "Independent house",
  "Builder floor",
  "Penthouse",
  "Studio",
  "Plot",
  "Farm house",
  "Office",
  "Shop",
  "Showroom",
  "Warehouse",
];

const furnishingOptions = [
  ["unfurnished", "Unfurnished"],
  ["semi_furnished", "Semi-furnished"],
  ["furnished", "Furnished"],
  ["not_applicable", "Not applicable"],
];

export default async function Editor({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; agency_id?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const isSuperAdmin = user.role === "super_admin";
  const supabase = await createSupabaseServerClient();
  let property: Property | undefined;
  if (id !== "new") {
    const result = await supabase.from("properties").select("*").eq("id", id).maybeSingle();
    property = supabaseData(result.data, result.error, "Unable to load property") ?? undefined;
  }

  if (id !== "new" && (!property || (!isSuperAdmin && property.agency_id !== user.agency_id))) {
    notFound();
  }
  let agencies: Pick<Agency, "id" | "name" | "status">[] = [];
  if (isSuperAdmin) {
    const result = await supabase.from("agencies").select("id,name,status").order("name");
    agencies = supabaseData(result.data, result.error, "Unable to load agencies");
  }
  const selectedAgencyId = property?.agency_id || (isSuperAdmin ? query.agency_id : user.agency_id) || "";

  const textField = (key: keyof Property, label: string, maxLength: number, required = true) => (
    <label>
      {label}
      <input
        name={key}
        defaultValue={String(property?.[key] ?? "")}
        required={required}
        maxLength={maxLength}
      />
    </label>
  );

  const numberField = (
    key: keyof Property,
    label: string,
    min: number,
    max: number,
    required = true,
    step = "1",
  ) => (
    <label>
      {label}
      <input
        name={key}
        type="number"
        step={step}
        min={min}
        max={max}
        defaultValue={property?.[key] == null ? "" : Number(property[key])}
        required={required}
      />
    </label>
  );

  return (
    <>
      <PlatformHeader />
      <main className="workspace editor">
        <p className="kicker">PROPERTY MANAGEMENT</p>
        <h1>{property ? "Edit" : "Add a"} <em>property.</em></h1>
        <p className="muted">{isSuperAdmin ? "Main admin access: manage listings for any agency." : "Sale, rent, and lease listings stay in your agency workspace."}</p>
        <Notice message={query.message} />

        <form action={saveProperty} className="panel stack">
          <input type="hidden" name="id" value={property?.id || ""} />
          {isSuperAdmin && property && <input type="hidden" name="agency_id" value={property.agency_id} />}
          {isSuperAdmin && !property && (
            <label>
              Agency
              <select name="agency_id" defaultValue={selectedAgencyId} required>
                <option value="" disabled>Select agency</option>
                {agencies.map((agency) => <option key={agency.id} value={agency.id}>{agency.name} · {agency.status}</option>)}
              </select>
            </label>
          )}

          {textField("title", "Listing title", 150)}

          <fieldset className="property-form-group">
            <legend>Listing and property type</legend>
            <div className="form-grid">
              <label>
                Listing purpose
                <select name="intent" defaultValue={property?.intent || "sale"} required>
                  <option value="sale">Buy / sell</option>
                  <option value="rent">Rent</option>
                  <option value="lease">Lease</option>
                </select>
              </label>
              <label>
                Property type
                <select name="type" defaultValue={property?.type || "Apartment"} required>
                  {propertyTypes.map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
              {numberField("price", "Price in ₹ (monthly for rent)", 1, 1e12, true, "any")}
              {numberField("area", "Built-up / plot area (sq ft)", 1, 1e8, true, "any")}
            </div>
          </fieldset>

          <fieldset className="property-form-group">
            <legend>Rooms and floor</legend>
            <div className="form-grid">
              {numberField("beds", "Bedrooms", 0, 50)}
              {numberField("baths", "Bathrooms", 0, 50)}
              {numberField("floor_number", "Floor number (ground floor = 0)", 0, 200)}
              {numberField("total_floors", "Total floors in building", 1, 200, false)}
              <label>
                Furnishing
                <select name="furnishing" defaultValue={property?.furnishing || "unfurnished"} required>
                  {furnishingOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              {numberField("age_years", "Property age (years)", 0, 200, false)}
            </div>
            <small>For a ground-floor home enter floor 0. Leave total floors blank if this does not apply.</small>
          </fieldset>

          <fieldset className="property-form-group">
            <legend>Parking and location</legend>
            <div className="form-grid">
              {numberField("car_parking", "Car parking spaces", 0, 100)}
              {numberField("two_wheeler_parking", "Two-wheeler parking spaces", 0, 100)}
              {textField("city", "City", 100)}
              {textField("locality", "Locality", 150)}
            </div>
          </fieldset>

          {textField("address", "Exact property address (private)", 500)}
          <div className="form-grid">
            {numberField("lat", "Latitude", -90, 90, true, "any")}
            {numberField("lng", "Longitude", -180, 180, true, "any")}
          </div>
          <small>Exact address and coordinates are available only to authorized workspace users.</small>

          <label>
            Property description
            <textarea name="description" required maxLength={5000} defaultValue={property?.description} />
          </label>
          {textField("amenities", "Amenities (comma separated)", 1000)}

          <PhotoInput initial={property ? (JSON.parse(property.images) as string[]).join("\n") : ""} agencyId={isSuperAdmin ? selectedAgencyId : undefined} />
          <button className="btn">Save property →</button>
        </form>
      </main>
    </>
  );
}
