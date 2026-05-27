import {
  calculateChargingTime,
  calculateOption,
  computeDwellOptions,
  getAllOptions,
  rankDwellOptions,
  rankOptions,
  reachableSOC,
  formatTime,
  formatMOP,
  kWhToAdd,
  type ChargerOption,
  type ChargingContext,
} from "./calculations";
import type { Settings } from "./types";

const settings: Settings = {
  id: 1,
  nio_tariff: 3.2,
  slow_day_tariff: 2.29,
  slow_night_tariff: 1.63,
  medium_tariff: 3.03,
  quick_tariff: 3.45,
  public_parking_day: 6,
  public_parking_night: 3,
  home_rent_monthly: 2700,
  battery_capacity: 75,
  rmb_to_mop: 1.1,
  battery_chemistry: "unknown",
  daily_kwh_estimate: 2.5,
  wife_mode_default: false,
  charging_notes: "",
  updated_at: "2026-01-01T00:00:00Z",
};

const dayCtx: ChargingContext = {
  isNight: false,
  hasFamilyParking: true,
  parkingIsSunk: true,
};

describe("calculateChargingTime — taper", () => {
  test("slow charger is linear regardless of SOC", () => {
    const t = calculateChargingTime(7.4, 10, 50, 75, "slow-day");
    expect(t).toBeCloseTo(10 / 7.4, 2);
    // Starting near full SOC gives the same time (no taper).
    const tHigh = calculateChargingTime(7.4, 5, 90, 75, "slow-night");
    expect(tHigh).toBeCloseTo(5 / 7.4, 2);
  });

  test("NIO tapers to 50% above 95% SOC", () => {
    const linear = 7.5 / 30; // 0.25h with no taper
    const tapered = calculateChargingTime(30, 7.5, 90, 75, "nio");
    expect(tapered).toBeGreaterThan(linear);
    expect(tapered).toBeCloseTo(0.3667, 1);
  });

  test("medium tapers to 70% above 90% SOC", () => {
    const linear = 7.5 / 25; // 0.30h
    const tapered = calculateChargingTime(25, 7.5, 85, 75, "medium-day");
    expect(tapered).toBeGreaterThan(linear);
  });

  test("quick tapers in three bands", () => {
    const t = calculateChargingTime(60, 22.5, 70, 75, "quick-day");
    // 70->80 @57, 80->90 @42, 90->100 @27 ~= 0.588h
    expect(t).toBeCloseTo(0.588, 1);
    // Below 80% uses 95% of rated, faster than the high-SOC bands.
    const low = calculateChargingTime(60, 7.5, 50, 75, "quick-day");
    expect(low).toBeCloseTo(7.5 / 57, 1);
  });

  test("zero kWh needed takes no time", () => {
    expect(calculateChargingTime(30, 0, 50, 75, "nio")).toBe(0);
  });
});

describe("reachableSOC — forward taper", () => {
  test("slow charger is linear: adds power x hours", () => {
    const r = reachableSOC(7.4, 2, 50, 75, "slow-day");
    expect(r.kWhAdded).toBeCloseTo(14.8, 5);
    expect(r.endSOC).toBeCloseTo(50 + (14.8 / 75) * 100, 4);
    expect(r.timeUsed).toBeCloseTo(2, 5);
  });

  test("is the inverse of calculateChargingTime (linear)", () => {
    const r = reachableSOC(7.4, 2, 50, 75, "slow-day");
    const t = calculateChargingTime(7.4, r.kWhAdded, 50, 75, "slow-day");
    expect(t).toBeCloseTo(2, 4);
  });

  test("NIO taper above 95% adds less than rated x hours", () => {
    const r = reachableSOC(30, 0.1, 93, 75, "nio");
    // No-taper would be 30 * 0.1 = 3 kWh; taper above 95% slows it.
    expect(r.kWhAdded).toBeLessThan(3);
    expect(r.kWhAdded).toBeGreaterThan(0);
  });

  test("quick below 80% uses 95% of rated power", () => {
    const r = reachableSOC(60, 0.1, 50, 75, "quick-day");
    expect(r.kWhAdded).toBeCloseTo(60 * 0.95 * 0.1, 2);
  });

  test("caps at 100% when the time budget is generous", () => {
    const r = reachableSOC(60, 100, 10, 75, "quick-day");
    expect(r.endSOC).toBeCloseTo(100, 5);
    expect(r.kWhAdded).toBeCloseTo((90 / 100) * 75, 4);
    expect(r.timeUsed).toBeLessThan(100);
  });

  test("zero hours adds nothing", () => {
    const r = reachableSOC(30, 0, 50, 75, "nio");
    expect(r.kWhAdded).toBe(0);
    expect(r.endSOC).toBe(50);
  });
});

describe("calculateOption — cost model", () => {
  const slowOption: ChargerOption = {
    id: "slow-day",
    name: "slow public (day)",
    power: 7.4,
    tariff: settings.slow_day_tariff,
    usesPublicParking: true,
  };

  test("daytime sunk parking adds no parking cost", () => {
    const r = calculateOption(slowOption, 10, 30, settings, dayCtx);
    expect(r.parking).toBe(0);
    expect(r.homeOpp).toBe(0);
    expect(r.energy).toBeCloseTo(10 * settings.slow_day_tariff, 5);
    expect(r.total).toBeCloseTo(r.energy, 5);
  });

  test("daytime non-sunk parking is charged at the day rate", () => {
    const r = calculateOption(slowOption, 10, 30, settings, {
      isNight: false,
      hasFamilyParking: true,
      parkingIsSunk: false,
    });
    expect(r.parking).toBeCloseTo(settings.public_parking_day * r.time, 5);
  });

  test("night is more expensive than day for the same energy", () => {
    const day = calculateOption(slowOption, 10, 30, settings, dayCtx);
    const night = calculateOption(slowOption, 10, 30, settings, {
      isNight: true,
      hasFamilyParking: false,
      parkingIsSunk: true,
    });
    expect(night.total).toBeGreaterThan(day.total);
  });

  test("home opportunity cost only applies at night without family parking", () => {
    const nightNoParking = calculateOption(slowOption, 10, 30, settings, {
      isNight: true,
      hasFamilyParking: false,
      parkingIsSunk: true,
    });
    const nightWithParking = calculateOption(slowOption, 10, 30, settings, {
      isNight: true,
      hasFamilyParking: true,
      parkingIsSunk: true,
    });
    const day = calculateOption(slowOption, 10, 30, settings, dayCtx);
    expect(nightNoParking.homeOpp).toBeGreaterThan(0);
    expect(nightWithParking.homeOpp).toBe(0);
    expect(day.homeOpp).toBe(0);
    expect(nightNoParking.homeOpp).toBeCloseTo(
      (settings.home_rent_monthly / 30 / 24) * nightNoParking.time,
      5,
    );
  });

  test("NIO never incurs public parking", () => {
    const nio = getAllOptions(settings).find((o) => o.id === "nio")!;
    const r = calculateOption(nio, 10, 30, settings, {
      isNight: false,
      hasFamilyParking: true,
      parkingIsSunk: false,
    });
    expect(r.parking).toBe(0);
  });

  test("zero kWh produces zero cost and zero per-kWh", () => {
    const r = calculateOption(slowOption, 0, 100, settings, dayCtx);
    expect(r.total).toBe(0);
    expect(r.time).toBe(0);
    expect(r.mopPerKwh).toBe(0);
  });

  test("very low start SOC charges a large amount without error", () => {
    const r = calculateOption(slowOption, 60, 5, settings, dayCtx);
    expect(r.energy).toBeCloseTo(60 * settings.slow_day_tariff, 5);
    expect(r.time).toBeGreaterThan(0);
  });
});

describe("getAllOptions / rankOptions", () => {
  test("returns the 7 base options", () => {
    const opts = getAllOptions(settings);
    expect(opts).toHaveLength(7);
    expect(opts.map((o) => o.id)).toEqual([
      "nio",
      "slow-day",
      "slow-night",
      "medium-day",
      "medium-night",
      "quick-day",
      "quick-night",
    ]);
  });

  test("ranks cheapest first and filters by dwell time", () => {
    const calc = getAllOptions(settings).map((o) =>
      calculateOption(o, 20, 40, settings, {
        isNight: o.isNightOption ?? false,
        hasFamilyParking: true,
        parkingIsSunk: true,
      }),
    );
    const { feasible } = rankOptions(calc);
    for (let i = 1; i < feasible.length; i++) {
      expect(feasible[i].total).toBeGreaterThanOrEqual(feasible[i - 1].total);
    }
    // With a 0.5h dwell, slow (linear ~2.7h) must be filtered out.
    const { feasible: f2, filtered } = rankOptions(calc, 0.5);
    expect(filtered.some((o) => o.id.startsWith("slow"))).toBe(true);
    expect(f2.every((o) => o.time <= 0.5 + 1e-9)).toBe(true);
  });
});

describe("computeDwellOptions / rankDwellOptions", () => {
  const ctx: ChargingContext = {
    isNight: false,
    hasFamilyParking: true,
    parkingIsSunk: true,
  };

  test("generous dwell: every charger reaches target, cost equals charging to target", () => {
    const opts = computeDwellOptions(settings, 40, 80, 24, ctx);
    expect(opts.every((o) => o.meetsTarget)).toBe(true);
    expect(opts.every((o) => o.endSOC === 80)).toBe(true);
    const kWh = kWhToAdd(40, 80, 75);
    const nio = opts.find((o) => o.id === "nio")!;
    expect(nio.energy).toBeCloseTo(kWh * settings.nio_tariff, 4);
  });

  test("tight dwell: slow falls short of target, fast meets it", () => {
    // 40->80 is 30 kWh. Quick (60 kW @0.95) needs ~0.53h; slow (7.4 kW) needs ~4h.
    const opts = computeDwellOptions(settings, 40, 80, 0.6, ctx);
    const slow = opts.find((o) => o.id === "slow-day")!;
    const quick = opts.find((o) => o.id === "quick-day")!;
    expect(slow.meetsTarget).toBe(false);
    expect(slow.endSOC).toBeLessThan(80);
    expect(slow.endSOC).toBeGreaterThan(40);
    expect(quick.meetsTarget).toBe(true);
  });

  test("short charger only bills for the energy it actually delivers", () => {
    const opts = computeDwellOptions(settings, 40, 80, 0.5, ctx);
    const slow = opts.find((o) => o.id === "slow-day")!;
    const fullKWh = kWhToAdd(40, 80, 75);
    expect(slow.energy).toBeLessThan(fullKWh * settings.slow_day_tariff);
    expect(slow.time).toBeLessThanOrEqual(0.5 + 1e-9);
  });

  test("rankDwellOptions splits meets/short and orders short by reach", () => {
    // 2h: NIO/medium/quick reach 80%; slow (~4h) falls short.
    const opts = computeDwellOptions(settings, 40, 80, 2, ctx);
    const { meets, short } = rankDwellOptions(opts);
    expect(meets.every((o) => o.meetsTarget)).toBe(true);
    expect(short.every((o) => !o.meetsTarget)).toBe(true);
    for (let i = 1; i < short.length; i++) {
      expect(short[i].endSOC).toBeLessThanOrEqual(short[i - 1].endSOC + 1e-9);
    }
    for (let i = 1; i < meets.length; i++) {
      expect(meets[i].total).toBeGreaterThanOrEqual(meets[i - 1].total);
    }
  });
});

describe("formatters", () => {
  test("formatTime", () => {
    expect(formatTime(0.005)).toBe("< 1 min");
    expect(formatTime(0.75)).toBe("45 min");
    expect(formatTime(1 + 23 / 60)).toBe("1h 23m");
    expect(formatTime(2)).toBe("2h");
    expect(formatTime(0)).toBe("0 min");
  });

  test("formatMOP rounds to whole MOP", () => {
    expect(formatMOP(127.6)).toBe("128 MOP");
    expect(formatMOP(3.2)).toBe("3 MOP");
  });

  test("kWhToAdd", () => {
    expect(kWhToAdd(30, 80, 75)).toBeCloseTo(37.5, 5);
    expect(kWhToAdd(80, 30, 75)).toBe(0);
  });
});
