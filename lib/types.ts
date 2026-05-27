export type BatteryChemistry = "NMC" | "LFP" | "unknown";

export type ChargerType =
  | "nio"
  | "slow"
  | "medium"
  | "quick"
  | "custom"
  | "zhuhai";

// Charger types that can be saved as a location (no zhuhai).
export type SavedChargerType = "slow" | "medium" | "quick" | "custom" | "nio";

export interface Settings {
  id: number;
  nio_tariff: number;
  slow_day_tariff: number;
  slow_night_tariff: number;
  medium_tariff: number;
  quick_tariff: number;
  public_parking_day: number;
  public_parking_night: number;
  home_rent_monthly: number;
  battery_capacity: number;
  rmb_to_mop: number;
  battery_chemistry: BatteryChemistry;
  daily_kwh_estimate: number;
  wife_mode_default: boolean;
  charging_notes: string;
  updated_at: string;
}

export interface Session {
  id: string;
  charger_type: ChargerType;
  charger_name: string;
  power_kw: number;
  tariff_mop_per_kwh: number;
  start_soc: number;
  target_soc: number;
  end_soc: number | null;
  estimated_kwh: number;
  actual_kwh: number | null;
  estimated_cost: number;
  actual_cost: number | null;
  duration_hours: number | null;
  was_night: boolean;
  had_family_parking: boolean;
  parking_was_sunk: boolean;
  logged_by: string | null;
  notes: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface Charger {
  id: string;
  name: string;
  charger_type: SavedChargerType;
  power_kw: number;
  custom_tariff_mop_per_kwh: number | null;
  location_name: string | null;
  walking_minutes: number | null;
  notes: string | null;
  reliability_rating: number | null;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
}

export interface ActiveSession {
  id: number;
  session_id: string | null;
  updated_at: string;
}

// Shape returned by /api/recommend.
export interface Recommendation {
  winner: string;
  reasoning: string;
  alternatives: string[];
  warnings: string[];
}

export type Language = "en" | "zh-Hant";
export type ThemeMode = "light" | "dark" | "system";
