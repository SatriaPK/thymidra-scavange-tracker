# Scavenging Tracker

Web app pendamping mekanik homebrew *scavenging* untuk campaign D&D 5e. Aturan lengkap ada di [SPEC.md](SPEC.md).

## Status: Tahap 1 (fondasi)

| Bagian | Status |
|---|---|
| Spesifikasi aturan (`SPEC.md`) | Selesai |
| Skema database Supabase (`schema.sql`) | Selesai |
| Logika inti (`src/lib/core.ts`): slot, modifier, roll, bobot, Nat 1/20, reset WIB | Selesai, 24 test lulus |
| Antarmuka (halaman DM dan player) | Belum |
| Login nama karakter + kode, API server | Belum |
| Barter, log/undo, dashboard DM | Belum |

## Menjalankan test

```bash
npm install
npm test
```

## Setup Supabase (untuk tahap berikutnya)

1. Buat project gratis di supabase.com.
2. Buka SQL Editor, tempel isi `schema.sql`, jalankan.
3. Salin URL project dan service key ke `.env.local` (jangan di-commit).

## Catatan desain

- Semua roll dilakukan di **server** (bukan di browser pemain) memakai `cryptoRng`, supaya tidak bisa dicurangi.
- Slot dihitung dalam kuartal (1 slot = 4 kuartal) agar scrap 0,25 slot tidak menimbulkan error pembulatan.
- Hari scavenge dihitung dengan zona waktu Asia/Jakarta (`wibDay`), reset 00.00 WIB.
- Login tanpa akun: DM membuat karakter dan kode; sesi memakai nama karakter + kode.

## Urutan tahap berikutnya

1. Halaman DM: editor item dan zona (dengan persentase peluang otomatis), buat karakter + kode, set zona aktif
2. Halaman player: input karakter, scavenge (toggle Advantage/Guidance), hasil + Simpan/Breakdown/Buang
3. Inventori, Storage, peringatan penuh
4. Barter, log + undo, tombol Next Day, penanda Exhaustion
