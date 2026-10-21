import { describe, expect, it } from 'vitest';
import { emptyScrap, type ItemDef, type Scrap } from './core';
import {
  bundleIsEmpty,
  bundleQuarters,
  checkTrade,
  covers,
  describeBundle,
  emptyBundle,
  parseBundle,
  serializeBundle,
  type Bundle,
  type Party,
} from './barter';

const junk = (id: string, slotWeight: number, bio = 1): ItemDef => ({
  id,
  name: id,
  slotWeight,
  yield: { bio, arcane: 0, mech: 0, ferrous: 0 },
});
// Wondrous: tanpa yield, tidak memakan slot
const wondrous: ItemDef = { id: 'relik', name: 'relik', slotWeight: 0, yield: emptyScrap() };

const defs = new Map<string, ItemDef>([
  ['gear', junk('gear', 2)], // 2 slot = 8 kuartal
  ['kerang', junk('kerang', 1)], // 1 slot = 4 kuartal
  ['relik', wondrous],
]);

const scrap = (s: Partial<Scrap> = {}): Scrap => ({ ...emptyScrap(), ...s });
const bundle = (items: [string, number][] = [], s: Partial<Scrap> = {}): Bundle => ({
  items: items.map(([itemId, qty]) => ({ itemId, qty })),
  scrap: scrap(s),
});
const party = (items: [string, number][], s: Partial<Scrap>, usedQ: number, capacitySlots: number): Party => ({
  items: new Map(items),
  scrap: scrap(s),
  usedQ,
  capacityQ: capacitySlots * 4,
});

describe('parseBundle / serializeBundle', () => {
  it('membaca bentuk JSON database', () => {
    const b = parseBundle({ items: [{ item_id: 'gear', qty: 2 }], scrap: { bio: 3, mech: 1 } });
    expect(b.items).toEqual([{ itemId: 'gear', qty: 2 }]);
    expect(b.scrap).toEqual(scrap({ bio: 3, mech: 1 }));
  });

  it('membuang entri tidak valid dan menggabungkan item kembar', () => {
    const b = parseBundle({
      items: [
        { item_id: 'gear', qty: 1 },
        { item_id: 'gear', qty: 2 },
        { item_id: 'kerang', qty: 0 },
        { item_id: 'kerang', qty: -3 },
        { item_id: 5, qty: 1 },
        { qty: 1 },
        null,
      ],
      scrap: { bio: -2, arcane: 'abc', mech: 2.9, ferrous: 4 },
    });
    expect(b.items).toEqual([{ itemId: 'gear', qty: 3 }]);
    expect(b.scrap).toEqual(scrap({ mech: 2, ferrous: 4 }));
  });

  it('input kosong atau aneh menjadi bundle kosong', () => {
    for (const raw of [null, undefined, 'x', 5, [], {}]) expect(bundleIsEmpty(parseBundle(raw))).toBe(true);
  });

  it('serialize lalu parse mengembalikan bundle yang sama', () => {
    const b = bundle([['gear', 2], ['kerang', 1]], { bio: 1, ferrous: 5 });
    expect(parseBundle(serializeBundle(b))).toEqual(b);
  });
});

describe('covers dan bundleQuarters', () => {
  it('covers: cukup bila tiap item dan tiap jenis scrap tersedia', () => {
    const p = party([['gear', 2]], { bio: 3 }, 0, 10);
    expect(covers(p, bundle([['gear', 2]], { bio: 3 }))).toBe(true);
    expect(covers(p, bundle([['gear', 3]]))).toBe(false);
    expect(covers(p, bundle([], { bio: 4 }))).toBe(false);
    expect(covers(p, bundle([['kerang', 1]]))).toBe(false);
    expect(covers(p, emptyBundle())).toBe(true);
  });

  it('bundleQuarters: item x jumlah + scrap x 0,25 slot; wondrous tidak memakan slot', () => {
    expect(bundleQuarters(bundle([['gear', 2]], { bio: 3 }), defs)).toBe(2 * 8 + 3);
    expect(bundleQuarters(bundle([['relik', 5]]), defs)).toBe(0);
    expect(bundleQuarters(bundle([['hilang', 1]]), defs)).toBeNull();
  });
});

describe('checkTrade: Kasih (give)', () => {
  const sender = party([['gear', 2]], { bio: 4 }, 20, 10);

  it('berhasil bila penerima punya ruang', () => {
    const receiver = party([], {}, 0, 10);
    expect(checkTrade({ mode: 'give', offer: bundle([['gear', 1]], { bio: 2 }), request: emptyBundle(), sender, receiver, defs })).toEqual({ ok: true });
  });

  it('penerima penuh: belum bisa diterima, melaporkan kekurangan ruang', () => {
    // kapasitas 10 slot = 40 kuartal, terpakai 36; gear = 8 kuartal -> kurang 4
    const receiver = party([], {}, 36, 10);
    expect(checkTrade({ mode: 'give', offer: bundle([['gear', 1]]), request: emptyBundle(), sender, receiver, defs })).toEqual({
      ok: false,
      reason: 'no_room_receiver',
      overQ: 4,
    });
  });

  it('pas penuh masih muat', () => {
    const receiver = party([], {}, 32, 10);
    expect(checkTrade({ mode: 'give', offer: bundle([['gear', 1]]), request: emptyBundle(), sender, receiver, defs }).ok).toBe(true);
  });

  it('scrap ikut dihitung 0,25 slot per unit', () => {
    const receiver = party([], {}, 38, 10); // sisa 2 kuartal
    expect(checkTrade({ mode: 'give', offer: bundle([], { bio: 2 }), request: emptyBundle(), sender, receiver, defs }).ok).toBe(true);
    expect(checkTrade({ mode: 'give', offer: bundle([], { bio: 3 }), request: emptyBundle(), sender, receiver, defs })).toEqual({
      ok: false,
      reason: 'no_room_receiver',
      overQ: 1,
    });
  });

  it('wondrous tidak butuh ruang walau penerima penuh', () => {
    const s = party([['relik', 1]], {}, 0, 10);
    const receiver = party([], {}, 40, 10);
    expect(checkTrade({ mode: 'give', offer: bundle([['relik', 1]]), request: emptyBundle(), sender: s, receiver, defs }).ok).toBe(true);
  });

  it('barang pengirim berubah/hilang: tawaran dianggap berubah (batal otomatis)', () => {
    const receiver = party([], {}, 0, 10);
    const base = { mode: 'give' as const, request: emptyBundle(), receiver, defs };
    expect(checkTrade({ ...base, offer: bundle([['gear', 3]]), sender })).toEqual({ ok: false, reason: 'changed' });
    expect(checkTrade({ ...base, offer: bundle([], { bio: 5 }), sender })).toEqual({ ok: false, reason: 'changed' });
    expect(checkTrade({ ...base, offer: bundle([['kerang', 1]]), sender })).toEqual({ ok: false, reason: 'changed' });
  });

  it('item yang sudah tidak dikenal (dihapus DM) dianggap berubah', () => {
    const s = party([['hilang', 1]], {}, 0, 10);
    const receiver = party([], {}, 0, 10);
    expect(checkTrade({ mode: 'give', offer: bundle([['hilang', 1]]), request: emptyBundle(), sender: s, receiver, defs })).toEqual({
      ok: false,
      reason: 'changed',
    });
  });

  it('request diabaikan pada mode give', () => {
    const receiver = party([], {}, 0, 10);
    expect(checkTrade({ mode: 'give', offer: bundle([['gear', 1]]), request: bundle([['kerang', 99]]), sender, receiver, defs }).ok).toBe(true);
  });
});

describe('checkTrade: Tukar (swap)', () => {
  it('berhasil bila kedua pihak punya barang dan ruang', () => {
    const a = party([['gear', 1]], {}, 8, 10);
    const b = party([['kerang', 2]], {}, 8, 10);
    expect(checkTrade({ mode: 'swap', offer: bundle([['gear', 1]]), request: bundle([['kerang', 2]]), sender: a, receiver: b, defs }).ok).toBe(true);
  });

  it('penerima kehilangan barang yang diminta: berubah', () => {
    const a = party([['gear', 1]], {}, 8, 10);
    const b = party([['kerang', 1]], {}, 4, 10);
    expect(checkTrade({ mode: 'swap', offer: bundle([['gear', 1]]), request: bundle([['kerang', 2]]), sender: a, receiver: b, defs })).toEqual({
      ok: false,
      reason: 'changed',
    });
  });

  it('hanya selisih bersih yang dihitung: tukar gear (2 slot) dengan 2 kerang (2 slot) tetap muat walau penuh', () => {
    const a = party([['gear', 1]], {}, 40, 10); // penuh
    const b = party([['kerang', 2]], {}, 40, 10); // penuh
    expect(checkTrade({ mode: 'swap', offer: bundle([['gear', 1]]), request: bundle([['kerang', 2]]), sender: a, receiver: b, defs }).ok).toBe(true);
  });

  it('penerima menerima barang lebih besar dari yang dilepas: kurang ruang', () => {
    const a = party([['gear', 1]], {}, 8, 10);
    const b = party([['kerang', 1]], {}, 40, 10); // penuh; menerima 8, melepas 4 -> kurang 4
    expect(checkTrade({ mode: 'swap', offer: bundle([['gear', 1]]), request: bundle([['kerang', 1]]), sender: a, receiver: b, defs })).toEqual({
      ok: false,
      reason: 'no_room_receiver',
      overQ: 4,
    });
  });

  it('pengirim kekurangan ruang untuk barang yang diminta', () => {
    const a = party([['kerang', 1]], {}, 40, 10); // penuh; melepas 4, menerima 8 -> kurang 4
    const b = party([['gear', 1]], {}, 8, 10);
    expect(checkTrade({ mode: 'swap', offer: bundle([['kerang', 1]]), request: bundle([['gear', 1]]), sender: a, receiver: b, defs })).toEqual({
      ok: false,
      reason: 'no_room_sender',
      overQ: 4,
    });
  });

  it('scrap bisa ditukar per jenis dan jumlah', () => {
    const a = party([], { bio: 5 }, 2, 10);
    const b = party([], { mech: 3 }, 2, 10);
    expect(checkTrade({ mode: 'swap', offer: bundle([], { bio: 5 }), request: bundle([], { mech: 3 }), sender: a, receiver: b, defs }).ok).toBe(true);
    expect(checkTrade({ mode: 'swap', offer: bundle([], { bio: 5 }), request: bundle([], { mech: 4 }), sender: a, receiver: b, defs })).toEqual({
      ok: false,
      reason: 'changed',
    });
  });

  it('pihak yang sudah melebihi kapasitas boleh menerima selama tidak bertambah', () => {
    const a = party([['gear', 1]], {}, 44, 10); // melebihi kapasitas (STR turun)
    const b = party([['kerang', 2]], {}, 8, 10);
    // a melepas 8 menerima 8 -> net 0 -> boleh
    expect(checkTrade({ mode: 'swap', offer: bundle([['gear', 1]]), request: bundle([['kerang', 2]]), sender: a, receiver: b, defs }).ok).toBe(true);
  });
});

describe('describeBundle', () => {
  const names = new Map([['gear', 'Rusty Gear'], ['kerang', 'Kerang']]);
  it('menulis item lalu scrap, atau "nothing"', () => {
    expect(describeBundle(bundle([['gear', 2]], { bio: 3, mech: 1 }), names)).toBe('2x Rusty Gear, 3 Bio, 1 Mech');
    expect(describeBundle(bundle([['hilang', 1]]), names)).toBe('1x Unknown item');
    expect(describeBundle(emptyBundle(), names)).toBe('nothing');
  });
});
