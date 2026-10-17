# Scavenging Tracker: Spesifikasi Aturan

Web app pendamping mekanik homebrew *scavenging* untuk campaign D&D 5e.

## Peran

- **DM**: membuat campaign, item, zona, slot karakter (nama + kode akses); mengatur zona aktif; melihat log; reset hari manual; undo.
- **Player**: login dengan *nama karakter + kode* (dibuat DM), mengisi dan mengedit stat karakternya sendiri, melakukan scavenge, mengelola inventori/storage, barter.

## Karakter

**Pembuatan karakter:** DM hanya membuat slot (nama + kode). Saat pertama login (`setup_done = false`), pemain diarahkan ke form pembuatan karakter dan baru bisa scavenge setelah menyimpannya. Pemain boleh mengedit stat kapan saja; setiap perubahan tercatat di log DM (`stat_edit`). Nama karakter tidak bisa diubah pemain karena dipakai untuk login.

Input: level, 6 ability score, proficiency Investigation (ya/tidak), expertise (toggle), bonus modifier lain, bonus slot manual.

- Proficiency bonus = `2 + floor((level - 1) / 4)`
- Modifier Investigation = `mod(INT) + (proficient ? PB : 0) + (expertise ? PB : 0) + bonus`
- Kapasitas inventori (slot) = `10 + STR score + bonus slot`
- Contoh: STR 9 → 19 slot.

## Item

- Nama, berat slot (bilangan bulat 1, 2, 3, ...), yield scrap `{bio, arcane, mech, ferrous}` (boleh kosong).
- Item **tanpa yield** (misal Wondrous Item) tidak bisa di-breakdown dan **tidak memakan slot**.
- 1 unit scrap = 0,25 slot. Scrap disimpan sebagai jumlah per jenis; slot = total scrap x 0,25.

## Zona

- Nama, **DC** keberhasilan, daftar item biasa (dengan **bobot**), pool Rare Find (dengan bobot).
- Peluang tiap item ditampilkan otomatis di editor = bobot / total bobot.
- DM menetapkan **zona aktif** setelah tiap sesi; player melihatnya otomatis.

## Alur scavenge

1. Player memilih toggle **Advantage**, **Disadvantage**, dan/atau **Guidance** (+1d4). Advantage + Disadvantage bersamaan saling meniadakan (roll normal).
2. Sistem roll d20 (Advantage: dua dadu ambil tertinggi; Disadvantage: dua dadu ambil terendah). Nat 1/Nat 20 ditentukan dari **dadu d20 terpilih**.
3. Total = d20 + modifier Investigation + (Guidance ? 1d4 : 0).
4. Hasil:
   - **Nat 1**: otomatis gagal, karakter dapat **+1 Exhaustion di sesi berikutnya** (penanda di dashboard DM, tombol "sudah diterapkan").
   - **Total < DC zona**: gagal, tidak dapat apa-apa.
   - **Total >= DC zona**: berhasil, sistem memilih 1 item acak berdasarkan bobot.
   - **Nat 20**: otomatis berhasil, lalu randomize lagi: **25% Rare Find** (1 item dari pool Rare Find) / **75% Jackpot** (N item dari pool biasa, N = hasil **d4**, hasil 1 dihitung 2, jadi N = 2, 2, 3, atau 4).
5. Setiap item hasil ditampilkan, lalu player memilih satu: **Simpan**, **Breakdown**, atau **Buang**.
6. Batas **3x scavenge per hari nyata**, reset pukul **00.00 WIB** (zona waktu Asia/Jakarta, dihitung di server).

## Inventori dan peringatan penuh

- Simpan item: butuh ruang `berat slot` (item tanpa slot tidak butuh).
- Breakdown: butuh ruang `total scrap x 0,25` (item aslinya tidak masuk inventori).
- Jika tidak muat, tampilkan pilihan: **Buang**, **Pindahkan ke Storage** (untuk barang yang sudah ada di inventori), atau (untuk scrap) **buang sebagian scrap** agar muat.
- Storage di kapal: tanpa batas, menyimpan item dan scrap.

## Barter

- Mode **Kasih** (sepihak) dan **Tukar** (A menawarkan X, minta Y).
- Penerima harus **menerima**; barang pindah hanya setelah diterima.
- Kapasitas penerima dicek; jika penuh, tidak bisa menerima sebelum membuat ruang.
- Atomik: bila barang berubah/hilang sebelum diterima, tawaran batal otomatis.
- Scrap bisa dibarter per jenis dan jumlah.

## Log dan Undo

- Semua scavenge (roll, hasil, pilihan), breakdown, pemindahan, dan barter tercatat.
- DM dapat melihat seluruh log dan membatalkan aksi tertentu.

## Di luar lingkup tahap awal

Integrasi Avrae (tidak ada API publik yang mudah), login akun email.
