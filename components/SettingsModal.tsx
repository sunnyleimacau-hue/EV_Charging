"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useApp } from "./AppContext";
import { NumberField, Spinner, StarRating, Toggle } from "./ui";
import ChargerForm from "./ChargerForm";
import type {
  BatteryChemistry,
  Charger,
  Language,
  Settings,
  ThemeMode,
} from "@/lib/types";
import { LANGUAGES } from "@/lib/i18n";

interface Proposal {
  field: string;
  currentValue: number;
  suggestedValue: number;
  evidence: string;
  confidence: string;
}

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const {
    settings,
    setSettings,
    lang,
    setLang,
    theme,
    setTheme,
    wifeMode,
    setWifeMode,
    toast,
    tr,
  } = useApp();
  const router = useRouter();
  const [form, setForm] = useState<Settings>(settings!);
  const [saving, setSaving] = useState(false);

  const [chargers, setChargers] = useState<Charger[]>([]);
  const [showChargerForm, setShowChargerForm] = useState(false);
  const [editing, setEditing] = useState<Charger | null>(null);

  const [refining, setRefining] = useState(false);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);

  useEffect(() => {
    fetch("/api/chargers")
      .then((r) => (r.ok ? r.json() : []))
      .then(setChargers)
      .catch(() => {});
  }, []);

  function field<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      const updated = (await res.json()) as Settings;
      setSettings(updated);
      setWifeMode(updated.wife_mode_default);
      toast(tr("common.saved"));
    } catch {
      toast("could not save settings", "error");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  async function runRefine() {
    setRefining(true);
    setProposals(null);
    try {
      const res = await fetch("/api/refine-settings", { method: "POST" });
      const data = await res.json();
      setProposals(data.proposals ?? []);
    } catch {
      toast("analysis failed", "error");
    } finally {
      setRefining(false);
    }
  }

  async function acceptProposal(p: Proposal) {
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [p.field]: p.suggestedValue }),
      });
      if (!res.ok) throw new Error();
      const updated = (await res.json()) as Settings;
      setSettings(updated);
      setForm(updated);
      setProposals((prev) => prev?.filter((x) => x.field !== p.field) ?? null);
      toast(tr("common.saved"));
    } catch {
      toast("could not apply", "error");
    }
  }

  async function deleteCharger(id: string) {
    await fetch(`/api/chargers/${id}`, { method: "DELETE" });
    setChargers((prev) => prev.filter((c) => c.id !== id));
  }

  const sectionCls = "rounded-xl border border-gray-200 p-4 dark:border-gray-800";
  const headingCls = "mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="flex max-h-[92vh] w-full max-w-app flex-col rounded-t-2xl bg-white dark:bg-gray-950 sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <h2 className="font-semibold">{tr("settings.title")}</h2>
          <button
            onClick={onClose}
            aria-label={tr("common.close")}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <section className={sectionCls}>
            <p className={headingCls}>{tr("settings.tariffs")}</p>
            <NumberField label={tr("settings.nioTariff")} value={form.nio_tariff} onChange={(v) => field("nio_tariff", v)} />
            <NumberField label={tr("settings.slowDay")} value={form.slow_day_tariff} onChange={(v) => field("slow_day_tariff", v)} />
            <NumberField label={tr("settings.slowNight")} value={form.slow_night_tariff} onChange={(v) => field("slow_night_tariff", v)} />
            <NumberField label={tr("settings.medium")} value={form.medium_tariff} onChange={(v) => field("medium_tariff", v)} />
            <NumberField label={tr("settings.quick")} value={form.quick_tariff} onChange={(v) => field("quick_tariff", v)} />
          </section>

          <section className={sectionCls}>
            <p className={headingCls}>{tr("settings.parking")}</p>
            <NumberField label={tr("settings.parkingDay")} value={form.public_parking_day} onChange={(v) => field("public_parking_day", v)} step={0.5} />
            <NumberField label={tr("settings.parkingNight")} value={form.public_parking_night} onChange={(v) => field("public_parking_night", v)} step={0.5} />
            <NumberField label={tr("settings.homeRent")} value={form.home_rent_monthly} onChange={(v) => field("home_rent_monthly", v)} step={50} />
          </section>

          <section className={sectionCls}>
            <p className={headingCls}>{tr("settings.battery")}</p>
            <NumberField label={tr("settings.capacity")} value={form.battery_capacity} onChange={(v) => field("battery_capacity", v)} step={1} suffix="kWh" />
            <label className="flex items-center justify-between gap-3 py-1.5">
              <span className="text-sm text-gray-600 dark:text-gray-300">{tr("settings.chemistry")}</span>
              <select
                value={form.battery_chemistry}
                onChange={(e) => field("battery_chemistry", e.target.value as BatteryChemistry)}
                className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="unknown">unknown</option>
                <option value="NMC">NMC</option>
                <option value="LFP">LFP</option>
              </select>
            </label>
          </section>

          <section className={sectionCls}>
            <p className={headingCls}>{tr("settings.usage")}</p>
            <NumberField label={tr("settings.rmbToMop")} value={form.rmb_to_mop} onChange={(v) => field("rmb_to_mop", v)} />
            <NumberField label={tr("settings.dailyKwh")} value={form.daily_kwh_estimate} onChange={(v) => field("daily_kwh_estimate", v)} step={0.1} suffix="kWh" />
            <Toggle label={tr("settings.wifeMode")} checked={form.wife_mode_default} onChange={(v) => field("wife_mode_default", v)} />
          </section>

          <section className={sectionCls}>
            <p className={headingCls}>{tr("settings.notes")}</p>
            <p className="mb-2 text-xs text-gray-400">{tr("settings.notesHint")}</p>
            <textarea
              value={form.charging_notes ?? ""}
              onChange={(e) => field("charging_notes", e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder={tr("settings.notesPlaceholder")}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-green-500 dark:border-gray-700 dark:bg-gray-900"
            />
          </section>

          <button
            onClick={save}
            disabled={saving}
            className="flex h-11 w-full items-center justify-center rounded-lg bg-green-600 font-medium text-white disabled:opacity-50"
          >
            {saving ? <Spinner className="h-5 w-5" /> : tr("common.save")}
          </button>

          <section className={sectionCls}>
            <div className="mb-2 flex items-center justify-between">
              <p className={headingCls + " mb-0"}>{tr("settings.chargers")}</p>
              <button
                onClick={() => {
                  setEditing(null);
                  setShowChargerForm(true);
                }}
                className="flex items-center gap-1 text-sm text-green-600"
              >
                <Plus className="h-4 w-4" /> {tr("common.add")}
              </button>
            </div>
            {chargers.length === 0 && !showChargerForm && (
              <p className="text-sm text-gray-400">{tr("chargers.none")}</p>
            )}
            <div className="space-y-2">
              {chargers.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-gray-400">
                      {c.charger_type} · {c.power_kw} kW · {tr("chargers.uses")} {c.use_count}
                    </p>
                    {c.reliability_rating != null && (
                      <StarRating value={c.reliability_rating} size="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditing(c); setShowChargerForm(true); }} className="text-xs text-gray-500">
                      {tr("common.edit")}
                    </button>
                    <button onClick={() => deleteCharger(c.id)} aria-label={tr("common.delete")} className="text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {showChargerForm && (
              <div className="mt-2">
                <ChargerForm
                  existing={editing ?? undefined}
                  onSaved={(c) => {
                    setChargers((prev) => {
                      const exists = prev.some((x) => x.id === c.id);
                      return exists ? prev.map((x) => (x.id === c.id ? c : x)) : [c, ...prev];
                    });
                    setShowChargerForm(false);
                    setEditing(null);
                  }}
                  onCancel={() => { setShowChargerForm(false); setEditing(null); }}
                />
              </div>
            )}
          </section>

          <section className={sectionCls}>
            <div className="mb-2 flex items-center justify-between">
              <p className={headingCls + " mb-0"}>{tr("refine.title")}</p>
              <button onClick={runRefine} disabled={refining} className="flex items-center gap-1 text-sm text-green-600 disabled:opacity-50">
                {refining ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              </button>
            </div>
            {proposals && proposals.length === 0 && (
              <p className="text-sm text-gray-400">{tr("refine.none")}</p>
            )}
            <div className="space-y-2">
              {proposals?.map((p) => (
                <div key={p.field} className="rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-800">
                  <p className="font-medium">{p.field}</p>
                  <p className="text-gray-500 dark:text-gray-400">
                    {p.currentValue} → {p.suggestedValue} · {p.confidence}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">{p.evidence}</p>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => acceptProposal(p)} className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white">
                      {tr("refine.accept")}
                    </button>
                    <button onClick={() => setProposals((prev) => prev?.filter((x) => x.field !== p.field) ?? null)} className="rounded-md border border-gray-300 px-3 py-1 text-xs dark:border-gray-700">
                      {tr("refine.reject")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={sectionCls}>
            <p className={headingCls}>{tr("settings.appearance")}</p>
            <label className="flex items-center justify-between gap-3 py-1.5">
              <span className="text-sm text-gray-600 dark:text-gray-300">{tr("settings.language")}</span>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as Language)}
                className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center justify-between gap-3 py-1.5">
              <span className="text-sm text-gray-600 dark:text-gray-300">{tr("settings.theme")}</span>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as ThemeMode)}
                className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="light">{tr("settings.theme.light")}</option>
                <option value="dark">{tr("settings.theme.dark")}</option>
                <option value="system">{tr("settings.theme.system")}</option>
              </select>
            </label>
          </section>

          <button
            onClick={signOut}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 dark:border-gray-700 dark:text-gray-300"
          >
            <LogOut className="h-4 w-4" /> {tr("settings.signOut")}
          </button>
        </div>
      </div>
    </div>
  );
}
