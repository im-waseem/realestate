import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import ExcelJS from "exceljs";
import { currentUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const propertyTypes = ["Apartment", "Villa", "Independent house", "Builder floor", "Penthouse", "Studio", "Plot", "Farm house", "Office", "Shop", "Showroom", "Warehouse"];
const sources = ["walk_in", "phone", "website", "referral", "other"];
const leadStatuses = ["new", "contacted", "visit scheduled", "negotiating", "closed", "lost"];

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function cellText(cell: ExcelJS.Cell) {
  const raw = cell.value as unknown;
  if (raw === null || raw === undefined) return "";
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === "object") {
    if ("formula" in raw || "sharedFormula" in raw) throw new Error("Formula cells aren’t supported. Paste values into the template first.");
    const value = raw as Record<string, unknown>;
    if ("text" in value) return String(value.text ?? "").trim();
    if ("result" in value) return String(value.result ?? "").trim();
    return "";
  }
  return String(raw).trim();
}

function parseNumber(value: string, label: string, min: number, max: number, integer = false) {
  const number = Number(value);
  if (!value || !Number.isFinite(number) || number < min || number > max || (integer && !Number.isInteger(number))) {
    throw new Error(`${label} must be ${integer ? "a whole number" : "a number"} between ${min} and ${max}.`);
  }
  return number;
}

function optionalNumber(value: string, label: string, min: number, max: number, integer = false) {
  return value ? parseNumber(value, label, min, max, integer) : null;
}

function validPhone(phone: string) {
  return /^[+\d ()-]{7,25}$/.test(phone);
}

function validEmail(email: string) {
  return !email || (email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

function worksheetRows(worksheet: ExcelJS.Worksheet) {
  const headers = new Map<string, number>();
  worksheet.getRow(1).eachCell({ includeEmpty: false }, (cell, column) => {
    const header = normalizeHeader(cellText(cell));
    if (header) headers.set(header, column);
  });
  const rows: { rowNumber: number; values: (header: string) => string }[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1 || row.actualCellCount === 0) return;
    rows.push({ rowNumber, values: (header) => {
      const column = headers.get(header);
      return column ? cellText(row.getCell(column)) : "";
    } });
  });
  return { headers, rows };
}

function requireColumns(headers: Map<string, number>, required: string[]) {
  const missing = required.filter((header) => !headers.has(header));
  if (missing.length) throw new Error(`Missing columns: ${missing.join(", ")}. Download and use the matching template.`);
}

function propertyRow(values: (header: string) => string, agencyId: string) {
  const title = values("title");
  const intent = values("intent").toLowerCase();
  const type = values("type");
  const city = values("city");
  const locality = values("locality");
  const address = values("address");
  const description = values("description");
  const ownerName = values("owner_name");
  const phone = values("owner_phone");
  const email = values("owner_email").toLowerCase();
  const amenities = values("amenities");
  const floorNumber = optionalNumber(values("floor_number"), "floor_number", 0, 200, true) ?? 0;
  const totalFloors = optionalNumber(values("total_floors"), "total_floors", 1, 200, true);
  if (title.length < 2 || title.length > 150) throw new Error("title must be between 2 and 150 characters.");
  if (!["sale", "rent", "lease"].includes(intent)) throw new Error("intent must be sale, rent, or lease.");
  if (!propertyTypes.includes(type)) throw new Error(`type must match one of: ${propertyTypes.join(", " )}.`);
  if (city.length < 1 || city.length > 100 || locality.length < 1 || locality.length > 150) throw new Error("city or locality is missing or too long.");
  if (address.length < 1 || address.length > 500) throw new Error("address must be between 1 and 500 characters.");
  if (description.length < 1 || description.length > 5000) throw new Error("description is required and must be under 5000 characters.");
  if (ownerName.length > 100 || amenities.length > 1000) throw new Error("owner_name or amenities is too long.");
  if (totalFloors !== null && floorNumber > totalFloors) throw new Error("floor_number cannot be higher than total_floors.");
  if (phone && !validPhone(phone)) throw new Error("owner_phone must be a valid phone number.");
  if (!validEmail(email)) throw new Error("owner_email must be a valid email address.");
  return {
    id: randomUUID(),
    agency_id: agencyId,
    title,
    intent,
    type,
    price: parseNumber(values("price"), "price", 1, 1e12),
    area: parseNumber(values("area"), "area", 1, 1e8),
    beds: optionalNumber(values("beds"), "beds", 0, 50, true) ?? 0,
    baths: optionalNumber(values("baths"), "baths", 0, 50, true) ?? 0,
    locality,
    city,
    address,
    lat: parseNumber(values("lat"), "lat", -90, 90),
    lng: parseNumber(values("lng"), "lng", -180, 180),
    description,
    amenities,
    owner_name: ownerName,
    owner_phone: phone,
    owner_email: email,
    images: "[]",
    status: "pending",
    floor_number: floorNumber,
    total_floors: totalFloors,
    car_parking: optionalNumber(values("car_parking"), "car_parking", 0, 100, true) ?? 0,
    two_wheeler_parking: optionalNumber(values("two_wheeler_parking"), "two_wheeler_parking", 0, 100, true) ?? 0,
    furnishing: ["furnished", "semi_furnished", "unfurnished", "not_applicable"].includes(values("furnishing"))
      ? values("furnishing")
      : "unfurnished",
    age_years: optionalNumber(values("age_years"), "age_years", 0, 200, true),
  };
}

function leadRow(values: (header: string) => string, agencyId: string) {
  const name = values("name");
  const phone = values("phone");
  const email = values("email").toLowerCase();
  const intent = values("intent").toLowerCase();
  const requirements = values("requirements");
  const clientAddress = values("client_address");
  const notes = values("notes");
  const source = values("source").toLowerCase() || "other";
  const status = values("status").toLowerCase() || "new";
  if (name.length < 1 || name.length > 100) throw new Error("name must be between 1 and 100 characters.");
  if (!validPhone(phone)) throw new Error("phone must be valid.");
  if (!validEmail(email)) throw new Error("email must be valid when provided.");
  if (!["buy", "sell", "rent", "lease"].includes(intent)) throw new Error("intent must be buy, sell, rent, or lease.");
  if (requirements.length < 1 || requirements.length > 2000) throw new Error("requirements are required and must be under 2000 characters.");
  if (clientAddress.length > 500) throw new Error("client_address must be under 500 characters.");
  if (notes.length > 4000) throw new Error("notes must be under 4000 characters.");
  if (!sources.includes(source)) throw new Error(`source must be one of: ${sources.join(", ")}.`);
  if (!leadStatuses.includes(status)) throw new Error(`status must be one of: ${leadStatuses.join(", ")}.`);
  return {
    id: randomUUID(),
    agency_id: agencyId,
    property_id: null,
    name,
    phone,
    email,
    client_address: clientAddress,
    source,
    intent,
    requirements,
    status,
    notes,
  };
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || (user.role !== "super_admin" && (!user.agency_id || user.agency_status !== "active"))) {
    return Response.json({ error: "Sign in to an active agency or admin account first." }, { status: 401 });
  }
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  if (Number(request.headers.get("content-length") || 0) > 5 * 1024 * 1024 + 20_000) {
    return Response.json({ error: "Maximum spreadsheet size is 5 MB." }, { status: 413 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const kind = String(form.get("kind") || "");
    if (kind !== "properties" && kind !== "leads") return Response.json({ error: "Choose properties or enquiries to import." }, { status: 400 });
    if (!(file instanceof File) || file.size < 1 || file.size > 5 * 1024 * 1024) {
      return Response.json({ error: "Choose a workbook under 5 MB." }, { status: 413 });
    }
    const extension = file.name.toLowerCase().split(".").pop();
    const bytes = Buffer.from(await file.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    if (extension === "csv") {
      await workbook.csv.read(Readable.from([bytes]));
    } else if (extension === "xlsx") {
      await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    } else {
      return Response.json({ error: "Use an .xlsx workbook or a .csv file saved from Excel." }, { status: 400 });
    }
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return Response.json({ error: "The workbook has no worksheets." }, { status: 400 });
    const { headers, rows } = worksheetRows(worksheet);
    if (!rows.length) return Response.json({ error: "The first worksheet has no data rows." }, { status: 400 });
    if (rows.length > 500) return Response.json({ error: "Import up to 500 rows at a time." }, { status: 413 });

    const agencyId = user.role === "super_admin" ? String(form.get("agency_id") || "") : user.agency_id || "";
    if (!agencyId) return Response.json({ error: "Select an agency for these records." }, { status: 400 });
    const supabase = await createSupabaseServerClient();
    const { data: agency, error: agencyError } = await supabase.from("agencies").select("id,status").eq("id", agencyId).maybeSingle();
    if (agencyError) throw new Error(`Unable to verify agency: ${agencyError.message}`);
    if (!agency || (user.role !== "super_admin" && agency.status !== "active")) {
      return Response.json({ error: "Select a valid active agency." }, { status: 400 });
    }

    const required = kind === "properties"
      ? ["title", "intent", "type", "price", "area", "locality", "city", "address", "lat", "lng", "description"]
      : ["name", "phone", "intent", "requirements"];
    requireColumns(headers, required);
    const errors: string[] = [];
    const propertyRecords: ReturnType<typeof propertyRow>[] = [];
    const leadRecords: ReturnType<typeof leadRow>[] = [];
    for (const row of rows) {
      try {
        if (kind === "properties") propertyRecords.push(propertyRow(row.values, agencyId));
        else leadRecords.push(leadRow(row.values, agencyId));
      } catch (error) {
        errors.push(`Row ${row.rowNumber}: ${error instanceof Error ? error.message : "invalid data"}`);
      }
    }
    if (errors.length) return Response.json({ error: "Fix the listed rows and import again.", rows: errors.slice(0, 30), omittedErrors: Math.max(0, errors.length - 30) }, { status: 400 });
    const insertResult = kind === "properties"
      ? await supabase.from("properties").insert(propertyRecords)
      : await supabase.from("leads").insert(leadRecords);
    const insertError = insertResult.error;
    if (insertError) throw new Error(`Import was not saved: ${insertError.message}`);
    const imported = kind === "properties" ? propertyRecords.length : leadRecords.length;
    await supabase.from("activity").insert({ id: randomUUID(), agency_id: agencyId, actor: user.name, action: `Imported ${imported} ${kind} from a workbook` });
    return Response.json({ imported }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Spreadsheet import failed." }, { status: 400 });
  }
}
