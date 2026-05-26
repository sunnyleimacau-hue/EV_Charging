import { NextResponse } from "next/server";
import { one, query } from "@/lib/db";
import type { Session } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns the active session row (or null), with the full session expanded.
export async function GET() {
  try {
    const active = await one<{ session_id: string | null }>(
      "select session_id from active_session where id = 1",
    );
    if (!active?.session_id) return NextResponse.json({ session: null });

    const session = await one<Session>("select * from sessions where id = $1", [
      active.session_id,
    ]);
    return NextResponse.json({ session: session ?? null });
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
  const sessionId = body.session_id ? String(body.session_id) : null;

  try {
    await query(
      "update active_session set session_id = $1, updated_at = now() where id = 1",
      [sessionId],
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await query(
      "update active_session set session_id = null, updated_at = now() where id = 1",
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 500 });
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : "database error";
}
