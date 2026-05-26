"use client";

import { useEffect, useState } from "react";
import { formatMOP, formatTime } from "@/lib/calculations";
import { useApp } from "./AppContext";
import type { Session } from "@/lib/types";

export default function SessionTimer({ session }: { session: Session }) {
  const { tr } = useApp();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const startMs = new Date(session.started_at).getTime();
  const elapsedHours = Math.max(0, (now - startMs) / 3_600_000);
  const totalHours = session.duration_hours ?? 0;
  const progress = totalHours > 0 ? Math.min(1, elapsedHours / totalHours) : 0;

  const currentSOC =
    session.start_soc + progress * (session.target_soc - session.start_soc);
  const remainingHours = Math.max(0, totalHours - elapsedHours);
  const accruedCost = session.estimated_cost * progress;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {session.charger_name}
        </p>
        <div className="mt-3 flex items-end justify-between">
          <span className="text-3xl font-bold tabular-nums">
            {Math.round(currentSOC)}%
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {session.start_soc}% → {session.target_soc}%
          </span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full rounded-full bg-green-600 transition-[width] duration-1000 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label={tr("session.elapsed")} value={formatTime(elapsedHours)} />
        <Stat
          label={tr("session.eta")}
          value={remainingHours > 0 ? formatTime(remainingHours) : "done"}
        />
        <Stat label={tr("session.estCost")} value={formatMOP(accruedCost)} />
      </div>

      <div className="rounded-xl border border-gray-200 p-3 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
        {tr("session.estTotal")}: {formatMOP(session.estimated_cost)} ·{" "}
        {session.estimated_kwh.toFixed(1)} kWh
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 p-3 text-center dark:border-gray-800">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums">{value}</p>
    </div>
  );
}
