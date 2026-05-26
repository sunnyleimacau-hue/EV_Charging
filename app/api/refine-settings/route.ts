import { NextResponse } from "next/server";
import { one, query } from "@/lib/db";
import { getOpenAI, OPENAI_MODEL } from "@/lib/openai";
import { buildRefineSettingsPrompt } from "@/lib/prompts";
import type { Session, Settings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Proposal {
  field: string;
  currentValue: number;
  suggestedValue: number;
  evidence: string;
  confidence: "low" | "medium" | "high";
}

const VALID_FIELDS = new Set([
  "nio_tariff",
  "slow_day_tariff",
  "slow_night_tariff",
  "medium_tariff",
  "quick_tariff",
  "public_parking_day",
  "public_parking_night",
  "home_rent_monthly",
  "battery_capacity",
  "rmb_to_mop",
  "daily_kwh_estimate",
]);

export async function POST() {
  const [settings, history] = await Promise.all([
    one<Settings>("select * from settings where id = 1"),
    query<Session>(
      "select * from sessions where actual_cost is not null order by started_at desc limit 20",
    ),
  ]);

  if (!settings) {
    return NextResponse.json({ proposals: [] });
  }
  const s = settings;

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: 600,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildRefineSettingsPrompt(s, history) },
        {
          role: "user",
          content:
            'Return {"proposals": [...]} with any well-evidenced setting updates.',
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { proposals?: Proposal[] };
    const proposals = (parsed.proposals ?? [])
      .filter(
        (p) =>
          VALID_FIELDS.has(p.field) &&
          Number.isFinite(Number(p.suggestedValue)),
      )
      .map((p) => ({
        field: p.field,
        currentValue: Number((s as unknown as Record<string, number>)[p.field]),
        suggestedValue: Number(p.suggestedValue),
        evidence: String(p.evidence ?? ""),
        confidence: ["low", "medium", "high"].includes(p.confidence)
          ? p.confidence
          : "low",
      }));

    return NextResponse.json({ proposals });
  } catch {
    return NextResponse.json({ proposals: [] });
  }
}
