import { createSupabaseServerClient } from "./supabase/server";
import { supabaseData } from "./supabase/results";
import type { Database } from "./supabase/database.types";
export { propertyImages } from "./property-images";

export async function publicProperties(args: Database["public"]["Functions"]["realty_public_properties"]["Args"] = {}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("realty_public_properties", args);
  return supabaseData(data, error, "Unable to load catalogue. Apply the marketplace SQL migration");
}
