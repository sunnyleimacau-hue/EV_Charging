"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { CalendarClock, Info } from "lucide-react";
import { useApp } from "../AppContext";
import { Spinner } from "../ui";
import type { Session } from "@/lib/types";

export default function PredictTab() {
  const { settings, tr } = useApp();
  const s = settings!;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSOC, setCurrentSOC] = useState(70);

  useEffect(() => {
    const from = format(addDays(new Date(), -30), "yyyy-MM-dd");
    fetch(`/api/sessions?from=${from}T00:00:00`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setSessions(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const completed = useMemo(
    () =>
      sessions
        .filter((x) => x.completed_at)
        .sort(
          (a, b) =>
            new Date(a.completed_at!).getTime() -
            new Date(b.completed_at!).getTime(),
        ),
    [sessions],
  );

  const prediction = useMemo(() => {
    if (completed.length < 2) return null;
    const kwhValues = completed.map((x) => x.actual_kwh ?? x.estimated_kwh);
    const avgKwh = kwhValues.reduce((a, b) => a + b, 0) / kwhValues.length;

    const first = parseISO(completed[0].completed_at!);
    const last = parseISO(completed[completed.length - 1].completed_at!);
    const spanDays = Math.max(1, differenceInCalendarDays(last, first));
    const daysBetween = spanDays / (completed.length - 1);

    const totalKwh = kwhValues.reduce((a, b) => a + b, 0);
    const dailyKwh = totalKwh / spanDays || s.daily_kwh_estimate;

    const availableKwh = Math.max(
      0,
      ((currentSOC - 20) / 100) * s.battery_capacity,
    );
    const daysLeft = dailyKwh > 0 ? availableKwh / dailyKwh : 0;
    const nextBy = addDays(new Date(), Math.floor(daysLeft));

    return { avgKwh, daysBetween, dailyKwh, daysLeft, nextBy };
  }, [completed, currentSOC, s]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6 text-gray-400" />
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-800">
          <Info className="h-7 w-7" />
        </div>
        <p className="max-w-xs text-sm text-gray-500 dark:text-gray-400">
          {tr("predict.needMore")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {tr("decide.currentSOC")}
          </span>
          <span className="text-sm font-semibold tabular-nums">
            {currentSOC}%
          </span>
        </div>
        <input
          type="range"
          min={20}
          max={100}
          value={currentSOC}
          onChange={(e) => setCurrentSOC(parseInt(e.target.value, 10))}
          className="w-full"
        />
      </div>

      <div className="rounded-2xl border border-green-500 bg-green-50 p-4 dark:border-green-600 dark:bg-green-950/30">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">
          <CalendarClock className="h-3.5 w-3.5" /> {tr("predict.nextBy")}
        </div>
        <p className="mt-1 text-2xl font-bold">
          {format(prediction.nextBy, "EEE d MMM")}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {tr("predict.daysLeft")}: {prediction.daysLeft.toFixed(1)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Metric
          label={tr("predict.avgKwh")}
          value={prediction.avgKwh.toFixed(1)}
        />
        <Metric
          label={tr("predict.daysBetween")}
          value={prediction.daysBetween.toFixed(1)}
        />
        <Metric
          label={tr("predict.dailyUse")}
          value={`${prediction.dailyKwh.toFixed(1)} kWh`}
        />
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-gray-100 px-4 py-3 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
        {tr("predict.zhuhaiHint")}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 p-3 text-center dark:border-gray-800">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums">{value}</p>
    </div>
  );
}
