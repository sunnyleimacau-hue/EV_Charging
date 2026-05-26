"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useApp } from "../AppContext";
import { Checkbox, Toggle } from "../ui";
import OptionRow from "../OptionRow";
import RecommendationCard from "../RecommendationCard";
import AskBox from "../AskBox";
import {
  computeOptions,
  kWhToAdd,
  rankOptions,
  type CalculatedOption,
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
        <span className="text-sm font-semibold tabular-nums">{value}%</span>
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

export default function DecideTab() {
  const { settings, tr, wifeMode, setWifeMode, setTab, refreshActiveSession, toast } =
    useApp();
  const s = settings!;

  const [currentSOC, setCurrentSOC] = useState(40);
  const [targetSOC, setTargetSOC] = useState(80);
  const [night, setNight] = useState(isNightNow());
  const [familyParking, setFamilyParking] = useState(true);
  const [parkingSunk, setParkingSunk] = useState(true);
  const [dwell, setDwell] = useState<number | "">("");

  const [customOn, setCustomOn] = useState(false);
  const [customCurrency, setCustomCurrency] = useState<"MOP" | "RMB">("MOP");
  const [customPrice, setCustomPrice] = useState<number>(1.4);
  const [customPower, setCustomPower] = useState<number>(11);

  const [zhuhai, setZhuhai] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const [reco, setReco] = useState<Recommendation | null>(null);
  const [recoLoading, setRecoLoading] = useState(false);

  // Target is clamped to >= current via slider min and the current-SOC handler.
  const effectiveTarget = Math.max(targetSOC, currentSOC);
  const kWhNeeded = kWhToAdd(currentSOC, effectiveTarget, s.battery_capacity);

  const customTariffMop =
    customCurrency === "RMB" ? customPrice * s.rmb_to_mop : customPrice;

  const dwellHours = dwell === "" ? undefined : Number(dwell);

  const allOptions = useMemo(
    () =>
      computeOptions(
        s,
        kWhNeeded,
        currentSOC,
        {
          isNight: night,
          hasFamilyParking: familyParking,
          parkingIsSunk: parkingSunk,
          dwellHours,
        },
        {
          custom: customOn ? { tariff: customTariffMop, power: customPower } : null,
          zhuhai,
        },
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      s,
      kWhNeeded,
      currentSOC,
      night,
      familyParking,
      parkingSunk,
      dwellHours,
      customOn,
      customTariffMop,
      customPower,
      zhuhai,
    ],
  );

  // Hide night-variant options during the day unless "show all" is on.
  const visible = allOptions.filter(
    (o) => showAll || night || o.isNightOption !== true,
  );
  const { feasible, filtered } = rankOptions(visible, dwellHours);

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
      setRecoLoading(true);
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
              dwellHours,
            },
            extras: {
              custom: customOn
                ? { tariff: customTariffMop, power: customPower }
                : null,
              zhuhai,
            },
          }),
        });
        if (res.ok) setReco(await res.json());
      } catch {
        setReco(null);
      } finally {
        setRecoLoading(false);
      }
    }, 700);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentSOC,
    targetSOC,
    night,
    familyParking,
    parkingSunk,
    dwellHours,
    customOn,
    customTariffMop,
    customPower,
    zhuhai,
    kWhNeeded,
  ]);

  // Winner: LLM pick if it matches a feasible option, else cheapest feasible.
  const winner: CalculatedOption | undefined =
    (reco && feasible.find((o) => o.id === reco.winner)) || feasible[0];

  async function startCharging(option: CalculatedOption) {
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
          target_soc: effectiveTarget,
          estimated_kwh: kWhNeeded,
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
    dwellHours,
    goingToZhuhai: zhuhai,
    wifeMode,
  };

  const inputCls =
    "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-green-500 dark:border-gray-700 dark:bg-gray-900";

  return (
    <div className="space-y-4">
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

      {!wifeMode && (
        <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
          <Toggle
            label={night ? tr("decide.night") : tr("decide.day")}
            checked={night}
            onChange={setNight}
          />
          <div className="mt-1 space-y-1">
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
          <label className="mt-2 flex items-center justify-between gap-3">
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {tr("decide.dwell")}
            </span>
            <input
              type="number"
              step={0.5}
              min={0}
              value={dwell}
              onChange={(e) =>
                setDwell(e.target.value === "" ? "" : parseFloat(e.target.value))
              }
              className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-right text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </label>
        </div>
      )}

      {!wifeMode && (
        <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
          <Toggle
            label={tr("decide.customStation")}
            checked={customOn}
            onChange={setCustomOn}
          />
          {customOn && (
            <div className="mt-3 space-y-2">
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
            </div>
          )}
          <div className="mt-2">
            <Toggle
              label={tr("decide.zhuhai")}
              checked={zhuhai}
              onChange={setZhuhai}
            />
          </div>
        </div>
      )}

      {kWhNeeded <= 0 ? (
        <p className="rounded-xl border border-gray-200 p-4 text-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
          already at target
        </p>
      ) : winner ? (
        <>
          <RecommendationCard
            option={winner}
            reasoning={reco?.reasoning}
            warnings={
              reco?.warnings && reco.warnings.length ? reco.warnings : warnings
            }
            onStart={startCharging}
            compact={wifeMode}
          />

          {!wifeMode && (
            <>
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
                {feasible.map((o) => (
                  <OptionRow
                    key={o.id}
                    option={o}
                    isWinner={o.id === winner.id}
                    showBreakdown={showBreakdown}
                    onStart={startCharging}
                  />
                ))}
                {filtered.map((o) => (
                  <OptionRow
                    key={o.id}
                    option={o}
                    disabled
                    showBreakdown={showBreakdown}
                  />
                ))}
              </div>
            </>
          )}
        </>
      ) : null}

      {!wifeMode && <AskBox context={askContext} />}

      <div className="pt-2">
        <Toggle
          label={tr("settings.wifeMode")}
          checked={wifeMode}
          onChange={setWifeMode}
        />
      </div>
    </div>
  );
}
