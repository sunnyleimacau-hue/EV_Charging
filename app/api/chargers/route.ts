import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = ["slow", "medium", "quick", "custom", "nio"];

export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("chargers")
    .select("*")
    .order("use_count", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const type = String(body.charger_type ?? "");
  if (!TYPES.includes(type)) {
    return NextResponse.json({ error: "invalid charger_type" }, { status: 400 });
  }
  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const row = {
    name: String(body.name),
    charger_type: type,
    power_kw: Number(body.power_kw ?? 0),
    custom_tariff_mop_per_kwh:
      body.custom_tariff_mop_per_kwh != null
        ? Number(body.custom_tariff_mop_per_kwh)
        : null,
    location_name: body.location_name != null ? String(body.location_name) : null,
    walking_minutes:
      body.walking_minutes != null ? Number(body.walking_minutes) : null,
    notes: body.notes != null ? String(body.notes) : null,
    reliability_rating:
      body.reliability_rating != null ? Number(body.reliability_rating) : null,
  };

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("chargers")
    .insert(row)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
