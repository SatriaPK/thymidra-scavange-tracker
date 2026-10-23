-- Izin impor dari kertas: DM membuka sekali per karakter; setelah pemain mengirim impornya, izin menutup otomatis.
-- Jalankan di Supabase SQL Editor SEBELUM kode baru dipakai. Aman: hanya menambah satu kolom (default false).
alter table character add column if not exists import_allowed boolean not null default false;
