import { NextResponse } from "next/server";
import { buildSet, one, query } from "@/lib/db";
import type { Charger } from "@/lib/types";

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

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  try {
    const { clause, values } = buildSet(update);
    const row = await one<Charger>(
      `update chargers set ${clause} where id = $${values.length + 1} returning *`,
      [...values, params.id],
    );
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(row);
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    await query("delete from chargers where id = $1", [params.id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 500 });
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : "database error";
}
