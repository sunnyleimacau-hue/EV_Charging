"use client";

import { useState } from "react";
import { Settings as SettingsIcon, Zap } from "lucide-react";
import type { Session, Settings } from "@/lib/types";
import { AppProvider, useApp, type TabId } from "./AppContext";
import SettingsModal from "./SettingsModal";
import DecideTab from "./tabs/DecideTab";
import SessionTab from "./tabs/SessionTab";
import HistoryTab from "./tabs/HistoryTab";
import PredictTab from "./tabs/PredictTab";
import DriftBanner from "./DriftBanner";
import ServiceWorkerRegister from "./ServiceWorkerRegister";

export default function AppShell({
  initialSettings,
  initialActiveSession,
}: {
  initialSettings: Settings | null;
  initialActiveSession: Session | null;
}) {
  if (!initialSettings) {
    return (
      <main className="mx-auto flex min-h-screen max-w-app items-center justify-center px-6 text-center">
        <div className="space-y-2">
          <p className="font-medium">database not configured</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            set DATABASE_URL, then run the schema in db/schema.sql against your
            Neon database.
          </p>
        </div>
      </main>
    );
  }

  return (
    <AppProvider
      initialSettings={initialSettings}
      initialActiveSession={initialActiveSession}
    >
      <Shell />
      <ServiceWorkerRegister />
    </AppProvider>
  );
}

const TABS: { id: TabId; key: "nav.decide" | "nav.session" | "nav.history" | "nav.predict" }[] = [
  { id: "decide", key: "nav.decide" },
  { id: "session", key: "nav.session" },
  { id: "history", key: "nav.history" },
  { id: "predict", key: "nav.predict" },
];

function Shell() {
  const { tab, setTab, tr, activeSession } = useApp();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="mx-auto min-h-screen max-w-app">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-white">
            <Zap className="h-4 w-4" />
          </div>
          <span className="font-semibold">{tr("app.title")}</span>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label={tr("settings.title")}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <SettingsIcon className="h-5 w-5" />
        </button>
      </header>

      <nav className="sticky top-[57px] z-20 flex border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
        {TABS.map((tDef) => {
          const active = tab === tDef.id;
          return (
            <button
              key={tDef.id}
              onClick={() => setTab(tDef.id)}
              className={`relative flex-1 py-3 text-sm font-medium transition ${
                active
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {tr(tDef.key)}
              {tDef.id === "session" && activeSession && (
                <span className="absolute right-1/2 top-2 ml-1 h-2 w-2 translate-x-6 rounded-full bg-green-500" />
              )}
              {active && (
                <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-green-600 dark:bg-green-400" />
              )}
            </button>
          );
        })}
      </nav>

      <DriftBanner onReview={() => setSettingsOpen(true)} />

      <main className="px-4 py-4 pb-24">
        {tab === "decide" && <DecideTab />}
        {tab === "session" && <SessionTab />}
        {tab === "history" && <HistoryTab />}
        {tab === "predict" && <PredictTab />}
      </main>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
