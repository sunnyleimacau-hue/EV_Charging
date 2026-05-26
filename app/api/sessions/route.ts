import { NextResponse } from "next/server";
import { one, query } from "@/lib/db";
import type { Session } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHARGER_TYPES = ["nio", "slow", "medium", "quick", "custom", "zhuhai"];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limitRaw = Number(searchParams.get("limit") ?? 200);
  const limit = Number.isFinite(limitRaw) ? Math.min(limitRaw, 500) : 200;

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (from) {
    params.push(from);
    conditions.push(`started_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`started_at <= $${params.length}`);
  }
  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
  params.push(limit);

  try {
    const rows = await query<Session>(
      `select * from sessions ${where} order by started_at desc limit $${params.length}`,
      params,
    );
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 500 });
  }
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

  try {
    const row = await one<Session>(
      `insert into sessions (
         charger_type, charger_name, power_kw, tariff_mop_per_kwh,
         start_soc, target_soc, estimated_kwh, estimated_cost,
         duration_hours, was_night, had_family_parking, parking_was_sunk,
         logged_by, notes
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       returning *`,
      [
        chargerType,
        String(body.charger_name ?? "charger"),
        Number(body.power_kw ?? 0),
        Number(body.tariff_mop_per_kwh ?? 0),
        Number(body.start_soc ?? 0),
        Number(body.target_soc ?? 0),
        Number(body.estimated_kwh ?? 0),
        Number(body.estimated_cost ?? 0),
        body.duration_hours != null ? Number(body.duration_hours) : null,
        Boolean(body.was_night),
        Boolean(body.had_family_parking),
        Boolean(body.parking_was_sunk),
        body.logged_by != null ? String(body.logged_by) : null,
        body.notes != null ? String(body.notes) : null,
      ],
    );

    // Mark as the single active session.
    await query(
      "update active_session set session_id = $1, updated_at = now() where id = 1",
      [row!.id],
    );

    // Bump charger use-count if this session used a saved charger.
    if (body.charger_id) {
      await query(
        "update chargers set use_count = use_count + 1, last_used_at = now() where id = $1",
        [String(body.charger_id)],
      );
    }

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 500 });
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : "database error";
}
