-- Scavenging Tracker: skema Supabase (PostgreSQL)
-- Jalankan di Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table campaign (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dm_code text not null unique,          -- kode akses DM
  active_zone_id uuid,                   -- zona aktif saat ini
  created_at timestamptz not null default now()
);

create table item (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaign(id) on delete cascade,
  name text not null,
  slot_weight int not null default 1 check (slot_weight >= 0),
  is_wondrous boolean not null default false,
  yield_bio int not null default 0 check (yield_bio >= 0),
  yield_arcane int not null default 0 check (yield_arcane >= 0),
  yield_mech int not null default 0 check (yield_mech >= 0),
  yield_ferrous int not null default 0 check (yield_ferrous >= 0),
  description text
);
-- Item tanpa yield (semua yield = 0) tidak bisa di-breakdown dan tidak memakan slot
-- (diterapkan di logika aplikasi).

create table zone (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaign(id) on delete cascade,
  name text not null,
  dc int not null default 12
);

alter table campaign
  add constraint campaign_active_zone_fk
  foreign key (active_zone_id) references zone(id) on delete set null;

create table zone_item (
  zone_id uuid not null references zone(id) on delete cascade,
  item_id uuid not null references item(id) on delete cascade,
  weight int not null default 1 check (weight > 0),
  is_rare boolean not null default false,   -- true = pool Rare Find
  primary key (zone_id, item_id, is_rare)
);

create table character (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaign(id) on delete cascade,
  name text not null,
  access_code text not null,
  level int not null default 1 check (level between 1 and 20),
  str int not null default 10,
  dex int not null default 10,
  con int not null default 10,
  int_score int not null default 10,
  wis int not null default 10,
  cha int not null default 10,
  invest_proficient boolean not null default false,
  invest_expertise boolean not null default false,
  invest_bonus int not null default 0,
  slot_bonus int not null default 0,
  pending_exhaustion int not null default 0,
  setup_done boolean not null default false,   -- false = pemain belum mengisi stat, diarahkan ke pembuatan karakter
  unique (campaign_id, name)
);

-- Inventori dan Storage: satu tabel, dibedakan kolom location
create table holding (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references character(id) on delete cascade,
  item_id uuid not null references item(id) on delete restrict,
  location text not null check (location in ('inventory', 'storage')),
  quantity int not null default 1 check (quantity > 0),
  unique (character_id, item_id, location)
);

create table scrap (
  character_id uuid not null references character(id) on delete cascade,
  location text not null check (location in ('inventory', 'storage')),
  bio int not null default 0 check (bio >= 0),
  arcane int not null default 0 check (arcane >= 0),
  mech int not null default 0 check (mech >= 0),
  ferrous int not null default 0 check (ferrous >= 0),
  primary key (character_id, location)
);

create table scavenge_day (
  character_id uuid not null references character(id) on delete cascade,
  day date not null,                  -- tanggal dalam zona Asia/Jakarta
  used int not null default 0 check (used between 0 and 3),
  primary key (character_id, day)
);

create table log (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaign(id) on delete cascade,
  character_id uuid references character(id) on delete set null,
  kind text not null,                 -- scavenge | decision | transfer | trade | stat_edit | dm_edit
  payload jsonb not null,
  undone boolean not null default false,
  created_at timestamptz not null default now()
);

create table trade (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaign(id) on delete cascade,
  from_character uuid not null references character(id) on delete cascade,
  to_character uuid not null references character(id) on delete cascade,
  mode text not null check (mode in ('give', 'swap')),
  offer jsonb not null,               -- {items:[{item_id,qty}], scrap:{bio,arcane,mech,ferrous}}
  request jsonb,                      -- hanya untuk swap
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now()
);

create index on holding (character_id);
create index on log (campaign_id, created_at desc);
create index on trade (to_character, status);
