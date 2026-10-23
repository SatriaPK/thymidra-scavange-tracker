import { describe, expect, it } from 'vitest';
import {
  abilityMod,
  checkFit,
  dropChances,
  emptyScrap,
  investigationModifier,
  itemQuarters,
  proficiencyBonus,
  quartersToSlots,
  resolveScavenge,
  rollJackpotCount,
  rollMode,
  rollScavenge,
  slotCapacity,
  usedQuarters,
  weightedPick,
  wibDay,
  type ItemDef,
  type Rng,
  type ZoneConfig,
  rollLooseScrap,
  lowSuccessScrapCount,
  rollLowSuccessScrap,
  scrapTotal,
  freeQuarters,
  clampKeepScrap,
  suggestKeepScrap,
  remainderScrap,
} from './core';

/** RNG deterministik: mengembalikan nilai dari daftar secara berurutan. */
const seq = (...values: number[]): Rng => {
  let i = 0;
  return () => values[i++ % values.length];
};

/** Nilai rng yang menghasilkan hasil dadu tertentu pada dadu bersisi `sides`. */
const dieValue = (face: number, sides: number) => (face - 1 + 0.5) / sides;

/** PRNG seeded (mulberry32) untuk uji distribusi. */
const seeded = (seed: number): Rng => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const zone: ZoneConfig = {
  dc: 12,
  items: [
    { itemId: 'kerang', weight: 30 },
    { itemId: 'besi', weight: 20 },
  ],
  rareItems: [{ itemId: 'relik', weight: 1 }],
};

describe('kalkulasi karakter', () => {
  it('modifier ability', () => {
    expect(abilityMod(9)).toBe(-1);
    expect(abilityMod(10)).toBe(0);
    expect(abilityMod(16)).toBe(3);
  });

  it('modifier ability sesuai tabel D&D (10-11 = +0, tiap +2 skor = +1, berlaku ke bawah)', () => {
    const table: Record<number, number> = {
      1: -5, 2: -4, 3: -4, 4: -3, 5: -3, 6: -2, 7: -2, 8: -1, 9: -1,
      10: 0, 11: 0, 12: 1, 13: 1, 14: 2, 15: 2, 16: 3, 17: 3, 18: 4, 19: 4, 20: 5,
    };
    for (const [score, mod] of Object.entries(table)) {
      expect(abilityMod(Number(score))).toBe(mod);
    }
  });

  it('proficiency bonus sesuai tabel level (1-4:+2, 5-8:+3, 9-12:+4, 13-16:+5, 17-20:+6)', () => {
    const expected = (lvl: number) => (lvl <= 4 ? 2 : lvl <= 8 ? 3 : lvl <= 12 ? 4 : lvl <= 16 ? 5 : 6);
    for (let lvl = 1; lvl <= 20; lvl++) {
      expect(proficiencyBonus(lvl)).toBe(expected(lvl));
    }
  });

  it('expertise = proficiency bonus x 2', () => {
    const c = { level: 9, intScore: 10, proficient: true, expertise: true, bonus: 0 };
    expect(investigationModifier(c)).toBe(8); // PB level 9 = +4, x2
  });

  it('proficiency bonus per level', () => {
    expect(proficiencyBonus(1)).toBe(2);
    expect(proficiencyBonus(4)).toBe(2);
    expect(proficiencyBonus(5)).toBe(3);
    expect(proficiencyBonus(9)).toBe(4);
    expect(proficiencyBonus(17)).toBe(6);
  });

  it('slot = 10 + STR (contoh STR 9 = 19) + bonus', () => {
    expect(slotCapacity({ strScore: 9, slotBonus: 0 })).toBe(19);
    expect(slotCapacity({ strScore: 9, slotBonus: 5 })).toBe(24);
  });

  it('modifier investigation: proficient, expertise, bonus', () => {
    const base = { level: 5, intScore: 14, proficient: false, expertise: false, bonus: 0 };
    expect(investigationModifier(base)).toBe(2);
    expect(investigationModifier({ ...base, proficient: true })).toBe(5);
    expect(investigationModifier({ ...base, proficient: true, expertise: true })).toBe(8);
    expect(investigationModifier({ ...base, proficient: true, bonus: 1 })).toBe(6);
    // expertise tanpa proficiency tidak berlaku
    expect(investigationModifier({ ...base, expertise: true })).toBe(2);
  });
});

describe('slot dan scrap', () => {
  const kerang: ItemDef = {
    id: 'kerang',
    name: 'Kerang',
    slotWeight: 2,
    yield: { bio: 2, arcane: 0, mech: 0, ferrous: 0 },
  };
  const relik: ItemDef = { id: 'relik', name: 'Relik', slotWeight: 3, yield: emptyScrap() };

  it('item tanpa yield tidak memakan slot', () => {
    expect(itemQuarters(relik)).toBe(0);
    expect(itemQuarters(kerang)).toBe(8);
  });

  it('1 unit scrap = 0,25 slot', () => {
    const q = usedQuarters([{ item: kerang, quantity: 1 }], { bio: 4, arcane: 0, mech: 0, ferrous: 2 });
    expect(quartersToSlots(q)).toBe(2 + 1.5);
  });

  it('checkFit menghitung overflow dan scrap yang harus dibuang', () => {
    expect(checkFit(19, 4 * 18, 4).fits).toBe(true);
    const r = checkFit(19, 4 * 18, 4 * 2);
    expect(r.fits).toBe(false);
    expect(r.overflowQuarters).toBe(4);
    expect(r.scrapUnitsToDiscard).toBe(4);
  });
});

describe('roll scavenge', () => {
  it('Nat 1 otomatis gagal walau total jauh di atas DC, dan memberi exhaustion', () => {
    const o = resolveScavenge(seq(dieValue(1, 20)), { modifier: 30, advantage: false, guidance: false, intModifier: 0 }, zone);
    expect(o.roll.nat1).toBe(true);
    expect(o.kind).toBe('fail');
    expect(o.exhaustion).toBe(true);
    expect(o.itemIds).toEqual([]);
  });

  it('total < DC gagal tanpa exhaustion', () => {
    const o = resolveScavenge(seq(dieValue(5, 20)), { modifier: 2, advantage: false, guidance: false, intModifier: 0 }, zone);
    expect(o.roll.total).toBe(7);
    expect(o.kind).toBe('fail');
    expect(o.exhaustion).toBe(false);
  });

  it('total sama dengan DC berhasil (Low Success)', () => {
    const o = resolveScavenge(seq(dieValue(10, 20), 0), { modifier: 2, advantage: false, guidance: false, intModifier: 0 }, zone);
    expect(o.roll.total).toBe(12);
    expect(o.roll.success).toBe(true);
    expect(o.kind).toBe('low_success');
  });

  it('Advantage mengambil dadu tertinggi', () => {
    const r = rollScavenge(seq(dieValue(4, 20), dieValue(15, 20)), {
      modifier: 0,
      dc: 12,
      advantage: true,
      guidance: false,
    });
    expect(r.d20Rolls).toEqual([4, 15]);
    expect(r.d20).toBe(15);
  });

  it('Guidance menambah 1d4 sebagai bonus', () => {
    const r = rollScavenge(seq(dieValue(8, 20), dieValue(3, 4)), {
      modifier: 1,
      dc: 12,
      advantage: false,
      guidance: true,
    });
    expect(r.guidanceRoll).toBe(3);
    expect(r.total).toBe(8 + 1 + 3);
    // 12 sama dengan DC 12 → berhasil; tanpa Guidance total 9 akan gagal
    expect(r.success).toBe(true);
  });

  it('Advantage + Guidance melempar 2d20 dan 1d4', () => {
    const r = rollScavenge(seq(dieValue(5, 20), dieValue(16, 20), dieValue(3, 4)), {
      modifier: 2,
      dc: 12,
      advantage: true,
      guidance: true,
    });
    expect(r.mode).toBe('advantage');
    expect(r.d20Rolls).toEqual([5, 16]);
    expect(r.d20).toBe(16);
    expect(r.guidanceRoll).toBe(3);
    expect(r.total).toBe(21);
  });

  it('Advantage + Disadvantage + Guidance melempar 1d20 dan 1d4', () => {
    const r = rollScavenge(seq(dieValue(9, 20), dieValue(2, 4)), {
      modifier: 1,
      dc: 12,
      advantage: true,
      disadvantage: true,
      guidance: true,
    });
    expect(r.mode).toBe('normal');
    expect(r.d20Rolls).toEqual([9]);
    expect(r.guidanceRoll).toBe(2);
    expect(r.total).toBe(12);
  });

  it('Nat 20 selalu berhasil walau modifier negatif sangat besar', () => {
    const r = rollScavenge(seq(dieValue(20, 20)), { modifier: -50, dc: 30, advantage: false, guidance: false });
    expect(r.success).toBe(true);
  });

  it('Nat 1 dengan Guidance tetap gagal', () => {
    const r = rollScavenge(seq(dieValue(1, 20), dieValue(4, 4)), {
      modifier: 20,
      dc: 12,
      advantage: false,
      guidance: true,
    });
    expect(r.success).toBe(false);
    expect(r.nat1).toBe(true);
  });
});

describe('Nat 20: Rare Find vs Jackpot', () => {
  it('rng < 0,25 menghasilkan Rare Find', () => {
    const o = resolveScavenge(seq(dieValue(20, 20), 0.1, 0.5), { modifier: 0, advantage: false, guidance: false, intModifier: 0 }, zone);
    expect(o.kind).toBe('rare');
    expect(o.itemIds).toEqual(['relik']);
  });

  it('Jackpot: jumlah item = d4 dibatasi 2-3 (1 jadi 2, 4 jadi 3)', () => {
    const expected: Record<number, number> = { 1: 2, 2: 2, 3: 3, 4: 3 };
    for (const [face, count] of Object.entries(expected)) {
      const o = resolveScavenge(
        seq(dieValue(20, 20), 0.5, dieValue(Number(face), 4), 0.1, 0.9),
        { modifier: 0, advantage: false, guidance: false, intModifier: 0 },
        zone,
      );
      expect(o.kind).toBe('jackpot');
      expect(o.jackpotDie).toBe(Number(face));
      expect(o.itemIds).toHaveLength(count);
    }
  });

  it('Jackpot juga memberi Loose Scrap', () => {
    const o = resolveScavenge(seq(dieValue(20, 20), 0.99, dieValue(2, 4), 0.1, 0.9), { modifier: 0, advantage: false, guidance: false, intModifier: 0 }, zone);
    expect(o.kind).toBe('jackpot');
    expect(o.looseScrap).toBeDefined();
    const total = o.looseScrap!.bio + o.looseScrap!.arcane + o.looseScrap!.mech + o.looseScrap!.ferrous;
    expect(total).toBeGreaterThan(0);
  });

  it('rollLooseScrap: d4 tipe berbeda, tiap tipe 1-4 part', () => {
    const rng = seeded(7);
    const seenCounts = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const s = rollLooseScrap(rng);
      const vals = [s.bio, s.arcane, s.mech, s.ferrous];
      const types = vals.filter((v) => v > 0).length;
      expect(types).toBeGreaterThanOrEqual(1);
      expect(types).toBeLessThanOrEqual(4);
      for (const v of vals) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(4); }
      seenCounts.add(types);
    }
    expect([...seenCounts].sort()).toEqual([1, 2, 3, 4]);
  });

  it('rollLooseScrap deterministik: d4=2 memilih dua tipe, masing-masing d4', () => {
    // d4=2 -> 2 tipe; pilih index 0 (bio) lalu index 0 dari sisa (arcane); d4 = 4 dan 3
    const s = rollLooseScrap(seq(dieValue(2, 4), 0, dieValue(4, 4), 0, dieValue(3, 4)));
    expect(s).toEqual({ bio: 4, arcane: 3, mech: 0, ferrous: 0 });
  });

  it('distribusi jumlah item Jackpot: 2 (50%), 3 (50%), tidak pernah 4', () => {
    const rng = seeded(99);
    const counts: Record<number, number> = { 2: 0, 3: 0, 4: 0 };
    const n = 20000;
    for (let i = 0; i < n; i++) counts[rollJackpotCount(rng).count]++;
    expect(counts[2] / n).toBeGreaterThan(0.47);
    expect(counts[2] / n).toBeLessThan(0.53);
    expect(counts[3] / n).toBeGreaterThan(0.47);
    expect(counts[3] / n).toBeLessThan(0.53);
    expect(counts[4]).toBe(0);
  });

  it('tanpa pool Rare Find, jatuh ke Jackpot', () => {
    const o = resolveScavenge(
      seq(dieValue(20, 20), 0.1, 0.99, 0.1, 0.9),
      { modifier: 0, advantage: false, guidance: false, intModifier: 0 },
      { ...zone, rareItems: [] },
    );
    expect(o.kind).toBe('jackpot');
  });

  it('distribusi Nat 20 mendekati 25% / 75% (10.000 sampel)', () => {
    const rng = seeded(42);
    let rare = 0;
    let jackpot = 0;
    // d20 dipaksa 20 lewat urutan: panggilan pertama 0,999; sisanya acak seeded
    for (let i = 0; i < 10000; i++) {
      let first = true;
      const r: Rng = () => {
        if (first) {
          first = false;
          return 0.999;
        }
        return rng();
      };
      const o = resolveScavenge(r, { modifier: 0, advantage: false, guidance: false, intModifier: 0 }, zone);
      if (o.kind === 'rare') rare++;
      if (o.kind === 'jackpot') jackpot++;
    }
    expect(rare / 10000).toBeGreaterThan(0.22);
    expect(rare / 10000).toBeLessThan(0.28);
    expect(rare + jackpot).toBe(10000);
  });
});

describe('Low Success dan High Success', () => {
  // zone.dc = 12, jadi Low Success = total 12-16, High Success = total >= 17
  const base = { advantage: false, guidance: false };
  const rollTotal = (total: number, intModifier: number, rng?: Rng) =>
    resolveScavenge(rng ?? seq(dieValue(total, 20), 0.1, 0.1, 0.1), { ...base, modifier: 0, intModifier }, zone);

  it('batas: DC-1 Fail, DC Low, DC+4 Low, DC+5 High', () => {
    expect(rollTotal(11, 4).kind).toBe('fail');
    expect(rollTotal(12, 4).kind).toBe('low_success');
    expect(rollTotal(16, 4).kind).toBe('low_success');
    expect(rollTotal(17, 4).kind).toBe('high_success');
    expect(rollTotal(19, 4).kind).toBe('high_success');
  });

  it('Low Success tidak memberi item, hanya loose scrap', () => {
    const o = rollTotal(14, 4);
    expect(o.itemIds).toEqual([]);
    expect(o.looseScrap).toBeDefined();
    expect(scrapTotal(o.looseScrap!)).toBe(2);
    expect(o.exhaustion).toBe(false);
  });

  it('High Success memberi 1 junk item utuh dari pool biasa, tanpa loose scrap', () => {
    const o = rollTotal(18, 4, seq(dieValue(18, 20), 0));
    expect(o.itemIds).toEqual(['kerang']);
    expect(o.looseScrap).toBeUndefined();
  });

  it('jumlah loose scrap = floor(mod INT / 2), minimal 0', () => {
    const expected: [number, number][] = [[-5, 0], [-1, 0], [0, 0], [1, 0], [2, 1], [3, 1], [4, 2], [5, 2], [6, 3]];
    for (const [mod, count] of expected) expect(lowSuccessScrapCount(mod)).toBe(count);
  });

  it('INT mod 0-1 atau minus: Low Success tetap tercatat tapi tidak dapat apa-apa', () => {
    for (const mod of [-2, 0, 1]) {
      const o = rollTotal(13, mod);
      expect(o.kind).toBe('low_success');
      expect(o.itemIds).toEqual([]);
      expect(scrapTotal(o.looseScrap ?? emptyScrap())).toBe(0);
    }
  });

  it('tiap loose scrap diundi tipenya sendiri-sendiri (boleh sama)', () => {
    // bio, bio, ferrous, mech: rng 0.1 -> bio, 0.1 -> bio, 0.9 -> ferrous, 0.6 -> mech
    const s = rollLowSuccessScrap(seq(0.1, 0.1, 0.9, 0.6), 4);
    expect(s).toEqual({ bio: 2, arcane: 0, mech: 1, ferrous: 1 });
  });

  it('distribusi tipe loose scrap merata dan total = jumlah (10.000 sampel)', () => {
    const rng = seeded(11);
    const sum = emptyScrap();
    for (let i = 0; i < 10000; i++) {
      const s = rollLowSuccessScrap(rng, 2);
      expect(scrapTotal(s)).toBe(2);
      sum.bio += s.bio;
      sum.arcane += s.arcane;
      sum.mech += s.mech;
      sum.ferrous += s.ferrous;
    }
    for (const v of Object.values(sum)) {
      expect(v / 20000).toBeGreaterThan(0.23);
      expect(v / 20000).toBeLessThan(0.27);
    }
  });

  it('Nat 20 dan Nat 1 tidak terpengaruh margin DC', () => {
    expect(resolveScavenge(seq(dieValue(20, 20), 0.5, dieValue(2, 4), 0.1, 0.9), { ...base, modifier: -30, intModifier: 4 }, zone).kind).toBe('jackpot');
    expect(resolveScavenge(seq(dieValue(1, 20)), { ...base, modifier: 30, intModifier: 4 }, zone).kind).toBe('fail');
  });

  it('Guidance ikut menentukan tingkat hasil lewat total', () => {
    // d20 = 10, mod 0, Guidance d4 = 4 -> total 14 (Low); tanpa Guidance total 10 (Fail)
    const withG = resolveScavenge(seq(dieValue(10, 20), dieValue(4, 4), 0.1), { ...base, guidance: true, modifier: 0, intModifier: 2 }, zone);
    expect(withG.roll.total).toBe(14);
    expect(withG.kind).toBe('low_success');
  });
});

describe('simpan sebagian scrap', () => {
  const scrap = { bio: 3, arcane: 0, mech: 2, ferrous: 4 };

  it('freeQuarters: sisa ruang dalam kuartal, tidak pernah negatif', () => {
    expect(freeQuarters(19, 4 * 18)).toBe(4);
    expect(freeQuarters(19, 4 * 19)).toBe(0);
    expect(freeQuarters(19, 4 * 21)).toBe(0); // melebihi kapasitas
  });

  it('suggestKeepScrap mengisi berurutan sampai ruang habis', () => {
    expect(suggestKeepScrap(scrap, 4)).toEqual({ bio: 3, arcane: 0, mech: 1, ferrous: 0 });
    expect(suggestKeepScrap(scrap, 0)).toEqual(emptyScrap());
    expect(suggestKeepScrap(scrap, 400)).toEqual(scrap);
  });

  it('suggestKeepScrap selalu muat di ruang yang ada', () => {
    for (let free = 0; free <= 12; free++) {
      expect(checkFit(10, 10 * 4 - free, scrapTotal(suggestKeepScrap(scrap, free)) * 1).fits).toBe(true);
    }
  });

  it('clampKeepScrap membatasi ke 0..jumlah asli dan membulatkan ke bawah', () => {
    expect(clampKeepScrap(scrap, { bio: 99, arcane: 5, mech: -3, ferrous: 2.9 })).toEqual({ bio: 3, arcane: 0, mech: 0, ferrous: 2 });
    expect(clampKeepScrap(scrap, { bio: NaN })).toEqual(emptyScrap());
    expect(clampKeepScrap(scrap, {})).toEqual(emptyScrap());
  });

  it('remainderScrap = asli dikurangi yang disimpan; simpan + buang = asli', () => {
    const keep = clampKeepScrap(scrap, { bio: 1, mech: 2, ferrous: 0 });
    const drop = remainderScrap(scrap, keep);
    expect(drop).toEqual({ bio: 2, arcane: 0, mech: 0, ferrous: 4 });
    expect(scrapTotal(keep) + scrapTotal(drop)).toBe(scrapTotal(scrap));
  });
});

describe('pemilihan berbobot', () => {
  it('distribusi sesuai bobot', () => {
    const rng = seeded(7);
    const entries = [
      { itemId: 'a', weight: 30 },
      { itemId: 'b', weight: 20 },
      { itemId: 'c', weight: 1 },
    ];
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    const n = 51000;
    for (let i = 0; i < n; i++) counts[weightedPick(rng, entries)!]++;
    expect(counts.a / n).toBeGreaterThan(0.57);
    expect(counts.a / n).toBeLessThan(0.60);
    expect(counts.c / n).toBeGreaterThan(0.015);
    expect(counts.c / n).toBeLessThan(0.025);
  });

  it('daftar kosong atau bobot nol mengembalikan null', () => {
    expect(weightedPick(() => 0.5, [])).toBeNull();
    expect(weightedPick(() => 0.5, [{ itemId: 'a', weight: 0 }])).toBeNull();
  });

  it('dropChances menjumlah 100%', () => {
    const c = dropChances([
      { itemId: 'a', weight: 30 },
      { itemId: 'b', weight: 20 },
    ]);
    expect(c[0].percent).toBeCloseTo(60);
    expect(c[1].percent).toBeCloseTo(40);
  });
});

describe('Disadvantage', () => {
  it('Disadvantage mengambil dadu terendah', () => {
    const r = rollScavenge(seq(dieValue(15, 20), dieValue(4, 20)), {
      modifier: 0,
      dc: 12,
      advantage: false,
      disadvantage: true,
      guidance: false,
    });
    expect(r.mode).toBe('disadvantage');
    expect(r.d20Rolls).toEqual([15, 4]);
    expect(r.d20).toBe(4);
    expect(r.success).toBe(false);
  });

  it('Disadvantage: Nat 1 muncul bila salah satu dadu 1', () => {
    const r = rollScavenge(seq(dieValue(20, 20), dieValue(1, 20)), {
      modifier: 0,
      dc: 12,
      advantage: false,
      disadvantage: true,
      guidance: false,
    });
    expect(r.d20).toBe(1);
    expect(r.nat1).toBe(true);
    expect(r.nat20).toBe(false);
  });

  it('Advantage + Disadvantage saling meniadakan (1 dadu, mode normal)', () => {
    expect(rollMode(true, true)).toBe('normal');
    const r = rollScavenge(seq(dieValue(9, 20), dieValue(18, 20)), {
      modifier: 0,
      dc: 12,
      advantage: true,
      disadvantage: true,
      guidance: false,
    });
    expect(r.mode).toBe('normal');
    expect(r.d20Rolls).toEqual([9]);
  });

  it('Disadvantage + Guidance: Guidance tetap +1d4', () => {
    const r = rollScavenge(seq(dieValue(10, 20), dieValue(6, 20), dieValue(2, 4)), {
      modifier: 3,
      dc: 12,
      advantage: false,
      disadvantage: true,
      guidance: true,
    });
    expect(r.d20).toBe(6);
    expect(r.guidanceRoll).toBe(2);
    expect(r.total).toBe(6 + 3 + 2);
  });
});

describe('reset harian WIB', () => {
  it('pergantian hari terjadi pukul 00.00 WIB (17.00 UTC)', () => {
    expect(wibDay(new Date('2026-10-15T16:59:59Z'))).toBe('2026-10-15');
    expect(wibDay(new Date('2026-10-15T17:00:00Z'))).toBe('2026-10-16');
  });

  it('23.59 WIB masih hari yang sama', () => {
    expect(wibDay(new Date('2026-10-15T23:59:00+07:00'))).toBe('2026-10-15');
    expect(wibDay(new Date('2026-10-16T00:00:00+07:00'))).toBe('2026-10-16');
  });
});
describe('class features', () => {
  it('slotCapacity doubles only the base 10', () => {
    expect(slotCapacity({ strScore: 9, slotBonus: 2 })).toBe(21);
    expect(slotCapacity({ strScore: 9, slotBonus: 2, doubleBase: true })).toBe(31);
  });

  it('rerollNat1 rerolls a natural 1 once and keeps the new result', () => {
    const r = rollScavenge(seq(dieValue(1, 20), dieValue(1, 20)), { modifier: 0, dc: 10, advantage: false, guidance: false, rerollNat1: true });
    expect(r.d20).toBe(1); // reroll juga 1: tidak diulang lagi
    expect(r.rerolledNat1).toBe(1);
    const ok = rollScavenge(seq(dieValue(1, 20), dieValue(14, 20)), { modifier: 0, dc: 10, advantage: false, guidance: false, rerollNat1: true });
    expect(ok.d20).toBe(14);
    expect(ok.nat1).toBe(false);
    expect(ok.success).toBe(true);
  });

  it('does not reroll a non-1 or when the feature is off', () => {
    const a = rollScavenge(seq(dieValue(7, 20)), { modifier: 0, dc: 10, advantage: false, guidance: false, rerollNat1: true });
    expect(a.rerolledNat1).toBe(0);
    const b = rollScavenge(seq(dieValue(1, 20)), { modifier: 0, dc: 10, advantage: false, guidance: false });
    expect(b.nat1).toBe(true);
    expect(b.rerolledNat1).toBe(0);
  });

  it('with advantage each die showing 1 is rerolled', () => {
    const r = rollScavenge(seq(dieValue(1, 20), dieValue(9, 20), dieValue(15, 20)), { modifier: 0, dc: 10, advantage: true, guidance: false, rerollNat1: true });
    expect(r.d20Rolls).toEqual([9, 15]);
    expect(r.d20).toBe(15);
    expect(r.rerolledNat1).toBe(1);
  });
});
