# Macau EV

A mobile-first web app for deciding **where and when to charge a NIO ET5T (75 kWh) in Macau**. It optimises for cost, time, and battery health, logs charging sessions, and predicts when the next charge is due. A single shared password gates access — it is meant to be shared between two people, with all data shared (no user accounts).

## Tech stack

- Next.js 14 (App Router) + TypeScript (strict)
- Tailwind CSS
- Neon serverless Postgres (database only)
- OpenAI Node SDK (`gpt-4o-mini`) for the smart layer
- lucide-react icons, date-fns
- Deploys to the Vercel free tier

## Features

- **Decide** — current/target SOC sliders, day/night and parking context, custom station (MOP or RMB), Zhuhai option. Computes all charging options with taper-aware time and a full cost model, ranks them cheapest-first, filters by dwell time, and highlights the winner. Battery-health warnings. A natural-language ask box answers trip questions.
- **Session** — live timer, animated SOC progress, ETA, accruing cost; complete flow records actual end SOC / kWh and prompts a reliability rating.
- **History** — totals (sessions, spend, kWh, avg MOP/kWh), date-range filter, per-session detail with editable notes and delete, monthly trend, savings vs petrol, and an AI "why are costs different?" insight.
- **Predict** — average kWh/session, days between charges, implied daily use, and "next charge by" date from the last 30 days.
- **Smart layer** — `/api/chat`, `/api/recommend` (deterministic compute + function-calling pick, with a deterministic fallback), and `/api/refine-settings` (proposes tariff updates from estimate-vs-actual variance).
- **Polish** — PWA (installable, offline shell), wife mode (one-sentence recommendation), saved charger database, tariff-drift banner, English / Traditional Chinese, and light/dark/system themes.

## Auth model

Single shared password in `APP_PASSWORD`. `/api/login` does a constant-time compare and sets an HMAC-SHA256 signed, httpOnly cookie (signed with `COOKIE_SECRET`). `middleware.ts` protects every route except `/login`, `/api/login`, and static assets. All database access happens in `/app/api/*` routes (and the server-rendered page) using `DATABASE_URL`, which is never exposed to the client.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a Neon project and run the schema in `db/schema.sql` (Neon SQL editor or `psql`). It seeds the single settings row and the active-session tracker.
3. Copy the env template and fill it in:
   ```bash
   cp .env.local.example .env.local
   ```
   - `APP_PASSWORD` — the shared password
   - `COOKIE_SECRET` — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `DATABASE_URL` — the Neon **pooled** connection string (from the Neon dashboard)
   - `OPENAI_API_KEY` — for the chat / recommend / refine endpoints
4. Run it:
   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` — local dev server
- `npm run build` / `npm start` — production build and serve
- `npm test` — Jest unit tests for the calculation library
- `npm run typecheck` — `tsc --noEmit`

## Deploying to Vercel

Import the repo, set the four environment variables above in the Vercel project (or use the Neon–Vercel integration, which injects `DATABASE_URL` automatically), and deploy. The app is fully serverless and fits the free tier.

## Cost model (summary)

- Energy = kWh × tariff.
- Daytime public parking is treated as sunk (0) when you are at a destination you would visit anyway; otherwise charged at the day rate.
- Night public parking is charged at the night rate.
- Home opportunity cost ((rent / 30 / 24) × hours) applies only at night without family parking.
- Charging time integrates the per-charger power taper in 0.5 kWh steps.

See `lib/calculations.ts` and its tests in `lib/calculations.test.ts`.
