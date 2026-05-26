import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.name != null) update.name = String(body.name);
  if (body.charger_type != null) update.charger_type = String(body.charger_type);
  if (body.power_kw != null) update.power_kw = Number(body.power_kw);
  if (body.custom_tariff_mop_per_kwh !== undefined)
    update.custom_tariff_mop_per_kwh =
      body.custom_tariff_mop_per_kwh == null
        ? null
        : Number(body.custom_tariff_mop_per_kwh);
  if (body.location_name !== undefined)
    update.location_name =
      body.location_name == null ? null : String(body.location_name);
  if (body.walking_minutes !== undefined)
    update.walking_minutes =
      body.walking_minutes == null ? null : Number(body.walking_minutes);
  if (body.notes !== undefined)
    update.notes = body.notes == null ? null : String(body.notes);
  if (body.reliability_rating !== undefined)
    update.reliability_rating =
      body.reliability_rating == null ? null : Number(body.reliability_rating);
  if (body.use_count != null) update.use_count = Number(body.use_count);
  if (body.last_used_at != null) update.last_used_at = String(body.last_used_at);

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("chargers")
    .update(update)
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = getSupabase();
  const { error } = await supabase.from("chargers").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
