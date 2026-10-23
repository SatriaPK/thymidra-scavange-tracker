-- Fitur karakter yang diatur pemain. Jalankan di Supabase SQL Editor SEBELUM kode baru dipakai.
-- Aman: hanya menambah dua kolom dengan default false; data karakter yang ada tidak berubah.
alter table character add column if not exists feature_double_slots boolean not null default false;
alter table character add column if not exists feature_reroll_nat1 boolean not null default false;
