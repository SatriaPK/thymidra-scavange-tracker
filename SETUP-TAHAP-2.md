# Setup Tahap 2 (login + panel DM)

## 1. Pasang paket tambahan
Di folder proyek:

    npm i jose zod server-only

(`next`, `react`, `@supabase/supabase-js`, `vitest` sudah ada.)

## 2. Salin file
Ekstrak zip ini ke root proyek (`D:\Project\thymidra-scavenge-tracker`), gabungkan dengan folder yang ada:
- `app/`     : timpa `layout.tsx`, `globals.css`, `page.tsx` bawaan scaffold
- `components/`, `lib/` : folder baru / gabung dengan `lib/` yang sudah ada

Jangan menimpa `package.json` dan `tsconfig.json`. Cek `tsconfig.json` punya baris:

    "paths": { "@/*": ["./*"] }

Kalau alias-nya `./src/*` atau tidak ada, kabari aku.

## 3. Database (Supabase -> SQL Editor)
1. Jalankan `schema.sql` (atau SQL `alter table` dari chat bila tabel sudah ada).
2. Jalankan `rls.sql`.
3. Buat campaign dan kode DM (ganti isinya, simpan kode DM baik-baik):

       insert into campaign (name, dm_code)
       values ('Thymidra', 'GANTI-DENGAN-KODE-DM-PANJANG');

## 4. Environment
Salin `.env.local.example` menjadi `.env.local`, isi tiga nilainya.

## 5. Jalankan
    npm run dev
Buka http://localhost:3000/dm/login, masuk dengan kode DM.

## Urutan mencoba
1. DM: Item -> buat beberapa item. Zona -> buat zona (DC), tambahkan item + bobot, buat pool Rare Find.
2. DM: Dasbor -> set zona aktif.
3. DM: Karakter -> buat slot, catat kodenya.
4. Pemain (jendela incognito): halaman utama -> nama + kode -> isi form karakter.
