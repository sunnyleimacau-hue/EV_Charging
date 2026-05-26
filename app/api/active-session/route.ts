import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns the active session row (or null), with the full session expanded.
export async function GET() {
  const supabase = getSupabase();
  const { data: active, error } = await supabase
    .from("active_session")
    .select("session_id")
    .eq("id", 1)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!active?.session_id) return NextResponse.json({ session: null });

  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", active.session_id)
    .single();
  if (sErr) return NextResponse.json({ session: null });
  return NextResponse.json({ session });
}

export async function PUT(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const sessionId = body.session_id ? String(body.session_id) : null;

  const supabase = getSupabase();
  const { error } = await supabase
    .from("active_session")
    .update({ session_id: sessionId, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("active_session")
    .update({ session_id: null, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
