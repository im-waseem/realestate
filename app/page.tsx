import type { Metadata } from "next";
import HomeClient, { type Home } from "./HomeClient";
import { currentUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseData } from "@/lib/supabase/results";
import type { Property } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Waseem Realty | A place for your next chapter" } };

function coverImage(value: string): string | null {
  try {
    const images: unknown = JSON.parse(value);
    if (!Array.isArray(images)) return null;
    return images.find((image): image is string => typeof image === "string" && (/^https:\/\//.test(image) || /^\/media\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(image) || /^\/images\/(interior|architecture)\.jpg$/.test(image))) ?? null;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const user = await currentUser();
  const agencyId = user?.agency_status === "active" && (user.role === "agency_admin" || user.role === "agent")
    ? user.agency_id
    : null;
  const supabase = await createSupabaseServerClient();
  let agency: { name: string; phone: string; address: string } | undefined;
  let properties: Property[] = [];
  if (agencyId) {
    const [agencyResult, propertyResult] = await Promise.all([
      supabase.from("agencies").select("name,phone,address").eq("id", agencyId).maybeSingle(),
      supabase.from("properties").select("*").eq("agency_id", agencyId).order("created_at", { ascending: false }).limit(30),
    ]);
    agency = supabaseData(agencyResult.data, agencyResult.error, "Unable to load agency profile") ?? undefined;
    properties = supabaseData(propertyResult.data, propertyResult.error, "Unable to load agency properties");
  }
  const homes: Home[] = properties.map((property) => ({
    id: property.id,
    name: property.title,
    location: `${property.locality}, ${property.city}`,
    price: property.price,
    beds: property.beds,
    baths: property.baths,
    area: property.area,
    image: coverImage(property.images),
    type: property.type,
    intent: property.intent,
    status: property.status,
    workspaceHref: `/dashboard/properties/${property.id}`,
    floorNumber: property.floor_number,
    totalFloors: property.total_floors,
    carParking: property.car_parking,
    twoWheelerParking: property.two_wheeler_parking,
  }));
  return (
    <HomeClient
      homes={homes}
      year={new Date().getFullYear()}
      agencyName={agency?.name}
      agencyPhone={agency?.phone}
      agencyAddress={agency?.address}
      canEditAgency={user?.role === "agency_admin"}
    />
  );
}
