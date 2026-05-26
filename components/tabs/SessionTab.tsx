"use client";

import { useState } from "react";
import { BatteryCharging } from "lucide-react";
import { useApp } from "../AppContext";
import { Spinner, StarRating } from "../ui";
import SessionTimer from "../SessionTimer";
import type { Charger, Session } from "@/lib/types";

function publicParkingType(type: string): boolean {
  return type === "slow" || type === "medium" || type === "quick";
}

// Recomputes actual cost from the real duration and the measured kWh.
function computeActualCost(
  session: Session,
  actualKwh: number,
  durationHours: number,
  rates: {
    parkingDay: number;
    parkingNight: number;
    homeRent: number;
  },
): number {
  const energy = actualKwh * session.tariff_mop_per_kwh;
  let parking = 0;
  if (publicParkingType(session.charger_type)) {
    if (session.was_night) parking = rates.parkingNight * durationHours;
    else parking = session.parking_was_sunk ? 0 : rates.parkingDay * durationHours;
  }
  let homeOpp = 0;
  if (session.was_night && !session.had_family_parking) {
    homeOpp = (rates.homeRent / 30 / 24) * durationHours;
  }
  return energy + parking + homeOpp;
}

export default function SessionTab() {
  const { activeSession, refreshActiveSession, setTab, settings, tr, toast } =
    useApp();
  const s = settings!;
  const [completing, setCompleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [endSOC, setEndSOC] = useState<number | "">("");
  const [actualKwh, setActualKwh] = useState<number | "">("");
  const [rating, setRating] = useState(0);

  if (!activeSession) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-800">
          <BatteryCharging className="h-7 w-7" />
        </div>
        <p className="font-medium">{tr("session.empty")}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("session.emptyHint")}
        </p>
      </div>
    );
  }

  const session = activeSession;

  async function complete() {
    setSaving(true);
    const startMs = new Date(session.started_at).getTime();
    const durationHours = Math.max(0, (Date.now() - startMs) / 3_600_000);
    const finalSOC = endSOC === "" ? session.target_soc : Number(endSOC);
    const kwh =
      actualKwh === ""
        ? Math.max(
            0,
            ((finalSOC - session.start_soc) / 100) * s.battery_capacity,
          )
        : Number(actualKwh);
    const cost = computeActualCost(session, kwh, durationHours, {
      parkingDay: s.public_parking_day,
      parkingNight: s.public_parking_night,
      homeRent: s.home_rent_monthly,
    });

    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          end_soc: finalSOC,
          actual_kwh: kwh,
          actual_cost: cost,
          duration_hours: durationHours,
          completed: true,
        }),
      });
      if (!res.ok) throw new Error();

      // If a saved charger matches by name, record the reliability rating.
      if (rating > 0) {
        try {
          const list = (await (await fetch("/api/chargers")).json()) as Charger[];
          const match = list.find((c) => c.name === session.charger_name);
          if (match) {
            await fetch(`/api/chargers/${match.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reliability_rating: rating }),
            });
          }
        } catch {
          // rating is best-effort
        }
      }

      toast(tr("common.saved"));
      await refreshActiveSession();
      setTab("history");
    } catch {
      toast("could not complete session", "error");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-green-500 dark:border-gray-700 dark:bg-gray-900";

  return (
    <div className="space-y-4">
      <SessionTimer session={session} />

      {!completing ? (
        <button
          onClick={() => setCompleting(true)}
          className="h-12 w-full rounded-lg bg-green-600 font-medium text-white"
        >
          {tr("session.complete")}
        </button>
      ) : (
        <div className="space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
          <label className="block">
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {tr("session.endSOC")}
            </span>
            <input
              type="number"
              min={0}
              max={100}
              value={endSOC}
              onChange={(e) =>
                setEndSOC(e.target.value === "" ? "" : parseInt(e.target.value, 10))
              }
              placeholder={`${session.target_soc}`}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {tr("session.actualKwh")}
            </span>
            <input
              type="number"
              step={0.1}
              value={actualKwh}
              onChange={(e) =>
                setActualKwh(
                  e.target.value === "" ? "" : parseFloat(e.target.value),
                )
              }
              className={inputCls}
            />
          </label>
          <div>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {tr("session.rate")}
            </span>
            <div className="mt-1">
              <StarRating value={rating} onChange={setRating} />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={complete}
              disabled={saving}
              className="flex h-11 flex-1 items-center justify-center rounded-lg bg-green-600 font-medium text-white disabled:opacity-50"
            >
              {saving ? <Spinner className="h-5 w-5" /> : tr("common.save")}
            </button>
            <button
              onClick={() => setCompleting(false)}
              className="h-11 rounded-lg border border-gray-300 px-4 text-sm dark:border-gray-700"
            >
              {tr("common.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
