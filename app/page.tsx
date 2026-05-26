import { getSupabase } from "@/lib/supabase";
import AppShell from "@/components/AppShell";
import type { Session, Settings } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Page() {
  let settings: Settings | null = null;
  let activeSession: Session | null = null;

  try {
    const supabase = getSupabase();
    const { data: s } = await supabase
      .from("settings")
      .select("*")
      .eq("id", 1)
      .single();
    settings = (s as Settings) ?? null;

    const { data: active } = await supabase
      .from("active_session")
      .select("session_id")
      .eq("id", 1)
      .single();
    if (active?.session_id) {
      const { data: sess } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", active.session_id)
        .single();
      activeSession = (sess as Session) ?? null;
    }
  } catch {
    // DB not configured yet — AppShell shows a setup hint.
  }

  return (
    <AppShell initialSettings={settings} initialActiveSession={activeSession} />
  );
}
