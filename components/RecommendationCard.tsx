"use client";

import { AlertTriangle, Check } from "lucide-react";
import { useApp } from "./AppContext";
import { formatMOP, formatTime, type CalculatedOption } from "@/lib/calculations";

export default function RecommendationCard({
  option,
  reasoning,
  warnings,
  onStart,
  compact,
}: {
  option: CalculatedOption;
  reasoning?: string;
  warnings?: string[];
  onStart: (o: CalculatedOption) => void;
  compact?: boolean;
}) {
  const { tr } = useApp();

  return (
    <div className="rounded-2xl border border-green-500 bg-green-50 p-4 dark:border-green-600 dark:bg-green-950/30">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">
        <Check className="h-3.5 w-3.5" /> {tr("decide.bestChoice")}
      </div>
      <div className="mt-1 flex items-end justify-between">
        <p className="text-lg font-semibold">{option.name}</p>
        {!compact && (
          <p className="text-2xl font-bold tabular-nums">
            {formatMOP(option.total)}
          </p>
        )}
      </div>
      {!compact && (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {formatTime(option.time)} · {option.mopPerKwh.toFixed(2)} MOP/kWh
        </p>
      )}

      {reasoning && (
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">{reasoning}</p>
      )}

      {warnings && warnings.length > 0 && (
        <ul className="mt-2 space-y-1">
          {warnings.map((w, i) => (
            <li
              key={i}
              className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => onStart(option)}
        className="mt-3 h-11 w-full rounded-lg bg-green-600 font-medium text-white hover:bg-green-700"
      >
        {compact ? tr("decide.chargeHere") : tr("decide.startCharging")}
      </button>
    </div>
  );
}
