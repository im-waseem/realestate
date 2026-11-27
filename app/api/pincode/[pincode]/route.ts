import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: Promise<{ pincode: string }> }) {
  const { pincode } = await params;
  if (!/^[1-9][0-9]{5}$/.test(pincode)) return NextResponse.json({ error: "Enter a valid 6-digit PIN code." }, { status: 400 });
  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, { next: { revalidate: 86400 } });
    if (!response.ok) return NextResponse.json({ error: "PIN code lookup is unavailable." }, { status: 502 });
    const data = await response.json();
    const office = data?.[0]?.PostOffice?.[0];
    if (!office) return NextResponse.json({ error: "No Indian post office found for this PIN code." }, { status: 404 });
    return NextResponse.json({ district: office.District, state: office.State, city: office.Block && office.Block !== "NA" ? office.Block : office.District });
  } catch {
    return NextResponse.json({ error: "PIN code lookup is unavailable." }, { status: 502 });
  }
}
