"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { saveProperty } from "@/app/actions";
import { PhotoInput } from "@/components/photo-input";
import { SubmitButton } from "@/components/dashboard/submit-button";
import { useToast } from "@/components/dashboard/toaster";
import { PROPERTY_TYPES, propertySchema, propertyStatusFromDatabase, type PropertyFormInput, type PropertyFormValues } from "@/lib/property-schema";
import type { Agency, Property } from "@/lib/db";

const furnishingOptions = [
  ["unfurnished", "Unfurnished"],
  ["semi_furnished", "Semi-furnished"],
  ["furnished", "Furnished"],
  ["not_applicable", "Not applicable"],
] as const;

function FieldError({ children }: { children?: string }) {
  return children ? <small className="field-error" role="alert">{children}</small> : null;
}

export function PropertyEditorForm({
  property,
  agencies,
  isAdmin,
  agencyId,
  returnPath,
}: {
  property?: Property;
  agencies: Pick<Agency, "id" | "name" | "status">[];
  isAdmin: boolean;
  agencyId: string;
  returnPath: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [selectedAgencyId, setSelectedAgencyId] = useState(agencyId);
  const [uploading, setUploading] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PropertyFormInput, unknown, PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      title: property?.title || "",
      description: property?.description || "",
      price: property?.price ?? 0,
      type: (property?.type as PropertyFormInput["type"]) || "Apartment",
      intent: (property?.intent as PropertyFormInput["intent"]) || "sale",
      beds: property?.beds ?? 0,
      baths: property?.baths ?? 0,
      area: property?.area ?? 0,
      locality: property?.locality || "",
      city: property?.city || "",
      address: property?.address || "",
      owner_name: property?.owner_name || "",
      owner_phone: property?.owner_phone || "",
      owner_email: property?.owner_email || "",
      lat: property?.lat ?? 0,
      lng: property?.lng ?? 0,
      amenities: property?.amenities || "",
      images: property?.images ? (JSON.parse(property.images) as string[]).join("\n") : "",
      status: propertyStatusFromDatabase(property?.status || "pending"),
      featured: property?.featured ?? false,
      floor_number: property?.floor_number ?? 0,
      total_floors: property?.total_floors ?? null,
      car_parking: property?.car_parking ?? 0,
      two_wheeler_parking: property?.two_wheeler_parking ?? 0,
      furnishing: (property?.furnishing as PropertyFormInput["furnishing"]) || "unfurnished",
      age_years: property?.age_years ?? null,
    },
  });

  async function submit(values: PropertyFormValues) {
    if (uploading) {
      toast("Wait for photo uploads to finish before saving.", "error");
      return;
    }
    if (isAdmin && !selectedAgencyId) {
      toast("Select an agency for this property.", "error");
      return;
    }
    const form = new FormData();
    for (const [key, value] of Object.entries(values)) form.set(key, value === null ? "" : String(value));
    form.set("id", property?.id || "");
    form.set("featured", values.featured ? "on" : "");
    form.set("agency_id", selectedAgencyId);
    form.set("uploading", uploading ? "yes" : "no");

    const result = await saveProperty(form);
    toast(result.message, result.ok ? "success" : "error");
    if (result.ok) {
      router.push(returnPath);
      router.refresh();
    }
  }

  return (
    <form className="panel stack property-editor-form" onSubmit={handleSubmit(submit)} noValidate>
      {isAdmin && !property ? (
        <label>Agency
          <select value={selectedAgencyId} onChange={(event) => setSelectedAgencyId(event.target.value)} required>
            <option value="">Select agency</option>
            {agencies.map((agency) => <option key={agency.id} value={agency.id}>{agency.name} · {agency.status}</option>)}
          </select>
        </label>
      ) : <input type="hidden" name="agency_id" value={selectedAgencyId} />}

      <label>Property title<input {...register("title")} maxLength={150} /> <FieldError>{errors.title?.message}</FieldError></label>

      <fieldset className="property-form-group">
        <legend>Listing details</legend>
        <div className="form-grid">
          <label>Status<select {...register("status")}><option value="draft">Draft</option><option value="active">Active</option><option value="sold">Sold</option><option value="rented">Rented</option></select><FieldError>{errors.status?.message}</FieldError></label>
          <label>Property type<select {...register("type")}>{PROPERTY_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select><FieldError>{errors.type?.message}</FieldError></label>
          <label>Looking to<select {...register("intent")}><option value="sale">Buy / sell</option><option value="rent">Rent</option><option value="lease">Lease</option></select></label>
          <label>Price (INR){" "}<input {...register("price")} type="number" min="1" max="1000000000000" step="any" /><FieldError>{errors.price?.message}</FieldError></label>
          <label>BHK<input {...register("beds")} type="number" min="0" max="50" /><FieldError>{errors.beds?.message}</FieldError></label>
          <label>Bathrooms<input {...register("baths")} type="number" min="0" max="50" /><FieldError>{errors.baths?.message}</FieldError></label>
          <label>Area (sqft)<input {...register("area")} type="number" min="1" max="100000000" step="any" /><FieldError>{errors.area?.message}</FieldError></label>
          <label>Featured listing<span className="property-featured-control"><input {...register("featured")} type="checkbox" /> Feature this property</span></label>
        </div>
      </fieldset>

      <fieldset className="property-form-group">
        <legend>Location</legend>
        <div className="form-grid">
          <label>Locality<input {...register("locality")} maxLength={150} /><FieldError>{errors.locality?.message}</FieldError></label>
          <label>City<input {...register("city")} maxLength={100} /><FieldError>{errors.city?.message}</FieldError></label>
          <label>Exact address (private)<input {...register("address")} maxLength={500} /><FieldError>{errors.address?.message}</FieldError></label>
          <label>Latitude<input {...register("lat")} type="number" min="-90" max="90" step="any" /></label>
          <label>Longitude<input {...register("lng")} type="number" min="-180" max="180" step="any" /></label>
        </div>
      </fieldset>

      <fieldset className="property-form-group">
        <legend>Additional property details</legend>
        <div className="form-grid">
          <label>Floor number<input {...register("floor_number")} type="number" min="0" max="200" /></label>
          <label>Total floors<input {...register("total_floors")} type="number" min="1" max="200" /></label>
          <label>Car parking spaces<input {...register("car_parking")} type="number" min="0" max="100" /></label>
          <label>Two-wheeler parking spaces<input {...register("two_wheeler_parking")} type="number" min="0" max="100" /></label>
          <label>Furnishing<select {...register("furnishing")}>{furnishingOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Property age (years)<input {...register("age_years")} type="number" min="0" max="200" /></label>
        </div>
      </fieldset>

      <label>Description<textarea {...register("description")} maxLength={5000} rows={5} /><FieldError>{errors.description?.message}</FieldError></label>
      <label>Amenities (comma separated)<input {...register("amenities")} maxLength={1000} /><FieldError>{errors.amenities?.message}</FieldError></label>
      <fieldset className="property-form-group owner-contact-group">
        <legend>Property owner contact · private</legend>
        <div className="form-grid">
          <label>Owner name<input {...register("owner_name")} maxLength={100} /></label>
          <label>Owner mobile<input {...register("owner_phone")} maxLength={25} /><FieldError>{errors.owner_phone?.message}</FieldError></label>
          <label>Owner email<input {...register("owner_email")} type="email" maxLength={254} /><FieldError>{errors.owner_email?.message}</FieldError></label>
        </div>
      </fieldset>
      <Controller name="images" control={control} render={({ field }) => (
        <PhotoInput initial={field.value} value={field.value} onChange={field.onChange} onUploading={setUploading} agencyId={isAdmin ? selectedAgencyId : undefined} />
      )} />
      <FieldError>{errors.images?.message}</FieldError>
      {errors.total_floors?.message && <FieldError>{errors.total_floors.message}</FieldError>}
      <SubmitButton className="btn" pendingLabel="Saving property…" disabled={uploading || isSubmitting}>
        {property ? "Save property" : "Create property"}
      </SubmitButton>
    </form>
  );
}
