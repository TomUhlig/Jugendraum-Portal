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
  ('meet',  'Besprechung',          'Trainer, Vorstand',     '#2A78D6',  15,  15, false, false,  360, 1),
  ('team',  'Mannschaftssitzung',   'Teamabend',             '#1BAF7A',  15,  30, false, false,  360, 2),
  ('event', 'Vereinsveranstaltung', 'Elternabend, Ehrung',   '#EB6834',  60,  60, true,  false,  480, 3),
  ('work',  'Workshop / Schulung',  'Erste Hilfe, Lizenz',   '#6250D6',  30,  30, true,  false,  600, 4),
  ('party', 'Feier / Party',        'Geburtstag, Abschluss', '#EDA100', 120, 180, true,  true,   960, 5),
  ('misc',  'Sonstiges',            'alles andere',          '#E87BA4',  30,  30, true,  false,  360, 6)
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

-- ---------- Version 2: Ausstattung, Serien, Kosten, Übergabe, Feedback ----------
alter table bookings add column if not exists equipment       text[] not null default '{}';
alter table bookings add column if not exists series_id       uuid;
alter table bookings add column if not exists created_by      text;            -- Admin, der direkt eingetragen hat
alter table bookings add column if not exists rent_eur        numeric(8,2) not null default 0;
alter table bookings add column if not exists deposit_eur     numeric(8,2) not null default 0;
alter table bookings add column if not exists rent_paid       boolean not null default false;
alter table bookings add column if not exists deposit_returned boolean not null default false;
alter table bookings add column if not exists deposit_withheld_eur numeric(8,2) not null default 0;
alter table bookings add column if not exists handover_at     timestamptz;
alter table bookings add column if not exists handover_by     text;
alter table bookings add column if not exists meter_start     numeric(10,1);
alter table bookings add column if not exists return_at       timestamptz;
alter table bookings add column if not exists return_by       text;
alter table bookings add column if not exists meter_end       numeric(10,1);
alter table bookings add column if not exists condition_ok    boolean;
alter table bookings add column if not exists damage_note     text not null default '';
alter table bookings add column if not exists changed_notice_at timestamptz;

create table if not exists series (
  id          uuid primary key default gen_random_uuid(),
  rule        text not null,
  created_by  text not null,
  created_at  timestamptz not null default now()
);

create table if not exists feedback (
  booking_id  uuid primary key references bookings(id) on delete cascade,
  rating      int not null check (rating between 1 and 5),
  comment     text not null default '',
  damage      boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Neue Standardfarben (farbenblind-geprüft) nur übernehmen, wenn noch die alten Werte gesetzt sind
update categories set color = v.new from (values
  ('meet', '#5B67C9', '#2A78D6'), ('team', '#1F8FA3', '#1BAF7A'), ('event', '#2E367A', '#EB6834'),
  ('work', '#7A5BC9', '#6250D6'), ('party', '#FFD800', '#EDA100'), ('misc', '#7A80A6', '#E87BA4')
) as v(id, old, new) where categories.id = v.id and categories.color = v.old;
update categories set name = 'Feier / Party' where id = 'party' and name = 'Party / Feier';

insert into settings (key, value) values
  ('equipment', '["Beamer & Leinwand", "Musikanlage", "Küche", "Kühlschrank", "Grill (draußen)", "Bierzeltgarnituren"]'),
  ('feesExternal', '{"rent": 0, "deposit": 0}'),
  ('feesMemberParty', '{"rent": 0, "deposit": 0}'),
  ('mailTexts', '{}'),
  ('contactNote', '"Fragen vorab? Michael Grieswelle oder Sigrid Brodig helfen dir weiter."')
on conflict (key) do nothing;

-- ---------- Version 3: stille Buchungen, Sperrzeiten nur für Feiern ----------
alter table bookings add column if not exists silent boolean not null default false;  -- keine automatischen Mails an den Bucher
alter table blackouts add column if not exists scope text not null default 'all';
do $$ begin
  alter table blackouts add constraint blackouts_scope check (scope in ('all', 'party'));
exception when duplicate_object then null; end $$;

-- ---------- Version 4: regelmäßige Sperren ----------
create table if not exists recurring_blocks (
  id          uuid primary key default gen_random_uuid(),
  weekdays    int[] not null,                -- 0 = Sonntag … 6 = Samstag
  from_time   text,                          -- "HH:MM", leer = ganztägig
  to_time     text,
  scope       text not null default 'all' check (scope in ('all', 'party')),
  reason      text not null,
  valid_from  date,
  valid_until date,
  created_by  text,
  created_at  timestamptz not null default now()
);

-- ---------- Version 5: Warteliste ----------
create table if not exists waitlist (
  id          uuid primary key default gen_random_uuid(),
  token       text not null unique,
  category_id text not null references categories(id),
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  name        text not null,
  email       text not null,
  notified_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists waitlist_starts_at on waitlist (starts_at) where notified_at is null;

-- ---------- Version 6: Zahlungen ----------
create table if not exists payments (
  id                uuid primary key default gen_random_uuid(),
  booking_id        uuid not null references bookings(id) on delete cascade,
  provider          text not null check (provider in ('stripe', 'manual')),
  amount_eur        numeric(8,2) not null,
  parts             text[] not null default '{}',   -- 'rent', 'deposit'
  status            text not null default 'open' check (status in ('open', 'paid', 'failed', 'refunded', 'partially_refunded')),
  stripe_session_id text unique,
  stripe_intent_id  text,
  refunded_eur      numeric(8,2) not null default 0,
  paid_at           timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists payments_booking on payments (booking_id);
insert into settings (key, value) values ('payment', '{}') on conflict (key) do nothing;

-- ---------- Version 7: Nachrichten an der Buchung ----------
create table if not exists messages (
  id           bigserial primary key,
  booking_id   uuid not null references bookings(id) on delete cascade,
  author_type  text not null check (author_type in ('booker', 'team')),
  author_name  text not null,
  body         text not null,
  team_read_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists messages_booking on messages (booking_id, created_at);

-- ---------- Version 8: Fotos vom Raum ----------
create table if not exists photos (
  id         uuid primary key default gen_random_uuid(),
  full_data  bytea not null,     -- max. 1600 px, JPEG
  thumb_data bytea not null,     -- max. 640 px, JPEG
  width      int not null,
  height     int not null,
  caption    text not null default '',
  sort       int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Version 9: Push-Benachrichtigungen ----------
create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid not null references admins(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  device     text not null default '',
  created_at timestamptz not null default now()
);

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
    execute 'alter table series enable row level security';
    execute 'alter table feedback enable row level security';
    execute 'alter table recurring_blocks enable row level security';
    execute 'alter table waitlist enable row level security';
    execute 'alter table payments enable row level security';
    execute 'alter table messages enable row level security';
    execute 'alter table photos enable row level security';
    execute 'alter table push_subscriptions enable row level security';
  end if;
end $$;
