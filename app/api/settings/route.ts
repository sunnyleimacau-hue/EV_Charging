import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NUMERIC_FIELDS = [
  "nio_tariff",
  "slow_day_tariff",
  "slow_night_tariff",
  "medium_tariff",
  "quick_tariff",
  "public_parking_day",
  "public_parking_night",
  "home_rent_monthly",
  "battery_capacity",
  "rmb_to_mop",
  "daily_kwh_estimate",
] as const;

export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  for (const field of NUMERIC_FIELDS) {
    if (body[field] != null) {
      const n = Number(body[field]);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json(
          { error: `invalid value for ${field}` },
          { status: 400 },
        );
      }
      update[field] = n;
    }
  }

  if (body.battery_chemistry != null) {
    const v = String(body.battery_chemistry);
    if (!["NMC", "LFP", "unknown"].includes(v)) {
      return NextResponse.json(
        { error: "invalid battery_chemistry" },
        { status: 400 },
      );
    }
    update.battery_chemistry = v;
  }

  if (body.wife_mode_default != null) {
    update.wife_mode_default = Boolean(body.wife_mode_default);
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("settings")
    .update(update)
    .eq("id", 1)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
