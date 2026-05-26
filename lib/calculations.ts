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
