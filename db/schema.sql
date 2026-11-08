-- Jugendraum-Portal SV Heepen: Datenbankschema (PostgreSQL 15+, z. B. Supabase Region Frankfurt)
-- Idempotent: kann mehrfach ausgeführt werden (npm run db:migrate).

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

create table if not exists categories (
  id                 text primary key,
  name               text not null,
  hint               text not null default '',
  color              text not null,
  buffer_before_min  int  not null default 15 check (buffer_before_min >= 0),
  buffer_after_min   int  not null default 15 check (buffer_after_min >= 0),
  requires_approval  boolean not null default true,
  is_party           boolean not null default false,
  max_duration_min   int  not null default 360,
  sort               int  not null default 0
);

create table if not exists settings (
  key   text primary key,
  value jsonb not null
);

do $$ begin
  create type booking_status as enum ('pending_email', 'requested', 'confirmed', 'rejected', 'cancelled', 'expired');
exception when duplicate_object then null; end $$;

create sequence if not exists booking_no_seq;

create table if not exists bookings (
  id              uuid primary key default gen_random_uuid(),
  number          text not null unique default ('JR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('booking_no_seq')::text, 4, '0')),
  status          booking_status not null default 'pending_email',
  category_id     text not null references categories(id),
  title           text not null,
  note            text not null default '',
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  guests          int not null default 1,
  booker_type     text not null check (booker_type in ('member', 'external')),
  team            text not null default '',
  name            text not null,
  email           text not null,
  phone           text not null,
  agreed_with     text not null,
  -- Freitag des Party-Wochenendes, nur bei Partys gesetzt (Berechnung in lib/rules.ts)
  party_weekend   date,
  manage_token    text not null unique,
  verify_token    text unique,
  reject_reason   text,
  internal_note   text not null default '',
  key_handed_out  boolean not null default false,
  deposit_paid    boolean not null default false,
  decided_by      text,
  decided_at      timestamptz,
  verified_at     timestamptz,
  reminded_3d_at  timestamptz,
  reminded_1d_at  timestamptz,
  followup_at     timestamptz,
  created_at      timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- Harte Garantie 1: keine zwei aktiven Buchungen mit überlappender Kernzeit.
-- (Die Puffer-Regel "größerer Puffer zählt" prüft die App in einer gesperrten Transaktion.)
do $$ begin
  alter table bookings add constraint bookings_no_overlap
    exclude using gist (tstzrange(starts_at, ends_at) with &&)
    where (status in ('pending_email', 'requested', 'confirmed'));
exception when duplicate_object or duplicate_table then null; end $$;

-- Harte Garantie 2: höchstens eine aktive Party pro Wochenende.
create unique index if not exists bookings_one_party_per_weekend
  on bookings (party_weekend)
  where party_weekend is not null and status in ('pending_email', 'requested', 'confirmed');

create index if not exists bookings_starts_at on bookings (starts_at);

create table if not exists blackouts (
  id         uuid primary key default gen_random_uuid(),
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  reason     text not null,
  created_by text,
  check (ends_at > starts_at)
);

create table if not exists admins (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  name       text not null,
  role       text not null default 'manager' check (role in ('admin', 'manager', 'viewer')),
  notify     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists login_tokens (
  token_hash text primary key,
  admin_id   uuid not null references admins(id) on delete cascade,
  expires_at timestamptz not null,
  used_at    timestamptz
);

create table if not exists audit_log (
  id         bigserial primary key,
  actor      text not null,
  booking_id uuid references bookings(id) on delete set null,
  action     text not null,
  detail     jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists mail_log (
  id         bigserial primary key,
  kind       text not null,
  recipient  text not null,
  subject    text not null,
  booking_id uuid references bookings(id) on delete set null,
  ok         boolean not null,
  error      text,
  created_at timestamptz not null default now()
);

-- Startwerte (werden nicht überschrieben, wenn schon vorhanden)
insert into categories (id, name, hint, color, buffer_before_min, buffer_after_min, requires_approval, is_party, max_duration_min, sort) values
  ('meet',  'Besprechung',          'Trainer, Vorstand',     '#5B67C9',  15,  15, false, false,  360, 1),
  ('team',  'Mannschaftssitzung',   'Teamabend',             '#1F8FA3',  15,  30, false, false,  360, 2),
  ('event', 'Vereinsveranstaltung', 'Elternabend, Ehrung',   '#2E367A',  60,  60, true,  false,  480, 3),
  ('work',  'Workshop / Schulung',  'Erste Hilfe, Lizenz',   '#7A5BC9',  30,  30, true,  false,  600, 4),
  ('party', 'Party / Feier',        'Geburtstag, Abschluss', '#FFD800', 120, 180, true,  true,   960, 5),
  ('misc',  'Sonstiges',            'alles andere',          '#7A80A6',  30,  30, true,  false,  360, 6)
on conflict (id) do nothing;

insert into settings (key, value) values
  ('partyBlocksWholeWeekend', 'false'),
  ('partyMinLeadDays', '14'),
  ('minLeadHours', '24'),
  ('horizonDays', '270'),
  ('capacity', '40'),
  ('partyLatestEnd', '"01:00"'),
  ('weekendFromHour', '12'),
  ('weekendUntilHour', '6')
on conflict (key) do nothing;

-- Supabase: Zugriff nur über den Server (Service-Verbindung). Öffentliche Rollen sehen nichts.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'alter table bookings enable row level security';
    execute 'alter table admins enable row level security';
    execute 'alter table login_tokens enable row level security';
    execute 'alter table audit_log enable row level security';
    execute 'alter table mail_log enable row level security';
    execute 'alter table blackouts enable row level security';
    execute 'alter table categories enable row level security';
    execute 'alter table settings enable row level security';
  end if;
end $$;
