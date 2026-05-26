"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO, subDays } from "date-fns";
import { ChevronDown, ChevronUp, Sparkles, Trash2 } from "lucide-react";
import { useApp } from "../AppContext";
import { Spinner } from "../ui";
import { formatMOP } from "@/lib/calculations";
import type { Session } from "@/lib/types";

// Rough efficiency / petrol baseline for the savings estimate.
const EV_KWH_PER_KM = 0.16; // ~16 kWh/100km
const ICE_MOP_PER_KM = 16 / 10; // 16 MOP/L at 10 km/L

export default function HistoryTab() {
  const { tr, toast } = useApp();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(
    format(subDays(new Date(), 30), "yyyy-MM-dd"),
  );
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/sessions?from=${from}T00:00:00&to=${to}T23:59:59`,
      );
      const data = await res.json();
      setSessions(Array.isArray(data) ? data : []);
    } catch {
      toast("could not load history", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const completed = sessions.filter((s) => s.completed_at);

  const stats = useMemo(() => {
    const spent = completed.reduce(
      (sum, s) => sum + (s.actual_cost ?? s.estimated_cost),
      0,
    );
    const kwh = completed.reduce(
      (sum, s) => sum + (s.actual_kwh ?? s.estimated_kwh),
      0,
    );
    return {
      count: completed.length,
      spent,
      kwh,
      avgRate: kwh > 0 ? spent / kwh : 0,
    };
  }, [completed]);

  // Savings vs petrol for the current calendar month.
  const monthSaving = useMemo(() => {
    const ym = format(new Date(), "yyyy-MM");
    const thisMonth = completed.filter(
      (s) => (s.completed_at ?? "").slice(0, 7) === ym,
    );
    const evSpent = thisMonth.reduce(
      (sum, s) => sum + (s.actual_cost ?? s.estimated_cost),
      0,
    );
    const kwh = thisMonth.reduce(
      (sum, s) => sum + (s.actual_kwh ?? s.estimated_kwh),
      0,
    );
    const km = kwh / EV_KWH_PER_KM;
    const iceCost = km * ICE_MOP_PER_KM;
    return iceCost - evSpent;
  }, [completed]);

  const monthly = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of completed) {
      const key = (s.completed_at ?? s.started_at).slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + (s.actual_cost ?? s.estimated_cost));
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [completed]);

  async function askWhy() {
    setInsightLoading(true);
    setInsight(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message:
            "Analyse my last 30 days of charging versus the prior 30 days and explain in 2-3 sentences what caused any change in cost.",
          context: {},
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setInsight(data.reply);
    } catch {
      toast("could not load insight", "error");
    } finally {
      setInsightLoading(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setConfirmDelete(null);
  }

  async function saveNotes(id: string, notes: string) {
    await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, notes } : s)),
    );
    toast(tr("common.saved"));
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6 text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <StatBox label={tr("history.totalSessions")} value={`${stats.count}`} />
        <StatBox label={tr("history.totalSpent")} value={formatMOP(stats.spent)} />
        <StatBox label={tr("history.totalKwh")} value={stats.kwh.toFixed(1)} />
        <StatBox
          label={tr("history.avgRate")}
          value={stats.avgRate.toFixed(2)}
        />
      </div>

      {monthSaving > 0 && (
        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-400">
          {tr("history.savedVsIce")}: {formatMOP(monthSaving)}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
        <span className="text-gray-400">–</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
      </div>

      <button
        onClick={askWhy}
        disabled={insightLoading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 py-2.5 text-sm font-medium dark:border-gray-700"
      >
        {insightLoading ? (
          <Spinner className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4 text-green-600" />
        )}
        {tr("history.whyDifferent")}
      </button>
      {insight && (
        <p className="rounded-xl bg-gray-100 px-4 py-3 text-sm dark:bg-gray-800">
          {insight}
        </p>
      )}

      {completed.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
          {tr("history.empty")}
        </p>
      ) : (
        <div className="space-y-2">
          {completed.map((s) => {
            const cost = s.actual_cost ?? s.estimated_cost;
            const variance = s.actual_cost
              ? s.actual_cost - s.estimated_cost
              : 0;
            const open = expanded === s.id;
            return (
              <div
                key={s.id}
                className="rounded-xl border border-gray-200 dark:border-gray-800"
              >
                <button
                  onClick={() => setExpanded(open ? null : s.id)}
                  className="flex w-full items-center justify-between gap-2 p-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {s.charger_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {format(parseISO(s.completed_at ?? s.started_at), "d MMM, HH:mm")}{" "}
                      · {s.start_soc}% → {s.end_soc ?? s.target_soc}%
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">
                        {formatMOP(cost)}
                      </p>
                      {Math.abs(variance) > 5 && (
                        <p
                          className={`text-xs ${
                            variance > 0 ? "text-red-500" : "text-green-600"
                          }`}
                        >
                          {variance > 0 ? "+" : ""}
                          {formatMOP(variance)}
                        </p>
                      )}
                    </div>
                    {open ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {open && (
                  <div className="space-y-2 border-t border-gray-100 p-3 dark:border-gray-800">
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>
                        {tr("history.estimated")}: {formatMOP(s.estimated_cost)}
                      </span>
                      <span>
                        {tr("history.actual")}:{" "}
                        {s.actual_cost != null ? formatMOP(s.actual_cost) : "—"}
                      </span>
                      <span>
                        kWh: {(s.actual_kwh ?? s.estimated_kwh).toFixed(1)}
                      </span>
                      <span>{s.tariff_mop_per_kwh.toFixed(2)} MOP/kWh</span>
                    </div>
                    <NotesEditor
                      initial={s.notes ?? ""}
                      onSave={(n) => saveNotes(s.id, n)}
                      label={tr("history.notes")}
                      saveLabel={tr("common.save")}
                    />
                    {confirmDelete === s.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => remove(s.id)}
                          className="flex-1 rounded-md bg-red-600 py-2 text-sm font-medium text-white"
                        >
                          {tr("common.confirm")}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="rounded-md border border-gray-300 px-4 text-sm dark:border-gray-700"
                        >
                          {tr("common.cancel")}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(s.id)}
                        className="flex items-center gap-1 text-sm text-red-500"
                      >
                        <Trash2 className="h-4 w-4" /> {tr("common.delete")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {monthly.length > 0 && (
        <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            {tr("history.monthly")}
          </p>
          <div className="space-y-1">
            {monthly.map(([month, total]) => (
              <div
                key={month}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-gray-500 dark:text-gray-400">
                  {format(parseISO(`${month}-01`), "MMM yyyy")}
                </span>
                <span className="font-medium tabular-nums">
                  {formatMOP(total)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function NotesEditor({
  initial,
  onSave,
  label,
  saveLabel,
}: {
  initial: string;
  onSave: (notes: string) => void;
  label: string;
  saveLabel: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="space-y-1">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={label}
        rows={2}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-green-500 dark:border-gray-700 dark:bg-gray-900"
      />
      {value !== initial && (
        <button
          onClick={() => onSave(value)}
          className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white"
        >
          {saveLabel}
        </button>
      )}
    </div>
  );
}
