import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getOpenAI, OPENAI_MODEL } from "@/lib/openai";
import { buildChatSystemPrompt, type CurrentState } from "@/lib/prompts";
import type { Session, Settings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: Request) {
  let body: {
    message?: string;
    context?: CurrentState;
    history?: ChatMessage[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const message = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const supabase = getSupabase();
  const [{ data: settings }, { data: sessions }] = await Promise.all([
    supabase.from("settings").select("*").eq("id", 1).single(),
    supabase
      .from("sessions")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(10),
  ]);

  const system = buildChatSystemPrompt(
    settings as Settings,
    (sessions ?? []) as Session[],
    body.context ?? {},
  );

  const history = (body.history ?? [])
    .slice(-6)
    .map((m) => ({ role: m.role, content: m.content }));

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: 400,
      messages: [
        { role: "system", content: system },
        ...history,
        { role: "user", content: message },
      ],
    });
    const reply = completion.choices[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ reply });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "chat failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
