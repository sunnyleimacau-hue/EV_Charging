import { NextResponse } from "next/server";
import { buildSet, one, query } from "@/lib/db";
import type { Session } from "@/lib/types";

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
  if (body.end_soc != null) update.end_soc = Number(body.end_soc);
  if (body.actual_kwh != null) update.actual_kwh = Number(body.actual_kwh);
  if (body.actual_cost != null) update.actual_cost = Number(body.actual_cost);
  if (body.duration_hours != null)
    update.duration_hours = Number(body.duration_hours);
  if (body.notes !== undefined)
    update.notes = body.notes == null ? null : String(body.notes);
  if (body.completed) update.completed_at = new Date().toISOString();
  if (body.completed_at != null) update.completed_at = String(body.completed_at);

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  try {
    const { clause, values } = buildSet(update);
    const row = await one<Session>(
      `update sessions set ${clause} where id = $${values.length + 1} returning *`,
      [...values, params.id],
    );
    if (!row) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    // If this completed session was the active one, clear the tracker.
    if (update.completed_at) {
      await query(
        "update active_session set session_id = null, updated_at = now() where id = 1 and session_id = $1",
        [params.id],
      );
    }

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
    await query("delete from sessions where id = $1", [params.id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 500 });
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : "database error";
}
