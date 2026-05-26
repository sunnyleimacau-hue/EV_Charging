"use client";

import { useState } from "react";
import { useApp } from "./AppContext";
import { Spinner } from "./ui";
import type { Charger, SavedChargerType } from "@/lib/types";

const TYPES: { value: SavedChargerType; label: string }[] = [
  { value: "slow", label: "slow" },
  { value: "medium", label: "medium" },
  { value: "quick", label: "quick" },
  { value: "nio", label: "nio" },
  { value: "custom", label: "custom" },
];

const DEFAULT_POWER: Record<SavedChargerType, number> = {
  slow: 7.4,
  medium: 25,
  quick: 60,
  nio: 30,
  custom: 11,
};

export default function ChargerForm({
  existing,
  onSaved,
  onCancel,
}: {
  existing?: Charger;
  onSaved: (c: Charger) => void;
  onCancel: () => void;
}) {
  const { tr, toast } = useApp();
  const [name, setName] = useState(existing?.name ?? "");
  const [type, setType] = useState<SavedChargerType>(
    existing?.charger_type ?? "medium",
  );
  const [power, setPower] = useState<number>(existing?.power_kw ?? 25);
  const [tariff, setTariff] = useState<number | "">(
    existing?.custom_tariff_mop_per_kwh ?? "",
  );
  const [location, setLocation] = useState(existing?.location_name ?? "");
  const [walkMin, setWalkMin] = useState<number | "">(
    existing?.walking_minutes ?? "",
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) {
      toast("name is required", "error");
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      charger_type: type,
      power_kw: power,
      custom_tariff_mop_per_kwh: tariff === "" ? null : Number(tariff),
      location_name: location || null,
      walking_minutes: walkMin === "" ? null : Number(walkMin),
      notes: notes || null,
    };
    try {
      const res = await fetch(
        existing ? `/api/chargers/${existing.id}` : "/api/chargers",
        {
          method: existing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) throw new Error();
      const charger = (await res.json()) as Charger;
      toast(tr("common.saved"));
      onSaved(charger);
    } catch {
      toast("could not save charger", "error");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-green-500 dark:border-gray-700 dark:bg-gray-900";

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={tr("chargers.name")}
        className={inputCls}
      />
      <div className="flex gap-2">
        <select
          value={type}
          onChange={(e) => {
            const v = e.target.value as SavedChargerType;
            setType(v);
            setPower(DEFAULT_POWER[v]);
          }}
          className={inputCls}
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          step={0.1}
          value={power}
          onChange={(e) => setPower(parseFloat(e.target.value))}
          placeholder="kW"
          className={inputCls}
        />
      </div>
      {type === "custom" && (
        <input
          type="number"
          step={0.01}
          value={tariff}
          onChange={(e) =>
            setTariff(e.target.value === "" ? "" : parseFloat(e.target.value))
          }
          placeholder="MOP/kWh"
          className={inputCls}
        />
      )}
      <div className="flex gap-2">
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder={tr("chargers.location")}
          className={inputCls}
        />
        <input
          type="number"
          value={walkMin}
          onChange={(e) =>
            setWalkMin(e.target.value === "" ? "" : parseInt(e.target.value, 10))
          }
          placeholder={tr("chargers.walkMin")}
          className={inputCls}
        />
      </div>
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={tr("history.notes")}
        className={inputCls}
      />
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex h-10 flex-1 items-center justify-center rounded-md bg-green-600 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? <Spinner className="h-4 w-4" /> : tr("common.save")}
        </button>
        <button
          onClick={onCancel}
          className="h-10 rounded-md border border-gray-300 px-4 text-sm dark:border-gray-700"
        >
          {tr("common.cancel")}
        </button>
      </div>
    </div>
  );
}
