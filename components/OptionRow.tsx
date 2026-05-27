"use client";

import { useApp } from "./AppContext";
import { formatMOP, formatTime, type DwellOption } from "@/lib/calculations";

export default function OptionRow({
  option,
  targetSOC,
  isWinner,
  showBreakdown,
  onStart,
}: {
  option: DwellOption;
  targetSOC: number;
  isWinner?: boolean;
  showBreakdown?: boolean;
  onStart?: (o: DwellOption) => void;
}) {
  const { tr } = useApp();
  const short = !option.meetsTarget;

  return (
    <div
      className={`rounded-xl border p-3 ${
        isWinner
          ? "border-green-500 bg-green-50 dark:border-green-600 dark:bg-green-950/30"
          : short
            ? "border-amber-300 dark:border-amber-800/60"
            : "border-gray-200 dark:border-gray-800"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{option.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {tr("decide.reaches")} {Math.round(option.endSOC)}%
            {short && ` (${tr("decide.target")} ${targetSOC}%)`} ·{" "}
            {formatTime(option.time)} · {option.mopPerKwh.toFixed(2)} MOP/kWh
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums">
            {formatMOP(option.total)}
          </p>
        </div>
      </div>

      {showBreakdown && (
        <div className="mt-2 grid grid-cols-3 gap-2 border-t border-gray-100 pt-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
          <span>{tr("decide.energy")}: {formatMOP(option.energy)}</span>
          <span>{tr("settings.parking")}: {formatMOP(option.parking)}</span>
          <span>home: {formatMOP(option.homeOpp)}</span>
        </div>
      )}

      {onStart && (
        <button
          onClick={() => onStart(option)}
          className={`mt-2 h-9 w-full rounded-md text-sm font-medium ${
            isWinner
              ? "bg-green-600 text-white"
              : "border border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-200"
          }`}
        >
          {tr("decide.startCharging")}
        </button>
      )}
    </div>
  );
}
