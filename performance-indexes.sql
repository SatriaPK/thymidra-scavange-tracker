-- Indeks untuk mempercepat query yang paling sering jalan. Jalankan di Supabase SQL Editor.
--
-- Aman: hanya menambah indeks. Isi tabel tidak berubah, dan boleh dijalankan berulang (IF NOT EXISTS).
-- Untuk membatalkan salah satunya: drop index <nama>;
--
-- Tabel character, item, dan zone sudah punya indeks lewat batasan unik (campaign_id, ...),
-- jadi tidak perlu ditambah.

-- "Scavenge terakhir" di halaman pemain (jalan di setiap refresh):
--   select ... from log where character_id = ? and kind = 'scavenge' order by created_at desc limit 1
create index if not exists log_character_kind_created_idx on log (character_id, kind, created_at desc);

-- Temuan yang belum diputuskan (dibaca di halaman pemain dan setiap kali scavenge):
create index if not exists pending_find_character_idx on pending_find (character_id);
