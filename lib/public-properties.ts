import { createSupabaseServerClient } from "./supabase/server";
import { supabaseData } from "./supabase/results";
import type { Database } from "./supabase/database.types";

export async function publicProperties(args: Database["public"]["Functions"]["realty_public_properties"]["Args"] = {}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("realty_public_properties", args);
  return supabaseData(data, error, "Unable to load catalogue. Apply the marketplace SQL migration");
}
export function propertyImages(value: string): string[] {
  try {
    const images: unknown = JSON.parse(value);
    if (!Array.isArray(images)) return [];
    return images.filter((image): image is string => typeof image === "string" && (/^https:\/\//.test(image) || /^\/media\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(image) || /^\/images\/(interior|architecture)\.jpg$/.test(image))).slice(0,12);
  } catch { return []; }
}
