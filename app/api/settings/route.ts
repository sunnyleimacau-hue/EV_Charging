import { NextResponse } from "next/server";
import { buildSet, one } from "@/lib/db";
import type { Settings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NUMERIC_FIELDS = [
  "nio_tariff",
  "slow_day_tariff",
  "slow_night_tariff",
  "medium_tariff",
  "quick_tariff",
  "nio_power_kw",
  "slow_power_kw",
  "medium_power_kw",
  "quick_power_kw",
  "public_parking_day",
  "public_parking_night",
  "home_rent_monthly",
  "battery_capacity",
  "rmb_to_mop",
  "no_target_cheap_premium",
  "daily_kwh_estimate",
] as const;

export async function GET() {
  try {
    const row = await one<Settings>("select * from settings where id = 1");
    return NextResponse.json(row);
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  for (const f of NUMERIC_FIELDS) {
    if (body[f] != null) {
      const n = Number(body[f]);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json(
          { error: `invalid value for ${f}` },
          { status: 400 },
        );
      }
      update[f] = n;
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

  if (body.charging_notes != null) {
    const v = String(body.charging_notes);
    if (v.length > 2000) {
      return NextResponse.json(
        { error: "charging_notes too long (max 2000 chars)" },
        { status: 400 },
      );
    }
    update.charging_notes = v;
  }

  update.updated_at = new Date().toISOString();

  try {
    const { clause, values } = buildSet(update);
    const row = await one<Settings>(
      `update settings set ${clause} where id = 1 returning *`,
      values,
    );
    return NextResponse.json(row);
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 500 });
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : "database error";
}
