import { one } from "@/lib/db";
import AppShell from "@/components/AppShell";
import type { Session, Settings } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Page() {
  let settings: Settings | null = null;
  let activeSession: Session | null = null;

  try {
    settings = await one<Settings>("select * from settings where id = 1");

    const active = await one<{ session_id: string | null }>(
      "select session_id from active_session where id = 1",
    );
    if (active?.session_id) {
      activeSession = await one<Session>(
        "select * from sessions where id = $1",
        [active.session_id],
      );
    }
  } catch {
    // DB not configured yet — AppShell shows a setup hint.
  }

  return (
    <AppShell initialSettings={settings} initialActiveSession={activeSession} />
  );
}
