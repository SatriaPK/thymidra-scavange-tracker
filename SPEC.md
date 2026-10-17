# Scavenging Tracker: Spesifikasi Aturan

Web app pendamping mekanik homebrew *scavenging* untuk campaign D&D 5e.

## Peran

- **DM**: membuat campaign, item, zona, slot karakter (nama + kode akses); mengatur zona aktif; melihat log; reset hari manual; undo.
- **Player**: login dengan *nama karakter + kode* (dibuat DM), mengisi dan mengedit stat karakternya sendiri, melakukan scavenge, mengelola inventori/storage, barter.

## Karakter

**Pembuatan karakter:** DM hanya membuat slot (nama + kode). Saat pertama login (`setup_done = false`), pemain diarahkan ke form pembuatan karakter dan baru bisa scavenge setelah menyimpannya. Pemain boleh mengedit stat kapan saja; setiap perubahan tercatat di log DM (`stat_edit`). Nama karakter tidak bisa diubah pemain karena dipakai untuk login.

Input: level, 6 ability score, proficiency Investigation (ya/tidak), expertise (toggle), bonus modifier lain, bonus slot manual.

- Proficiency bonus = `2 + floor((level - 1) / 4)`
- Modifier Intelligence (`mod(INT)`) = `floor((INT score - 10) / 2)`. Murni dari ability score, tanpa proficiency, expertise, atau bonus.
- Modifier Investigation = `mod(INT) + (proficient ? PB : 0) + (expertise ? PB : 0) + bonus`
- Kapasitas inventori (slot) = `10 + STR score + bonus slot`
- Contoh: STR 9 → 19 slot.

## Item

- Nama, berat slot (bilangan bulat 1, 2, 3, ...), yield scrap `{bio, arcane, mech, ferrous}` (boleh kosong).
- Item **tanpa yield** (misal Wondrous Item) tidak bisa di-breakdown dan **tidak memakan slot**.
- 1 unit scrap = 0,25 slot. Scrap disimpan sebagai jumlah per jenis; slot = total scrap x 0,25.

## Zona

- Nama, **DC** keberhasilan, daftar item biasa / junk item (dengan **bobot**), pool Rare Find (dengan bobot).
- Peluang tiap item ditampilkan otomatis di editor = bobot / total bobot.
- DM menetapkan **zona aktif** setelah tiap sesi; player melihatnya otomatis.

## Alur scavenge

1. Player memilih toggle **Advantage**, **Disadvantage**, dan/atau **Guidance** (+1d4). Advantage + Disadvantage bersamaan saling meniadakan (roll normal).
2. Sistem roll d20 (Advantage: dua dadu ambil tertinggi; Disadvantage: dua dadu ambil terendah). Nat 1/Nat 20 ditentukan dari **dadu d20 terpilih**.
3. Total = d20 + modifier Investigation + (Guidance ? 1d4 : 0).
4. Hasil, dievaluasi dari atas ke bawah:
   - **Nat 1**: otomatis gagal, karakter dapat **+1 Exhaustion di sesi berikutnya** (penanda di dashboard DM, tombol "sudah diterapkan").
   - **Nat 20**: otomatis berhasil, lalu randomize lagi: **25% Rare Find** (1 item dari pool Rare Find) / **75% Jackpot** (N item dari pool biasa, N = hasil **d4**, hasil 1 dihitung 2, jadi N = 2, 2, 3, atau 4).
   - **Fail** (total < DC): tidak dapat apa-apa.
   - **Low Success** (DC <= total < DC + 5): dapat **loose scrap** sejumlah `N = max(0, floor(mod(INT) / 2))`.
     - Tipe tiap loose scrap diundi sendiri-sendiri secara acak dari 4 jenis (bio, arcane, mech, ferrous), jadi tipe boleh sama.
     - 1 loose scrap = 1 unit scrap (0,25 slot).
     - `mod(INT)` negatif atau menghasilkan N = 0: tidak dapat apa-apa, tetap dicatat sebagai Low Success.
     - Alasan batas: pendapatan Low Success tidak boleh melebihi yield junk item pada High Success.
   - **High Success** (total >= DC + 5): dapat **1 junk item utuh**, dipilih acak berdasarkan bobot dari pool biasa zona.
5. Setiap hasil ditampilkan, lalu player memilih satu:
   - **Item** (High Success, Jackpot, Rare Find): **Simpan**, **Breakdown**, atau **Buang**.
   - **Loose scrap** (Low Success): **Simpan** atau **Buang** (sudah berupa scrap, tidak ada Breakdown).
6. Batas **3x scavenge per hari nyata**, reset pukul **00.00 WIB** (zona waktu Asia/Jakarta, dihitung di server).

Ringkasan:

| Kondisi | Hasil |
|---|---|
| Nat 1 | Gagal + 1 Exhaustion sesi berikutnya |
| Nat 20 | 25% Rare Find / 75% Jackpot |
| Total < DC | Fail, tidak dapat apa-apa |
| DC <= total < DC + 5 | Low Success: `max(0, floor(mod(INT) / 2))` loose scrap, tipe acak per scrap |
| Total >= DC + 5 | High Success: 1 junk item utuh |

## Inventori dan peringatan penuh

- Simpan item: butuh ruang `berat slot` (item tanpa slot tidak butuh).
- Simpan loose scrap: butuh ruang `jumlah scrap x 0,25`.
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
- Log scavenge menyimpan tingkat hasil (Nat 1, Nat 20, Fail, Low Success, High Success) dan jumlah serta tipe loose scrap bila ada.
- DM dapat melihat seluruh log dan membatalkan aksi tertentu.