"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Heart,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";
import { useApp } from "../AppContext";
import { Checkbox, Toggle } from "../ui";
import OptionRow from "../OptionRow";
import RecommendationCard from "../RecommendationCard";
import AskBox from "../AskBox";
import {
  computeDwellOptions,
  formatMOP,
  formatTime,
  kWhToAdd,
  rankDwellOptions,
  type DwellOption,
} from "@/lib/calculations";
import type { ChargerType as DbChargerType, Recommendation } from "@/lib/types";

function isNightNow(): boolean {
  const h = new Date().getHours();
  return h < 9 || h >= 20;
}

function typeFromId(id: string): DbChargerType {
  if (id.startsWith("slow")) return "slow";
  if (id.startsWith("medium")) return "medium";
  if (id.startsWith("quick")) return "quick";
  if (id === "custom") return "custom";
  if (id === "zhuhai") return "zhuhai";
  return "nio";
}

function SocSlider({
  label,
  value,
  min = 0,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
        <span className="text-base font-semibold tabular-nums">{value}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full"
      />
    </div>
  );
}

const DWELL_PRESETS = [0.5, 1, 2, 4, 8];

function DwellPicker({
  value,
  onChange,
  hoursLabel,
  anyLabel,
}: {
  value: number | "";
  onChange: (v: number | "") => void;
  hoursLabel: string;
  anyLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {DWELL_PRESETS.map((h) => (
        <button
          key={h}
          type="button"
          onClick={() => onChange(h)}
          className={`rounded-full px-3 py-1 text-sm ${
            value === h
              ? "bg-green-600 text-white"
              : "border border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-300"
          }`}
        >
          {h % 1 === 0 ? h : h.toFixed(1)}h
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange("")}
        className={`rounded-full px-3 py-1 text-sm ${
          value === ""
            ? "bg-green-600 text-white"
            : "border border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-300"
        }`}
      >
        {anyLabel}
      </button>
      <input
        type="number"
        inputMode="decimal"
        step={0.5}
        min={0.25}
        value={value}
        onChange={(e) => {
          if (e.target.value === "") return onChange("");
          const n = parseFloat(e.target.value);
          onChange(Number.isFinite(n) && n > 0 ? n : "");
        }}
        aria-label={hoursLabel}
        className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-right text-sm outline-none focus:border-green-500 dark:border-gray-700 dark:bg-gray-900"
      />
    </div>
  );
}

function Collapsible({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between p-4 text-sm font-medium"
      >
        {title}
        {open ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>
      {open && <div className="space-y-3 px-4 pb-4">{children}</div>}
    </div>
  );
}

export default function DecideTab() {
  const { settings, tr, wifeMode, setWifeMode, setTab, refreshActiveSession, toast } =
    useApp();
  const s = settings!;

  const [currentSOC, setCurrentSOC] = useState(40);
  const [targetSOC, setTargetSOC] = useState(80);
  // Dwell is the prominent primary input but can be cleared; blank means "time
  // is not a constraint" (rank purely by cost, today's behavior).
  const [dwell, setDwell] = useState<number | "">(2);
  const [night, setNight] = useState(isNightNow());
  const [familyParking, setFamilyParking] = useState(true);
  const [parkingSunk, setParkingSunk] = useState(true);

  const [customOn, setCustomOn] = useState(false);
  const [customCurrency, setCustomCurrency] = useState<"MOP" | "RMB">("MOP");
  const [customPrice, setCustomPrice] = useState<number>(1.4);
  const [customPower, setCustomPower] = useState<number>(11);

  const [showAll, setShowAll] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Advanced sections are collapsed by default so the default view stays simple.
  const [showTrip, setShowTrip] = useState(false);
  const [showCompare, setShowCompare] = useState(false);

  const [reco, setReco] = useState<Recommendation | null>(null);

  // Target is clamped to >= current via slider min and the current-SOC handler.
  const effectiveTarget = Math.max(targetSOC, currentSOC);
  const kWhNeeded = kWhToAdd(currentSOC, effectiveTarget, s.battery_capacity);

  const customTariffMop =
    customCurrency === "RMB" ? customPrice * s.rmb_to_mop : customPrice;

  const dwellSet = dwell !== "" && dwell > 0;
  // When blank, use a very large window so nothing is time-constrained — every
  // charger "reaches" target and ranking falls back to pure cost.
  const dwellHours = dwellSet ? (dwell as number) : 1e6;

  const allOptions = useMemo(
    () =>
      computeDwellOptions(
        s,
        currentSOC,
        effectiveTarget,
        dwellHours,
        {
          isNight: night,
          hasFamilyParking: familyParking,
          parkingIsSunk: parkingSunk,
          dwellHours,
        },
        {
          custom: customOn ? { tariff: customTariffMop, power: customPower } : null,
        },
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      s,
      currentSOC,
      effectiveTarget,
      dwellHours,
      night,
      familyParking,
      parkingSunk,
      customOn,
      customTariffMop,
      customPower,
    ],
  );

  // Hide night-variant options during the day unless "show all" is on.
  const visible = allOptions.filter(
    (o) => showAll || night || o.isNightOption !== true,
  );
  const { meets, short } = rankDwellOptions(visible);
  const ranked = [...meets, ...short];

  // "Is this charger worth it?" verdict for the custom station, comparing it to
  // the cheapest non-custom option that also reaches the target.
  const customOpt = customOn ? allOptions.find((o) => o.id === "custom") : undefined;
  const worthIt = useMemo(() => {
    if (!customOpt) return null;
    if (!customOpt.meetsTarget) return { kind: "short" as const };
    const bestOther = meets.find((o) => o.id !== "custom");
    if (!bestOther || customOpt.total <= bestOther.total + 1e-9) {
      return { kind: "best" as const };
    }
    return {
      kind: "pricier" as const,
      name: bestOther.name,
      delta: customOpt.total - bestOther.total,
    };
  }, [customOpt, meets]);

  const warnings = useMemo(() => {
    const w: string[] = [];
    if (targetSOC >= 100) w.push(tr("warn.target100"));
    else if (targetSOC > 90) w.push(tr("warn.target90"));
    if (currentSOC < 15) w.push(tr("warn.low"));
    return w;
  }, [targetSOC, currentSOC, tr]);

  // Fetch the LLM recommendation (debounced). Falls back deterministically.
  useEffect(() => {
    if (kWhNeeded <= 0) {
      setReco(null);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentSOC,
            targetSOC: effectiveTarget,
            context: {
              isNight: night,
              hasFamilyParking: familyParking,
              parkingIsSunk: parkingSunk,
              dwellHours: dwellSet ? dwellHours : undefined,
            },
            extras: {
              custom: customOn
                ? { tariff: customTariffMop, power: customPower }
                : null,
            },
          }),
        });
        if (res.ok) setReco(await res.json());
      } catch {
        setReco(null);
      }
    }, 700);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentSOC,
    targetSOC,
    dwellHours,
    night,
    familyParking,
    parkingSunk,
    customOn,
    customTariffMop,
    customPower,
    kWhNeeded,
  ]);

  // Winner: LLM pick if it matches a computed option, else the best ranked
  // option (cheapest that reaches target, else the one that gets closest). No
  // hard exclusions — night public can win when the model judges it sensible.
  const winner: DwellOption | undefined =
    (reco && ranked.find((o) => o.id === reco.winner)) || meets[0] || short[0];

  async function startCharging(option: DwellOption) {
    const kwh = option.tariff > 0 ? option.energy / option.tariff : 0;
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          charger_type: typeFromId(option.id),
          charger_name: option.name,
          power_kw: option.power,
          tariff_mop_per_kwh: option.tariff,
          start_soc: currentSOC,
          target_soc: Math.round(option.endSOC),
          estimated_kwh: kwh,
          estimated_cost: option.total,
          duration_hours: option.time,
          was_night: option.isNightOption ?? night,
          had_family_parking: familyParking,
          parking_was_sunk: parkingSunk,
        }),
      });
      if (!res.ok) throw new Error();
      await refreshActiveSession();
      setTab("session");
    } catch {
      toast("could not start session", "error");
    }
  }

  const askContext = {
    currentSOC,
    targetSOC,
    isNight: night,
    hasFamilyParking: familyParking,
    parkingIsSunk: parkingSunk,
    dwellHours: dwellSet ? dwellHours : undefined,
    wifeMode,
  };

  const inputCls =
    "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-green-500 dark:border-gray-700 dark:bg-gray-900";

  return (
    <div className="space-y-4">
      {/* Fun simple/detailed mode switch */}
      <div className="flex rounded-full bg-gray-100 p-1 dark:bg-gray-800">
        <button
          onClick={() => setWifeMode(true)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium transition ${
            wifeMode
              ? "bg-white text-green-600 shadow dark:bg-gray-700 dark:text-green-400"
              : "text-gray-500 dark:text-gray-400"
          }`}
        >
          <Heart
            className={`h-4 w-4 ${wifeMode ? "fill-green-500 text-green-500" : ""}`}
          />
          {tr("decide.simple")}
        </button>
        <button
          onClick={() => setWifeMode(false)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium transition ${
            !wifeMode
              ? "bg-white text-green-600 shadow dark:bg-gray-700 dark:text-green-400"
              : "text-gray-500 dark:text-gray-400"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {tr("decide.detailed")}
        </button>
      </div>

      {wifeMode && (
        <div className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-3 text-white">
          <Sparkles className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">{tr("decide.simpleTagline")}</p>
        </div>
      )}

      {/* SOC sliders + dwell — the core inputs */}
      <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
        <SocSlider
          label={tr("decide.currentSOC")}
          value={currentSOC}
          onChange={(v) => {
            setCurrentSOC(v);
            if (targetSOC < v) setTargetSOC(v);
          }}
        />
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            {tr("decide.dwellPrimary")}
          </p>
          <DwellPicker
            value={dwell}
            onChange={setDwell}
            hoursLabel={tr("decide.hours")}
            anyLabel={tr("decide.dwellAny")}
          />
        </div>
        <div className="mt-4">
          <SocSlider
            label={tr("decide.targetSOC")}
            value={targetSOC}
            min={currentSOC}
            onChange={setTargetSOC}
          />
        </div>
        <p className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
          {tr("decide.toAdd")}:{" "}
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {kWhNeeded.toFixed(1)} kWh
          </span>
        </p>
      </div>

      {/* Recommendation — always front and center */}
      {kWhNeeded <= 0 ? (
        <p className="rounded-xl border border-gray-200 p-4 text-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
          already at target
        </p>
      ) : winner ? (
        <>
          {wifeMode && (
            <div className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <Heart className="h-3.5 w-3.5 fill-green-500 text-green-500" />
              {tr("decide.easyChoice")}
            </div>
          )}
          <RecommendationCard
            option={winner}
            targetSOC={effectiveTarget}
            reasoning={reco?.reasoning}
            warnings={
              reco?.warnings && reco.warnings.length ? reco.warnings : warnings
            }
            onStart={startCharging}
            compact={wifeMode}
          />
        </>
      ) : null}

      {/* Standing verdict: Zhuhai is cheapest by far if you're crossing anyway.
          Always present, low-emphasis — not a competing local option. */}
      <p className="px-1 text-xs text-gray-500 dark:text-gray-400">
        🇨🇳 {tr("decide.zhuhaiNote")} · ~{s.rmb_to_mop.toFixed(2)} MOP/kWh
      </p>

      {/* Everything below is detailed-mode only, collapsed by default */}
      {!wifeMode && (
        <>
          <Collapsible
            title={tr("decide.tripDetails")}
            open={showTrip}
            onToggle={() => setShowTrip((v) => !v)}
          >
            <Toggle
              label={night ? tr("decide.night") : tr("decide.day")}
              checked={night}
              onChange={setNight}
            />
            <div className="space-y-1">
              <Checkbox
                label={tr("decide.familyParking")}
                checked={familyParking}
                onChange={setFamilyParking}
              />
              <Checkbox
                label={tr("decide.parkingSunk")}
                checked={parkingSunk}
                onChange={setParkingSunk}
              />
            </div>

            <div className="border-t border-gray-100 pt-3 dark:border-gray-800">
              <Toggle
                label={tr("decide.worthItTitle")}
                checked={customOn}
                onChange={setCustomOn}
              />
              {customOn && (
                <div className="mt-2 space-y-2">
                  <div className="flex gap-2">
                    <select
                      value={customCurrency}
                      onChange={(e) =>
                        setCustomCurrency(e.target.value as "MOP" | "RMB")
                      }
                      className={inputCls}
                    >
                      <option value="MOP">MOP</option>
                      <option value="RMB">RMB</option>
                    </select>
                    <input
                      type="number"
                      step={0.01}
                      value={customPrice}
                      onChange={(e) => setCustomPrice(parseFloat(e.target.value))}
                      placeholder={tr("decide.price")}
                      className={inputCls}
                    />
                    <input
                      type="number"
                      step={0.1}
                      value={customPower}
                      onChange={(e) => setCustomPower(parseFloat(e.target.value))}
                      placeholder={tr("decide.power")}
                      className={inputCls}
                    />
                  </div>
                  {customCurrency === "RMB" && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      ≈ {customTariffMop.toFixed(2)} MOP/kWh
                    </p>
                  )}
                  {customOpt && worthIt && (
                    <div className="rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-700">
                      <p className="font-medium">
                        {tr("decide.reaches")} {Math.round(customOpt.endSOC)}% ·{" "}
                        {formatMOP(customOpt.total)} · {formatTime(customOpt.time)}
                      </p>
                      {worthIt.kind === "short" && (
                        <p className="mt-1 text-amber-700 dark:text-amber-400">
                          {tr("decide.shortOfTarget")}
                        </p>
                      )}
                      {worthIt.kind === "best" && (
                        <p className="mt-1 text-green-700 dark:text-green-400">
                          {tr("decide.verdictBest")}
                        </p>
                      )}
                      {worthIt.kind === "pricier" && (
                        <p className="mt-1 text-gray-600 dark:text-gray-300">
                          {tr("decide.verdictPricierThan")} {worthIt.name} (+
                          {formatMOP(worthIt.delta)})
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Collapsible>

          {kWhNeeded > 0 && winner && (
            <Collapsible
              title={tr("decide.compareOptions")}
              open={showCompare}
              onToggle={() => setShowCompare((v) => !v)}
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className="text-sm text-green-600"
                >
                  {tr("decide.showAll")}
                </button>
                <button
                  onClick={() => setShowBreakdown((v) => !v)}
                  className="flex items-center gap-1 text-sm text-gray-500"
                >
                  {tr("decide.showBreakdown")}
                  {showBreakdown ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </div>
              <div className="space-y-2">
                {ranked.map((o) => (
                  <OptionRow
                    key={o.id}
                    option={o}
                    targetSOC={effectiveTarget}
                    isWinner={o.id === winner.id}
                    showBreakdown={showBreakdown}
                    note={o.isNightOption ? tr("decide.nightNote") : undefined}
                    onStart={startCharging}
                  />
                ))}
              </div>
            </Collapsible>
          )}

          <AskBox context={askContext} />
        </>
      )}
    </div>
  );
}
