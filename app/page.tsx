import { one } from "@/lib/db";
import AppShell from "@/components/AppShell";
import type { Session, Settings } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Page() {
  let settings: Settings | null = null;
  let activeSession: Session | null = null;
  let dbError: string | null = null;

  try {
    settings = await one<Settings>("select * from settings where id = 1");
    if (!settings) {
      dbError =
        "connected, but no settings row — run db/schema.sql in your Neon database.";
    }

    const active = await one<{ session_id: string | null }>(
      "select session_id from active_session where id = 1",
    );
    if (active?.session_id) {
      activeSession = await one<Session>(
        "select * from sessions where id = $1",
        [active.session_id],
      );
    }
  } catch (err) {
    dbError = err instanceof Error ? err.message : "database connection failed";
  }

  return (
    <AppShell
      initialSettings={settings}
      initialActiveSession={activeSession}
      dbError={dbError}
    />
  );
}
