import type { Settings } from "./types";

export interface ChargingContext {
  isNight: boolean;
  hasFamilyParking: boolean;
  parkingIsSunk: boolean;
  dwellHours?: number;
}

export interface ChargerOption {
  id: string;
  name: string;
  power: number;
  tariff: number;
  usesPublicParking: boolean;
  // Night-tariff/night-context variants force a night context regardless of
  // the global day/night toggle. Undefined means "follow the global context".
  isNightOption?: boolean;
}

export interface CalculatedOption extends ChargerOption {
  energy: number;
  parking: number;
  homeOpp: number;
  total: number;
  time: number;
  mopPerKwh: number;
}

// Returns the taper family for a given option id (handles "slow-day" etc.).
function taperProfile(optionId: string): "slow" | "nio" | "medium" | "quick" | "linear" {
  if (optionId.startsWith("nio")) return "nio";
  if (optionId.startsWith("slow")) return "slow";
  if (optionId.startsWith("medium")) return "medium";
  if (optionId.startsWith("quick")) return "quick";
  return "linear"; // custom, zhuhai, unknown
}

// Effective charging power (kW) at a given SOC percentage, applying the taper
// rules for each charger family.
function effectivePower(profile: string, ratedPower: number, soc: number): number {
  switch (profile) {
    case "slow":
      // AC slow: linear, no taper.
      return ratedPower;
    case "nio":
      // Full power until 95% SOC, then 50% rate above 95%.
      return soc < 95 ? ratedPower : ratedPower * 0.5;
    case "medium":
      // Linear until 90%, then 70% rate above.
      return soc < 90 ? ratedPower : ratedPower * 0.7;
    case "quick":
      // 95% of rated below 80%, 70% in 80-90%, 45% in 90-100%.
      if (soc < 80) return ratedPower * 0.95;
      if (soc < 90) return ratedPower * 0.7;
      return ratedPower * 0.45;
    default:
      return ratedPower;
  }
}

// Integrates the charging time over the SOC range in 0.5 kWh chunks so the
// taper is accounted for correctly.
export function calculateChargingTime(
  power: number,
  kWhNeeded: number,
  startSOC: number,
  batteryCapacity: number,
  optionId: string,
): number {
  if (kWhNeeded <= 0 || power <= 0 || batteryCapacity <= 0) return 0;

  const profile = taperProfile(optionId);
  const step = 0.5;
  let added = 0;
  let timeHours = 0;
  let energyInBattery = (startSOC / 100) * batteryCapacity;

  while (added < kWhNeeded - 1e-9) {
    const chunk = Math.min(step, kWhNeeded - added);
    const soc = (energyInBattery / batteryCapacity) * 100;
    const eff = effectivePower(profile, power, soc);
    if (eff <= 0) break;
    timeHours += chunk / eff;
    added += chunk;
    energyInBattery += chunk;
  }

  return timeHours;
}

export interface ReachResult {
  endSOC: number;
  kWhAdded: number;
  timeUsed: number;
}

// Forward-integrates the taper to find how much SOC can be added within a fixed
// time budget. The inverse of calculateChargingTime: same 0.5 kWh stepping and
// per-family taper, so the two stay consistent.
export function reachableSOC(
  power: number,
  availableHours: number,
  startSOC: number,
  batteryCapacity: number,
  optionId: string,
): ReachResult {
  const start = Math.max(0, Math.min(100, startSOC));
  if (power <= 0 || availableHours <= 0 || batteryCapacity <= 0) {
    return { endSOC: start, kWhAdded: 0, timeUsed: 0 };
  }

  const profile = taperProfile(optionId);
  const step = 0.5;
  let energyInBattery = (start / 100) * batteryCapacity;
  let added = 0;
  let timeLeft = availableHours;

  while (timeLeft > 1e-9 && energyInBattery < batteryCapacity - 1e-9) {
    const soc = (energyInBattery / batteryCapacity) * 100;
    const eff = effectivePower(profile, power, soc);
    if (eff <= 0) break;
    const chunk = Math.min(step, batteryCapacity - energyInBattery);
    const timeForChunk = chunk / eff;
    if (timeForChunk <= timeLeft) {
      energyInBattery += chunk;
      added += chunk;
      timeLeft -= timeForChunk;
    } else {
      const partial = eff * timeLeft;
      energyInBattery += partial;
      added += partial;
      timeLeft = 0;
    }
  }

  return {
    endSOC: (energyInBattery / batteryCapacity) * 100,
    kWhAdded: added,
    timeUsed: availableHours - timeLeft,
  };
}

export function calculateOption(
  option: ChargerOption,
  kWhNeeded: number,
  startSOC: number,
  settings: Settings,
  ctx: ChargingContext,
): CalculatedOption {
  const energy = kWhNeeded * option.tariff;
  const time = calculateChargingTime(
    option.power,
    kWhNeeded,
    startSOC,
    settings.battery_capacity,
    option.id,
  );

  let parking = 0;
  if (option.usesPublicParking) {
    if (ctx.isNight) {
      parking = settings.public_parking_night * time;
    } else {
      parking = ctx.parkingIsSunk ? 0 : settings.public_parking_day * time;
    }
  }

  let homeOpp = 0;
  if (ctx.isNight && !ctx.hasFamilyParking) {
    homeOpp = (settings.home_rent_monthly / 30 / 24) * time;
  }

  const total = energy + parking + homeOpp;
  const mopPerKwh = kWhNeeded > 0 ? total / kWhNeeded : 0;

  return {
    ...option,
    energy,
    parking,
    homeOpp,
    total,
    time,
    mopPerKwh,
  };
}

// The 7 base options: NIO, plus day/night variants of slow, medium and quick.
export function getAllOptions(settings: Settings): ChargerOption[] {
  return [
    {
      id: "nio",
      name: "NIO charger",
      power: 30,
      tariff: settings.nio_tariff,
      usesPublicParking: false,
    },
    {
      id: "slow-day",
      name: "slow public (day)",
      power: 7.4,
      tariff: settings.slow_day_tariff,
      usesPublicParking: true,
      isNightOption: false,
    },
    {
      id: "slow-night",
      name: "slow public (night)",
      power: 7.4,
      tariff: settings.slow_night_tariff,
      usesPublicParking: true,
      isNightOption: true,
    },
    {
      id: "medium-day",
      name: "medium public (day)",
      power: 25,
      tariff: settings.medium_tariff,
      usesPublicParking: true,
      isNightOption: false,
    },
    {
      id: "medium-night",
      name: "medium public (night)",
      power: 25,
      tariff: settings.medium_tariff,
      usesPublicParking: true,
      isNightOption: true,
    },
    {
      id: "quick-day",
      name: "quick public (day)",
      power: 60,
      tariff: settings.quick_tariff,
      usesPublicParking: true,
      isNightOption: false,
    },
    {
      id: "quick-night",
      name: "quick public (night)",
      power: 60,
      tariff: settings.quick_tariff,
      usesPublicParking: true,
      isNightOption: true,
    },
  ];
}

export interface ExtraOptions {
  custom?: { name?: string; tariff: number; power: number } | null;
  zhuhai?: boolean;
}

// Builds the full option list: 7 base + optional custom + optional Zhuhai.
function buildOptionList(settings: Settings, extras?: ExtraOptions): ChargerOption[] {
  const opts = getAllOptions(settings);

  if (extras?.custom && extras.custom.power > 0) {
    opts.push({
      id: "custom",
      name: extras.custom.name ?? "custom station",
      power: extras.custom.power,
      tariff: extras.custom.tariff,
      usesPublicParking: false,
    });
  }

  if (extras?.zhuhai) {
    opts.push({
      id: "zhuhai",
      name: "Zhuhai DC",
      power: 60,
      tariff: settings.rmb_to_mop,
      usesPublicParking: false,
    });
  }

  return opts;
}

// Computes each option with the correct per-option context. Night variants force
// a night context; everything else follows the supplied baseCtx.
export function computeOptions(
  settings: Settings,
  kWhNeeded: number,
  startSOC: number,
  baseCtx: ChargingContext,
  extras?: ExtraOptions,
): CalculatedOption[] {
  return buildOptionList(settings, extras).map((o) =>
    calculateOption(o, kWhNeeded, startSOC, settings, {
      ...baseCtx,
      isNight: o.isNightOption ?? baseCtx.isNight,
    }),
  );
}

export interface DwellOption extends CalculatedOption {
  // SOC actually reached within the dwell window (capped at target).
  endSOC: number;
  // Whether this charger reaches the target within the dwell window.
  meetsTarget: boolean;
}

// Dwell-first model: given how long the car will be parked, compute for each
// charger the SOC it actually reaches in that window and the cost of the energy
// it can deliver (never charging past the target). This is the core of the
// "which charger gets me to X% in the time I have" decision.
export function computeDwellOptions(
  settings: Settings,
  startSOC: number,
  targetSOC: number,
  dwellHours: number,
  baseCtx: ChargingContext,
  extras?: ExtraOptions,
): DwellOption[] {
  const cap = settings.battery_capacity;
  const kWhToTarget = kWhToAdd(startSOC, targetSOC, cap);

  return buildOptionList(settings, extras).map((o) => {
    const ctx = { ...baseCtx, isNight: o.isNightOption ?? baseCtx.isNight };
    const reach = reachableSOC(o.power, dwellHours, startSOC, cap, o.id);
    const meetsTarget = reach.kWhAdded >= kWhToTarget - 1e-9;
    const effectiveKWh = Math.min(kWhToTarget, reach.kWhAdded);
    const endSOC = meetsTarget ? targetSOC : Math.min(targetSOC, reach.endSOC);
    const calc = calculateOption(o, effectiveKWh, startSOC, settings, ctx);
    return { ...calc, endSOC, meetsTarget };
  });
}

// Ranks dwell options: chargers that reach the target come first (cheapest
// first); chargers that fall short follow, ordered by how close they get, then
// by cost.
export function rankDwellOptions(options: DwellOption[]): {
  meets: DwellOption[];
  short: DwellOption[];
} {
  const meets = options
    .filter((o) => o.meetsTarget)
    .sort((a, b) => a.total - b.total);
  const short = options
    .filter((o) => !o.meetsTarget)
    .sort((a, b) => b.endSOC - a.endSOC || a.total - b.total);
  return { meets, short };
}

export function rankOptions(
  options: CalculatedOption[],
  dwellHours?: number,
): { feasible: CalculatedOption[]; filtered: CalculatedOption[] } {
  const byCost = (a: CalculatedOption, b: CalculatedOption) => a.total - b.total;

  if (dwellHours == null || dwellHours <= 0) {
    return { feasible: [...options].sort(byCost), filtered: [] };
  }

  const feasible: CalculatedOption[] = [];
  const filtered: CalculatedOption[] = [];
  for (const o of options) {
    if (o.time <= dwellHours + 1e-9) feasible.push(o);
    else filtered.push(o);
  }
  return { feasible: feasible.sort(byCost), filtered: filtered.sort(byCost) };
}

export function formatTime(hours: number): string {
  if (hours <= 0) return "0 min";
  const totalMinutes = Math.round(hours * 60);
  if (totalMinutes < 1) return "< 1 min";
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatMOP(amount: number): string {
  return `${Math.round(amount)} MOP`;
}

// kWh required to move from startSOC to targetSOC (percent) on a given pack.
export function kWhToAdd(
  startSOC: number,
  targetSOC: number,
  batteryCapacity: number,
): number {
  return Math.max(0, ((targetSOC - startSOC) / 100) * batteryCapacity);
}
