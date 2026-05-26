# Handoff — Macau EV charging app

Continuing an existing, already-deployed project: a Macau EV charging decision web
app (for a couple to decide where/when to charge a NIO ET5T 75 kWh). It is built
and live — this is a mid-stream handoff. Read this fully before making changes.

## Project facts
- Stack: Next.js 14 (App Router), TypeScript (strict), Tailwind, Neon Postgres via
  `@neondatabase/serverless`, OpenAI `gpt-4o-mini`, lucide-react, date-fns.
- Latest code is on `main`. Production is on Vercel, auto-deploying from `main`.
  There is also a branch `claude/lucid-hypatia-MLTPH` and a draft PR #1.
- Run: `npm install`, then `npm run dev` (localhost:3000). Tests: `npm test`
  (Jest, lib/calculations.test.ts). Also `npm run typecheck` and `npm run build`.
  Keep all three green.
- Env (.env.local, gitignored): APP_PASSWORD, COOKIE_SECRET, DATABASE_URL (Neon
  pooled), OPENAI_API_KEY. The same Neon DB is shared by local dev and prod.
- Auth: single shared password, HMAC-signed httpOnly cookie; middleware.ts
  protects routes. No user accounts; all data shared.

## Key files
- lib/calculations.ts — pure cost/time model with per-charger power taper
  (integrated in 0.5 kWh steps), `computeOptions`, `rankOptions`, formatters.
  Unit-tested.
- lib/db.ts — Neon helpers: `query`, `one`, `buildSet`. Numeric columns parsed
  to JS numbers.
- lib/prompts.ts — system prompts for the 3 AI endpoints. lib/i18n.ts — EN /
  Traditional Chinese labels.
- app/api/* — login, logout, settings (GET/PUT), sessions, active-session,
  chargers, chat, recommend, refine-settings. All `runtime="nodejs"`.
- components/tabs/{DecideTab,SessionTab,HistoryTab,PredictTab}.tsx,
  components/AppContext.tsx (global state), SettingsModal.tsx,
  RecommendationCard.tsx, OptionRow.tsx, AskBox.tsx, SessionTimer.tsx, ui.tsx.
- db/schema.sql — single `settings` row, `sessions`, `active_session`,
  `chargers`. Run it in Neon to (re)create tables.

## Domain model (the validated analyses — important context)
- Battery: NIO ET5T, 75 kWh. Macau.
- Tariffs (MOP/kWh): NIO 3.20; slow public day 2.29 / night 1.63; medium 3.03;
  quick 3.45; Zhuhai ≈ 1 RMB/kWh × rmb_to_mop (rmb_to_mop is now 1.18 — note:
  schema default is 1.18 but the live DB row may still be 1.10; check
  `select rmb_to_mop from settings`).
- Public parking: 6 MOP/hr day (08–20), 3 MOP/hr night (20–08). Home rent
  2700/mo, already paid (sunk). Family parking available ~90% of nights.
- Cost model (calculations.ts): total = energy + applicable parking + applicable
  home opportunity cost. Daytime public parking = 0 when "at destination"
  (sunk); night public parking is real; home opportunity cost =
  (rent/30/24)×hours applies ONLY at night AND when no family parking. Don't
  break the existing tests when changing this.
- Heuristics: daytime cost order slow < medium < NIO < quick. At night, public
  charging is generally dominated — usually better to use the NIO charger or
  wait for daytime (when destination parking is free). Battery health: 70–80%
  daily, 100% only for long trips / LFP balancing.
- Zhuhai is almost always cheapest by far — treat it as a STANDING VERDICT ("if
  crossing the border, charge in China"), not a competitor in the local ranking.

## Open issue to fix
The recommendation currently HARD-EXCLUDES nighttime public charging from ever
winning (see the `recommendable` / `isNightPublic` logic in
app/api/recommend/route.ts and components/tabs/DecideTab.tsx). The owner does NOT
want a blunt ban — the recommender should have richer context and decide
intelligently (night public can win when it genuinely makes sense). The raw
reason night public looked cheapest: low night tariff + home-opportunity-cost
being zero when family parking is on; the real downside is wasting the
already-paid home spot and the hassle of a night trip.

## The redesign to build (agreed with the owner)
1. Reframe the Decide tab around the real decision: inputs = current SOC + how
   long parked (dwell time) + target SOC → output = WHICH CHARGER, and show the
   % actually reachable in that window plus the cost. Needs a NEW calc:
   "reachable SOC given charger power + available hours + start SOC + taper"
   (forward-integrate the existing taper logic). Add unit tests.
2. Add a focused "Is this charger worth it?" mode: enter a charger's power +
   price (MOP or RMB) → clear verdict + the % reached.
3. Replace the hard night-public ban with an EDITABLE CONTEXT mechanism: add a
   `charging_notes` text column to `settings` (+ note in db/schema.sql), a
   textarea to edit it in SettingsModal, and inject those notes into the chat +
   recommend prompts so the AI reasons with the owner's living context.
4. Zhuhai: remove from the local ranked comparison; show as a standing side note
   ("crossing to Zhuhai? charge there, ~X MOP/kWh — cheapest by far").
5. Drop the trivial "just trickle-charge a bit" framing. Keep the simple/detailed
   mode toggle (heart icon).
6. Keep "when must I charge next?" on the Predict tab as-is (don't remove it).

Start by reading lib/calculations.ts, components/tabs/DecideTab.tsx,
app/api/recommend/route.ts, and lib/prompts.ts, then propose a concrete plan for
#1 and #3 before writing code. Commit in small steps and push to `main` (Vercel
auto-deploys).
