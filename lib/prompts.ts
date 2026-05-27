import type { Session, Settings } from "./types";
import type { DwellOption } from "./calculations";
import { formatMOP, formatTime } from "./calculations";

export interface CurrentState {
  currentSOC?: number;
  targetSOC?: number;
  isNight?: boolean;
  hasFamilyParking?: boolean;
  parkingIsSunk?: boolean;
  dwellHours?: number;
  goingToZhuhai?: boolean;
  wifeMode?: boolean;
}

const DOMAIN_HEURISTICS = `Decision heuristics (validated leanings, not hard rules — apply judgement):
- Nighttime PUBLIC charging is usually dominated by its daytime equivalent, because daytime destination parking is typically free (sunk) while night charging wastes the already-paid home spot and means a night trip. Lean against it by default — but it can be the right call when the user's context below supports it (e.g. cheap night tariff, family parking on so home cost is zero, or waiting for daytime isn't practical). Weigh those real trade-offs rather than excluding it outright.
- Daytime cost ordering, cheapest to most expensive: slow < medium < NIO < quick.
- Match charger speed to dwell time; prefer the slower, cheaper option when there is enough time.
- Zhuhai (~1.10 MOP/kWh) is only worthwhile when crossing the border anyway. Never make a dedicated trip just to charge.
- Battery health: aim for 70-80% on daily charges; only go to 100% for long trips or LFP balancing.`;

// The user's own living context, injected when present so the AI reasons with
// their preferences instead of a hard-coded rule.
function notesBlock(s: Settings): string {
  const notes = (s.charging_notes ?? "").trim();
  if (!notes) return "";
  return `\nUser's living context (their own notes — weight these heavily, they override the default leanings above):\n${notes}\n`;
}

function setup(settings: Settings): string {
  return `The user drives a NIO ET5T with a ${settings.battery_capacity} kWh battery in Macau. Battery chemistry: ${settings.battery_chemistry}.`;
}

function settingsBlock(s: Settings): string {
  return `Current tariffs and settings (MOP unless noted):
- NIO charger: ${s.nio_tariff} MOP/kWh, ${s.nio_power_kw} kW DC
- Slow public AC: day ${s.slow_day_tariff}, night ${s.slow_night_tariff}, ${s.slow_power_kw} kW
- Medium public DC: ${s.medium_tariff} flat 24h, ${s.medium_power_kw} kW
- Quick public DC: ${s.quick_tariff} flat 24h, ${s.quick_power_kw} kW
- Zhuhai DC: ~${(s.rmb_to_mop * 1).toFixed(2)} MOP/kWh equivalent (1 RMB/kWh x ${s.rmb_to_mop} RMB->MOP)
- Public parking: ${s.public_parking_day}/hr day, ${s.public_parking_night}/hr night
- Home rent: ${s.home_rent_monthly}/month`;
}

function summarizeSessions(sessions: Session[], limit: number): string {
  const completed = sessions
    .filter((s) => s.completed_at)
    .slice(0, limit);
  if (completed.length === 0) return "No completed sessions yet.";
  const lines = completed.map((s) => {
    const date = (s.completed_at ?? s.started_at).slice(0, 10);
    const kwh = s.actual_kwh ?? s.estimated_kwh;
    const cost = s.actual_cost ?? s.estimated_cost;
    const variance =
      s.actual_cost != null
        ? ` (est ${formatMOP(s.estimated_cost)}, var ${formatMOP(
            s.actual_cost - s.estimated_cost,
          )})`
        : "";
    return `- ${date}: ${s.charger_name}, ${kwh.toFixed(1)} kWh, ${formatMOP(
      cost,
    )}${variance}`;
  });
  return `Recent sessions:\n${lines.join("\n")}`;
}

function stateBlock(state: CurrentState): string {
  const parts: string[] = [];
  if (state.currentSOC != null) parts.push(`current SOC ${state.currentSOC}%`);
  if (state.targetSOC != null) parts.push(`target SOC ${state.targetSOC}%`);
  parts.push(state.isNight ? "it is night" : "it is daytime");
  if (state.hasFamilyParking != null)
    parts.push(
      state.hasFamilyParking ? "family parking available" : "no family parking",
    );
  if (state.parkingIsSunk) parts.push("at a destination (parking is sunk)");
  if (state.dwellHours != null) parts.push(`dwell time ${state.dwellHours}h`);
  if (state.goingToZhuhai) parts.push("planning a Zhuhai trip");
  return `Current situation: ${parts.join(", ")}.`;
}

export function buildChatSystemPrompt(
  settings: Settings,
  recentSessions: Session[],
  currentState: CurrentState,
): string {
  const wife = currentState.wifeMode
    ? "\nWIFE MODE: answer in ONE short sentence. No breakdowns, no tables, no lists."
    : "";
  return `You are a charging assistant for one couple in Macau. ${setup(
    settings,
  )}

${settingsBlock(settings)}

${summarizeSessions(recentSessions, 10)}

${stateBlock(currentState)}

${DOMAIN_HEURISTICS}
${notesBlock(settings)}
Answer briefly and specifically. Always cite concrete MOP amounts and kWh when relevant. Do not hedge. Markdown is allowed but keep it tight. Never invent tariffs — use the values above.${wife}`;
}

export function buildRecommendSystemPrompt(
  settings: Settings,
  computedOptions: DwellOption[],
  recentSessions: Session[],
  targetSOC: number,
): string {
  const optionLines = computedOptions
    .map((o) => {
      const reach = o.meetsTarget
        ? `reaches target ${targetSOC}%`
        : `reaches only ${Math.round(o.endSOC)}% in the time parked (target ${targetSOC}%)`;
      return `- id="${o.id}" ${o.name}: ${reach}, ${formatMOP(o.total)} total, ${formatTime(
        o.time,
      )}, ${o.mopPerKwh.toFixed(2)} MOP/kWh effective`;
    })
    .join("\n");

  return `You are a charging assistant for one couple in Macau. ${setup(
    settings,
  )}

These options were already computed deterministically for the time the car will be parked. Each line shows the SOC actually reached in that window and the cost of the energy delivered (energy + parking + home opportunity cost). Pick the best one and call the select_recommendation tool.

Computed options:
${optionLines}

${summarizeSessions(recentSessions, 5)}

${DOMAIN_HEURISTICS}
${notesBlock(settings)}
Rules:
- The winner_option_id MUST be one of the ids listed above.
- Prefer the cheapest option that REACHES the target within the time parked. If none reach it, pick the best value and warn that it falls short (state the % it reaches). Use the heuristics and the user's context to break ties.
- reasoning must be under 200 characters, specific, and cite the MOP amount.
- warnings: note battery-health concerns (target >90% or =100%, very low SOC) or if the pick won't reach the target in time.
- alternatives_worth_mentioning: other ids worth a glance.`;
}

export function buildRefineSettingsPrompt(
  settings: Settings,
  recentSessions: Session[],
): string {
  return `You are analysing charging history to detect whether the stored tariffs/settings have drifted from reality. ${setup(
    settings,
  )}

${settingsBlock(settings)}

${summarizeSessions(recentSessions, 20)}

For each setting where the actual costs consistently diverge from the estimates, propose an update. Only propose a change when there is real evidence (multiple sessions, consistent direction). Return JSON with a "proposals" array; each item: { "field": <settings field name>, "currentValue": <number>, "suggestedValue": <number>, "evidence": <one sentence>, "confidence": "low"|"medium"|"high" }. If nothing should change, return an empty array. Use exact settings field names: nio_tariff, slow_day_tariff, slow_night_tariff, medium_tariff, quick_tariff, nio_power_kw, slow_power_kw, medium_power_kw, quick_power_kw, public_parking_day, public_parking_night, home_rent_monthly, battery_capacity, rmb_to_mop, no_target_cheap_premium, daily_kwh_estimate.`;
}
