// Logika inti Scavenging Tracker. Semua fungsi murni (tanpa I/O) supaya mudah diuji.
// Slot dihitung dalam "kuartal" (1 slot = 4 kuartal) agar 0,25 slot/scrap tidak menimbulkan error pembulatan.

export type Rng = () => number; // mengembalikan angka di [0, 1)

export const SCRAP_QUARTERS = 1; // 1 unit scrap = 0,25 slot = 1 kuartal
export const MAX_SCAVENGES_PER_DAY = 3;
export const RARE_FIND_CHANCE = 0.25; // Nat 20: 25% Rare Find, 75% Jackpot
export const HIGH_SUCCESS_MARGIN = 5; // total >= DC + 5 = High Success; DC sampai DC + 4 = Low Success

// ---------- Karakter ----------

export const abilityMod = (score: number): number => Math.floor((score - 10) / 2);

export const proficiencyBonus = (level: number): number =>
  2 + Math.floor((Math.min(Math.max(level, 1), 20) - 1) / 4);

export interface InvestigationInput {
  level: number;
  intScore: number;
  proficient: boolean;
  expertise: boolean;
  bonus: number;
}

export function investigationModifier(c: InvestigationInput): number {
  const pb = proficiencyBonus(c.level);
  const profPart = c.proficient ? pb * (c.expertise ? 2 : 1) : 0;
  return abilityMod(c.intScore) + profPart + c.bonus;
}

/** Kapasitas inventori dalam slot penuh: 10 + STR + bonus manual. */
export function slotCapacity(c: { strScore: number; slotBonus: number }): number {
  return 10 + c.strScore + c.slotBonus;
}

// ---------- Item dan scrap ----------

export interface Scrap {
  bio: number;
  arcane: number;
  mech: number;
  ferrous: number;
}

export const emptyScrap = (): Scrap => ({ bio: 0, arcane: 0, mech: 0, ferrous: 0 });
export const scrapTotal = (s: Scrap): number => s.bio + s.arcane + s.mech + s.ferrous;
export const scrapQuarters = (s: Scrap): number => scrapTotal(s) * SCRAP_QUARTERS;
export const addScrap = (a: Scrap, b: Scrap): Scrap => ({
  bio: a.bio + b.bio,
  arcane: a.arcane + b.arcane,
  mech: a.mech + b.mech,
  ferrous: a.ferrous + b.ferrous,
});

export interface ItemDef {
  id: string;
  name: string;
  slotWeight: number;
  yield: Scrap;
}

export const hasYield = (item: ItemDef): boolean => scrapTotal(item.yield) > 0;

/** Item tanpa yield (mis. Wondrous Item) tidak memakan slot dan tidak bisa di-breakdown. */
export const itemQuarters = (item: ItemDef): number => (hasYield(item) ? item.slotWeight * 4 : 0);
export const canBreakdown = hasYield;

export interface Holding {
  item: ItemDef;
  quantity: number;
}

/** Slot terpakai dalam kuartal (item + scrap di inventori). */
export function usedQuarters(holdings: Holding[], scrap: Scrap): number {
  const itemQ = holdings.reduce((sum, h) => sum + itemQuarters(h.item) * h.quantity, 0);
  return itemQ + scrapQuarters(scrap);
}

export const quartersToSlots = (q: number): number => q / 4;

export interface FitResult {
  fits: boolean;
  /** Kuartal yang melebihi kapasitas jika ditambahkan (0 bila muat). */
  overflowQuarters: number;
  /** Jumlah unit scrap yang harus dibuang agar penambahan muat (opsi "buang sebagian scrap"). */
  scrapUnitsToDiscard: number;
}

/** Cek apakah penambahan `addQuarters` muat di inventori dengan kapasitas `capacitySlots`. */
export function checkFit(capacitySlots: number, usedQ: number, addQuarters: number): FitResult {
  const overflow = Math.max(0, usedQ + addQuarters - capacitySlots * 4);
  return {
    fits: overflow === 0,
    overflowQuarters: overflow,
    scrapUnitsToDiscard: Math.ceil(overflow / SCRAP_QUARTERS),
  };
}

// ---------- Simpan sebagian scrap (inventori hampir penuh) ----------

/** Sisa ruang inventori dalam kuartal (0 bila sudah penuh atau melebihi kapasitas). */
export const freeQuarters = (capacitySlots: number, usedQ: number): number =>
  Math.max(0, capacitySlots * 4 - usedQ);

/** Batasi jumlah scrap yang disimpan: bilangan bulat, antara 0 dan jumlah yang ada per jenis. */
export function clampKeepScrap(original: Scrap, keep: Partial<Scrap>): Scrap {
  const one = (have: number, want: number | undefined) =>
    Math.min(have, Math.max(0, Number.isFinite(want) ? Math.floor(want as number) : 0));
  return {
    bio: one(original.bio, keep.bio),
    arcane: one(original.arcane, keep.arcane),
    mech: one(original.mech, keep.mech),
    ferrous: one(original.ferrous, keep.ferrous),
  };
}

/** Saran awal: simpan scrap sebanyak yang muat, diisi berurutan per jenis (bio, arcane, mech, ferrous). */
export function suggestKeepScrap(original: Scrap, freeQ: number): Scrap {
  let room = Math.floor(freeQ / SCRAP_QUARTERS);
  const out = emptyScrap();
  for (const type of ['bio', 'arcane', 'mech', 'ferrous'] as const) {
    const take = Math.min(original[type], room);
    out[type] = take;
    room -= take;
  }
  return out;
}

/** Scrap yang dibuang = scrap asli dikurangi yang disimpan. */
export const remainderScrap = (original: Scrap, keep: Scrap): Scrap => ({
  bio: original.bio - keep.bio,
  arcane: original.arcane - keep.arcane,
  mech: original.mech - keep.mech,
  ferrous: original.ferrous - keep.ferrous,
});

// ---------- Dadu ----------

export const rollDie = (rng: Rng, sides: number): number => 1 + Math.floor(rng() * sides);

export type RollMode = 'normal' | 'advantage' | 'disadvantage';

/** Advantage dan Disadvantage yang aktif bersamaan saling meniadakan (aturan D&D 5e). */
export const rollMode = (advantage: boolean, disadvantage: boolean): RollMode =>
  advantage === disadvantage ? 'normal' : advantage ? 'advantage' : 'disadvantage';

export interface ScavengeRollInput {
  modifier: number;
  dc: number;
  advantage: boolean;
  disadvantage?: boolean;
  guidance: boolean;
}

export interface ScavengeRoll {
  mode: RollMode;
  d20Rolls: number[]; // 1 dadu, atau 2 bila Advantage/Disadvantage
  d20: number; // dadu terpilih
  guidanceRoll: number; // 0 bila tidak memakai Guidance
  modifier: number;
  total: number;
  dc: number;
  nat1: boolean;
  nat20: boolean;
  success: boolean;
}

export function rollScavenge(rng: Rng, input: ScavengeRollInput): ScavengeRoll {
  const mode = rollMode(input.advantage, input.disadvantage ?? false);
  const d20Rolls = mode === 'normal' ? [rollDie(rng, 20)] : [rollDie(rng, 20), rollDie(rng, 20)];
  const d20 = mode === 'disadvantage' ? Math.min(...d20Rolls) : Math.max(...d20Rolls);
  const guidanceRoll = input.guidance ? rollDie(rng, 4) : 0;
  const total = d20 + input.modifier + guidanceRoll;
  const nat1 = d20 === 1;
  const nat20 = d20 === 20;
  // Nat 1 selalu gagal, Nat 20 selalu berhasil; selain itu total >= DC
  const success = nat1 ? false : nat20 ? true : total >= input.dc;
  return {
    mode,
    d20Rolls,
    d20,
    guidanceRoll,
    modifier: input.modifier,
    total,
    dc: input.dc,
    nat1,
    nat20,
    success,
  };
}

// ---------- Pemilihan item berbobot ----------

export interface WeightedEntry {
  itemId: string;
  weight: number;
}

export function weightedPick(rng: Rng, entries: WeightedEntry[]): string | null {
  const valid = entries.filter((e) => e.weight > 0);
  const total = valid.reduce((s, e) => s + e.weight, 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const e of valid) {
    r -= e.weight;
    if (r < 0) return e.itemId;
  }
  return valid[valid.length - 1].itemId; // jaga-jaga untuk error floating point
}

/** Persentase peluang tiap item (untuk ditampilkan di editor zona DM). */
export function dropChances(entries: WeightedEntry[]): { itemId: string; percent: number }[] {
  const total = entries.reduce((s, e) => s + Math.max(e.weight, 0), 0);
  return entries.map((e) => ({
    itemId: e.itemId,
    percent: total > 0 ? (Math.max(e.weight, 0) / total) * 100 : 0,
  }));
}

// ---------- Hasil scavenge ----------

export interface ZoneConfig {
  dc: number;
  items: WeightedEntry[]; // pool biasa
  rareItems: WeightedEntry[]; // pool Rare Find
}

export const JACKPOT_DIE = 4;
export const JACKPOT_MIN_ITEMS = 2;
export const JACKPOT_MAX_ITEMS = 3;

/** Jumlah item Jackpot = d4 dibatasi 2-3: hasil 1 dihitung 2, hasil 4 dihitung 3 (jadi 2, 2, 3, 3). */
export function rollJackpotCount(rng: Rng): { die: number; count: number } {
  const die = rollDie(rng, JACKPOT_DIE);
  return { die, count: Math.min(JACKPOT_MAX_ITEMS, Math.max(die, JACKPOT_MIN_ITEMS)) };
}

export const LOOSE_SCRAP_TYPE_DIE = 4; // d4 jumlah tipe scrap
export const LOOSE_SCRAP_PARTS_DIE = 4; // d4 part per tipe
export const SCRAP_TYPES = ['bio', 'arcane', 'mech', 'ferrous'] as const;
export type ScrapType = (typeof SCRAP_TYPES)[number];

/** Loose Scrap Jackpot: d4 tipe scrap berbeda (acak), masing-masing d4 part. */
export function rollLooseScrap(rng: Rng): Scrap {
  const typeCount = rollDie(rng, LOOSE_SCRAP_TYPE_DIE);
  const pool: ScrapType[] = [...SCRAP_TYPES];
  const out = emptyScrap();
  for (let i = 0; i < typeCount; i++) {
    const idx = Math.floor(rng() * pool.length);
    const [type] = pool.splice(idx, 1);
    out[type] = rollDie(rng, LOOSE_SCRAP_PARTS_DIE);
  }
  return out;
}

/**
 * 'success' adalah kind lama (sebelum ada Low/High Success), dipertahankan hanya agar log lama tetap terbaca.
 * resolveScavenge tidak lagi menghasilkannya.
 */
export type OutcomeKind = 'fail' | 'low_success' | 'high_success' | 'success' | 'jackpot' | 'rare';

/** Jumlah loose scrap Low Success = floor(modifier INT / 2), minimal 0 (modifier minus tidak memberi apa-apa). */
export const lowSuccessScrapCount = (intModifier: number): number => Math.max(0, Math.floor(intModifier / 2));

/** Loose scrap Low Success: tiap scrap (1 unit) diundi tipenya sendiri-sendiri, tipe boleh sama. */
export function rollLowSuccessScrap(rng: Rng, count: number): Scrap {
  const out = emptyScrap();
  for (let i = 0; i < count; i++) {
    out[SCRAP_TYPES[Math.floor(rng() * SCRAP_TYPES.length)]] += 1;
  }
  return out;
}

export interface ScavengeOutcome {
  roll: ScavengeRoll;
  kind: OutcomeKind;
  itemIds: string[];
  /** Hasil d4 jumlah item, hanya terisi untuk Jackpot. */
  jackpotDie?: number;
  /** Loose Scrap: hasil Low Success, atau tambahan pada Jackpot. */
  looseScrap?: Scrap;
  /** Nat 1: karakter mendapat +1 Exhaustion di sesi berikutnya. */
  exhaustion: boolean;
}

export interface ScavengeResolveInput extends Omit<ScavengeRollInput, 'dc'> {
  /** Modifier ability Intelligence murni (tanpa proficiency/bonus), dipakai untuk jumlah loose scrap Low Success. */
  intModifier: number;
}

export function resolveScavenge(
  rng: Rng,
  input: ScavengeResolveInput,
  zone: ZoneConfig,
): ScavengeOutcome {
  const { intModifier, ...rollInput } = input;
  const roll = rollScavenge(rng, { ...rollInput, dc: zone.dc });

  if (!roll.success) {
    return { roll, kind: 'fail', itemIds: [], exhaustion: roll.nat1 };
  }

  if (roll.nat20) {
    const wantsRare = rng() < RARE_FIND_CHANCE;
    if (wantsRare && zone.rareItems.some((e) => e.weight > 0)) {
      const id = weightedPick(rng, zone.rareItems);
      return { roll, kind: 'rare', itemIds: id ? [id] : [], exhaustion: false };
    }
    const { die, count } = rollJackpotCount(rng);
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const id = weightedPick(rng, zone.items);
      if (id) ids.push(id);
    }
    const looseScrap = rollLooseScrap(rng);
    return { roll, kind: 'jackpot', itemIds: ids, jackpotDie: die, looseScrap, exhaustion: false };
  }

  // Selain Nat 1 / Nat 20: DC sampai DC + 4 = Low Success (loose scrap), DC + 5 ke atas = High Success (1 junk item)
  if (roll.total < zone.dc + HIGH_SUCCESS_MARGIN) {
    const looseScrap = rollLowSuccessScrap(rng, lowSuccessScrapCount(intModifier));
    return { roll, kind: 'low_success', itemIds: [], looseScrap, exhaustion: false };
  }

  const id = weightedPick(rng, zone.items);
  return { roll, kind: 'high_success', itemIds: id ? [id] : [], exhaustion: false };
}

// ---------- Batas harian (reset 00.00 WIB) ----------

/** Tanggal (YYYY-MM-DD) pada zona waktu Asia/Jakarta. */
export function wibDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export const remainingScavenges = (usedToday: number): number =>
  Math.max(0, MAX_SCAVENGES_PER_DAY - usedToday);

/** Gunakan crypto bila tersedia (di server), fallback Math.random untuk pengujian. */
export const cryptoRng: Rng = () => {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 0x100000000;
};