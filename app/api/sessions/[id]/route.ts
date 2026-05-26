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
  if (body.end_soc != null) update.end_soc = Number(body.end_soc);
  if (body.actual_kwh != null) update.actual_kwh = Number(body.actual_kwh);
  if (body.actual_cost != null) update.actual_cost = Number(body.actual_cost);
  if (body.duration_hours != null)
    update.duration_hours = Number(body.duration_hours);
  if (body.notes !== undefined)
    update.notes = body.notes == null ? null : String(body.notes);
  if (body.completed != null && body.completed) {
    update.completed_at = new Date().toISOString();
  }
  if (body.completed_at != null) update.completed_at = String(body.completed_at);

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("sessions")
    .update(update)
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If this session was the active one and is now complete, clear the tracker.
  if (update.completed_at) {
    const { data: active } = await supabase
      .from("active_session")
      .select("session_id")
      .eq("id", 1)
      .single();
    if (active?.session_id === params.id) {
      await supabase
        .from("active_session")
        .update({ session_id: null, updated_at: new Date().toISOString() })
        .eq("id", 1);
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = getSupabase();
  const { error } = await supabase.from("sessions").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
