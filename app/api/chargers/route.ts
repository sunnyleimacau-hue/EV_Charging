import { NextResponse } from "next/server";
import { one, query } from "@/lib/db";
import type { Charger } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = ["slow", "medium", "quick", "custom", "nio"];

export async function GET() {
  try {
    const rows = await query<Charger>(
      "select * from chargers order by use_count desc, created_at desc",
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

  const type = String(body.charger_type ?? "");
  if (!TYPES.includes(type)) {
    return NextResponse.json({ error: "invalid charger_type" }, { status: 400 });
  }
  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const row = await one<Charger>(
      `insert into chargers (
         name, charger_type, power_kw, custom_tariff_mop_per_kwh,
         location_name, walking_minutes, notes, reliability_rating
       ) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
      [
        String(body.name),
        type,
        Number(body.power_kw ?? 0),
        body.custom_tariff_mop_per_kwh != null
          ? Number(body.custom_tariff_mop_per_kwh)
          : null,
        body.location_name != null ? String(body.location_name) : null,
        body.walking_minutes != null ? Number(body.walking_minutes) : null,
        body.notes != null ? String(body.notes) : null,
        body.reliability_rating != null ? Number(body.reliability_rating) : null,
      ],
    );
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 500 });
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : "database error";
}
