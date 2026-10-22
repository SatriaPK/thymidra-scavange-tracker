-- Migrasi Crafting. Jalankan SEKALI di Supabase SQL Editor (aman diulang: memakai IF NOT EXISTS).
-- Berdiri sendiri: tidak bergantung pada isi schema.sql di repo.

-- 1. Kategori item baru "Crafted": memakan slot, tanpa yield, tidak bisa di-breakdown.
alter table item add column if not exists is_crafted boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'item_not_wondrous_and_crafted') then
    alter table item add constraint item_not_wondrous_and_crafted check (not (is_wondrous and is_crafted));
  end if;
end $$;

-- 2. Resep crafting (dibuat DM). Bahan = scrap per jenis (kolom ing_*) + item per ID (tabel recipe_item).
create table if not exists recipe (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaign(id) on delete cascade,
  recipe_no int not null,                         -- ID tampilan: R001, R002, ...
  name text not null,
  description text,
  min_level int not null default 1 check (min_level between 1 and 20),
  enabled boolean not null default true,
  output_item_id uuid not null references item(id) on delete restrict,
  output_qty int not null default 1 check (output_qty between 1 and 99),
  ing_bio int not null default 0 check (ing_bio >= 0),
  ing_arcane int not null default 0 check (ing_arcane >= 0),
  ing_mech int not null default 0 check (ing_mech >= 0),
  ing_ferrous int not null default 0 check (ing_ferrous >= 0),
  unique (campaign_id, recipe_no)
);

create table if not exists recipe_item (
  recipe_id uuid not null references recipe(id) on delete cascade,
  item_id uuid not null references item(id) on delete restrict,
  qty int not null check (qty between 1 and 99),
  primary key (recipe_id, item_id)
);

-- item memakai "on delete restrict": item yang dipakai resep (bahan atau hasil) tidak bisa dihapus
-- sebelum resepnya diubah atau dihapus.

create index if not exists recipe_campaign_idx on recipe (campaign_id);

-- 3. Row Level Security, sama seperti tabel lain (tanpa policy: hanya server yang bisa mengakses).
alter table recipe      enable row level security;
alter table recipe_item enable row level security;
