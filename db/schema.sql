-- Macau EV charging app — Postgres schema (Neon).
-- Access is gated by middleware; all writes go through /app/api/* routes using
-- DATABASE_URL. gen_random_uuid() is built into Postgres 13+ (no extension).
-- Run this against your Neon database via the SQL editor or psql.

-- Settings: single row, app-wide
create table settings (
  id int primary key default 1,
  nio_tariff numeric not null default 3.20,
  slow_day_tariff numeric not null default 2.29,
  slow_night_tariff numeric not null default 1.63,
  medium_tariff numeric not null default 3.03,
  quick_tariff numeric not null default 3.45,
  public_parking_day numeric not null default 6,
  public_parking_night numeric not null default 3,
  home_rent_monthly numeric not null default 2700,
  battery_capacity numeric not null default 75,
  rmb_to_mop numeric not null default 1.18,
  battery_chemistry text default 'unknown' check (battery_chemistry in ('NMC','LFP','unknown')),
  daily_kwh_estimate numeric default 2.5,
  wife_mode_default boolean default false,
  -- Free-text living context the AI reads when recommending / answering chat.
  -- Seeded with the validated heuristics; the owner can edit it in settings.
  charging_notes text not null default 'Daytime cost order, cheapest first: slow < medium < NIO < quick. Night public charging is usually dominated — prefer the NIO charger or wait for daytime, when destination parking is free. The real downside of night public is wasting the already-paid home spot plus the hassle of a night trip. Zhuhai is the cheapest by far — charge there only when crossing the border anyway. Battery health: 70-80% on daily charges, 100% only for long trips or LFP balancing.',
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);

insert into settings (id) values (1) on conflict do nothing;

-- Migration for existing databases (run once). Adding the column with this
-- default backfills the existing settings row with the seed text:
--   alter table settings add column if not exists charging_notes text not null default 'Daytime cost order, cheapest first: slow < medium < NIO < quick. Night public charging is usually dominated — prefer the NIO charger or wait for daytime, when destination parking is free. The real downside of night public is wasting the already-paid home spot plus the hassle of a night trip. Zhuhai is the cheapest by far — charge there only when crossing the border anyway. Battery health: 70-80% on daily charges, 100% only for long trips or LFP balancing.';

-- Sessions: every charging event
create table sessions (
  id uuid primary key default gen_random_uuid(),
  charger_type text not null check (charger_type in ('nio','slow','medium','quick','custom','zhuhai')),
  charger_name text not null,
  power_kw numeric not null,
  tariff_mop_per_kwh numeric not null,
  start_soc numeric not null,
  target_soc numeric not null,
  end_soc numeric,
  estimated_kwh numeric not null,
  actual_kwh numeric,
  estimated_cost numeric not null,
  actual_cost numeric,
  duration_hours numeric,
  was_night boolean not null,
  had_family_parking boolean not null,
  parking_was_sunk boolean not null,
  logged_by text,
  notes text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index sessions_started_at_idx on sessions(started_at desc);
create index sessions_completed_at_idx on sessions(completed_at desc);

-- Active session tracker (max one at a time, single row)
create table active_session (
  id int primary key default 1,
  session_id uuid references sessions(id) on delete cascade,
  updated_at timestamptz not null default now(),
  constraint single_active_row check (id = 1)
);

insert into active_session (id, session_id) values (1, null) on conflict do nothing;

-- Saved charger locations
create table chargers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  charger_type text not null check (charger_type in ('slow','medium','quick','custom','nio')),
  power_kw numeric not null,
  custom_tariff_mop_per_kwh numeric,
  location_name text,
  walking_minutes int,
  notes text,
  reliability_rating int check (reliability_rating >= 1 and reliability_rating <= 5),
  use_count int not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
