import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHARGER_TYPES = ["nio", "slow", "medium", "quick", "custom", "zhuhai"];

export async function GET(req: Request) {
  const supabase = getSupabase();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = Number(searchParams.get("limit") ?? 200);

  let query = supabase
    .from("sessions")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(Number.isFinite(limit) ? limit : 200);

  if (from) query = query.gte("started_at", from);
  if (to) query = query.lte("started_at", to);

  const { data, error } = await query;
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

  const chargerType = String(body.charger_type ?? "");
  if (!CHARGER_TYPES.includes(chargerType)) {
    return NextResponse.json({ error: "invalid charger_type" }, { status: 400 });
  }

  const row = {
    charger_type: chargerType,
    charger_name: String(body.charger_name ?? "charger"),
    power_kw: Number(body.power_kw ?? 0),
    tariff_mop_per_kwh: Number(body.tariff_mop_per_kwh ?? 0),
    start_soc: Number(body.start_soc ?? 0),
    target_soc: Number(body.target_soc ?? 0),
    estimated_kwh: Number(body.estimated_kwh ?? 0),
    estimated_cost: Number(body.estimated_cost ?? 0),
    duration_hours: body.duration_hours != null ? Number(body.duration_hours) : null,
    was_night: Boolean(body.was_night),
    had_family_parking: Boolean(body.had_family_parking),
    parking_was_sunk: Boolean(body.parking_was_sunk),
    logged_by: body.logged_by != null ? String(body.logged_by) : null,
    notes: body.notes != null ? String(body.notes) : null,
  };

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("sessions")
    .insert(row)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mark as the single active session.
  await supabase
    .from("active_session")
    .update({ session_id: data.id, updated_at: new Date().toISOString() })
    .eq("id", 1);

  // Bump charger use-count if this session used a saved charger by name.
  if (body.charger_id) {
    await supabase
      .from("chargers")
      .update({
        use_count: Number(body.charger_use_count ?? 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", String(body.charger_id));
  }

  return NextResponse.json(data, { status: 201 });
}
