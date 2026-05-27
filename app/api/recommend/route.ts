import { NextResponse } from "next/server";
import { one, query } from "@/lib/db";
import { getOpenAI, OPENAI_MODEL } from "@/lib/openai";
import { buildRecommendSystemPrompt } from "@/lib/prompts";
import {
  computeDwellOptions,
  kWhToAdd,
  rankDwellOptions,
  formatMOP,
  type ChargingContext,
  type ExtraOptions,
} from "@/lib/calculations";
import type { Recommendation, Session, Settings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    currentSOC?: number;
    targetSOC?: number;
    context?: ChargingContext;
    extras?: ExtraOptions;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const currentSOC = Number(body.currentSOC ?? 0);
  const targetSOC = Number(body.targetSOC ?? 0);
  const ctx: ChargingContext = {
    isNight: Boolean(body.context?.isNight),
    hasFamilyParking: Boolean(body.context?.hasFamilyParking),
    parkingIsSunk: Boolean(body.context?.parkingIsSunk),
    dwellHours: body.context?.dwellHours,
  };

  const [settings, sessions] = await Promise.all([
    one<Settings>("select * from settings where id = 1"),
    query<Session>("select * from sessions order by started_at desc limit 10"),
  ]);

  if (!settings) {
    return NextResponse.json({ error: "settings not found" }, { status: 500 });
  }
  const s = settings;
  const kWhNeeded = kWhToAdd(currentSOC, targetSOC, s.battery_capacity);
  // Blank dwell means "time isn't a constraint" — use a very large window so
  // every charger reaches target and ranking falls back to pure cost.
  const dwellHours =
    ctx.dwellHours != null && ctx.dwellHours > 0 ? ctx.dwellHours : 1e6;
  const all = computeDwellOptions(s, currentSOC, targetSOC, dwellHours, ctx, body.extras);
  // Same ordering the Decide tab shows: target-reaching options first (cheapest
  // first), then the ones that fall short by how close they get.
  const { meets, short } = rankDwellOptions(all);
  const pool = [...meets, ...short];

  // No hard exclusions: the model weighs the soft night-public leaning and the
  // user's editable charging_notes (both in the prompt) and decides for itself.
  // Deterministic fallback: cheapest option that reaches target, else closest.
  const cheapest = pool[0];
  const fallback: Recommendation = {
    winner: cheapest?.id ?? "nio",
    reasoning: cheapest
      ? cheapest.meetsTarget
        ? `${cheapest.name} at ${formatMOP(cheapest.total)} reaches your target cheapest.`
        : `${cheapest.name} gets closest — ~${Math.round(cheapest.endSOC)}% at ${formatMOP(cheapest.total)}.`
      : "no options available",
    alternatives: pool.slice(1, 3).map((o) => o.id),
    warnings: buildWarnings(currentSOC, targetSOC),
  };

  try {
    const openai = getOpenAI();
    const system = buildRecommendSystemPrompt(s, pool, sessions, targetSOC);
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: 400,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content:
            ctx.dwellHours != null && ctx.dwellHours > 0
              ? `Pick the best option for charging from ${currentSOC}% to ${targetSOC}% (${kWhNeeded.toFixed(
                  1,
                )} kWh) with about ${ctx.dwellHours}h parked.`
              : `Pick the best option for charging from ${currentSOC}% to ${targetSOC}% (${kWhNeeded.toFixed(
                  1,
                )} kWh); time is not a constraint.`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "select_recommendation",
            description: "Select the recommended charging option.",
            parameters: {
              type: "object",
              properties: {
                winner_option_id: { type: "string" },
                reasoning: { type: "string" },
                warnings: { type: "array", items: { type: "string" } },
                alternatives_worth_mentioning: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              required: ["winner_option_id", "reasoning"],
            },
          },
        },
      ],
      tool_choice: {
        type: "function",
        function: { name: "select_recommendation" },
      },
    });

    const call = completion.choices[0]?.message?.tool_calls?.[0];
    if (!call) return NextResponse.json(fallback);

    const args = JSON.parse(call.function.arguments) as {
      winner_option_id: string;
      reasoning: string;
      warnings?: string[];
      alternatives_worth_mentioning?: string[];
    };

    const validIds = new Set(all.map((o) => o.id));
    const winner = validIds.has(args.winner_option_id)
      ? args.winner_option_id
      : fallback.winner;

    const result: Recommendation = {
      winner,
      reasoning: (args.reasoning ?? fallback.reasoning).slice(0, 200),
      alternatives: (args.alternatives_worth_mentioning ?? []).filter((id) =>
        validIds.has(id),
      ),
      warnings: [
        ...new Set([...(args.warnings ?? []), ...buildWarnings(currentSOC, targetSOC)]),
      ],
    };
    return NextResponse.json(result);
  } catch {
    // OpenAI unavailable — return the deterministic recommendation.
    return NextResponse.json(fallback);
  }
}

function buildWarnings(currentSOC: number, targetSOC: number): string[] {
  const w: string[] = [];
  if (targetSOC >= 100) {
    w.push("100% is for long trips or LFP balancing only");
  } else if (targetSOC > 90) {
    w.push("charging above 90% adds wear");
  }
  if (currentSOC < 15) w.push("very low SOC — charge soon");
  return w;
}
