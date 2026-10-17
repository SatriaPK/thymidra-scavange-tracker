-- Jalankan SEKALI di Supabase SQL Editor, setelah schema.sql.
-- Menyalakan Row Level Security di semua tabel TANPA policy.
-- Akibatnya publishable key (yang terlihat di browser) tidak bisa membaca atau menulis apa pun.
-- App hanya mengakses database lewat SUPABASE_SECRET_KEY di server, yang melewati RLS.

alter table campaign     enable row level security;
alter table item         enable row level security;
alter table zone         enable row level security;
alter table zone_item    enable row level security;
alter table character    enable row level security;
alter table holding      enable row level security;
alter table scrap        enable row level security;
alter table scavenge_day enable row level security;
alter table log          enable row level security;
alter table trade        enable row level security;
