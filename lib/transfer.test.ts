import { describe, expect, it } from 'vitest';
import { formatCharId, formatItemId, formatZoneId, parseItemId, parseZoneId } from './ids';
import {
  buildItemsExport,
  buildZonesExport,
  missingItemRefs,
  parseItemsImport,
  parseZonesImport,
} from './transfer';

describe('ID tampilan', () => {
  it('item 001, karakter C1', () => {
    expect(formatItemId(1)).toBe('001');
    expect(formatItemId(42)).toBe('042');
    expect(formatItemId(1234)).toBe('1234');
    expect(formatCharId(7)).toBe('C7');
  });

  it('zona AAA, AAB, ..., ABA', () => {
    expect(formatZoneId(1)).toBe('AAA');
    expect(formatZoneId(2)).toBe('AAB');
    expect(formatZoneId(26)).toBe('AAZ');
    expect(formatZoneId(27)).toBe('ABA');
    expect(formatZoneId(26 * 26 + 1)).toBe('BAA');
  });

  it('format lalu parse kembali ke angka yang sama', () => {
    for (const n of [1, 2, 25, 26, 27, 100, 675, 676, 677, 17576, 17577]) {
      expect(parseZoneId(formatZoneId(n))).toBe(n);
      expect(parseItemId(formatItemId(n))).toBe(n);
    }
  });

  it('parse menolak input aneh', () => {
    expect(parseItemId('abc')).toBeNull();
    expect(parseItemId(0)).toBeNull();
    expect(parseItemId(-3)).toBeNull();
    expect(parseItemId(1.5)).toBeNull();
    expect(parseZoneId('A')).toBeNull();
    expect(parseZoneId('123')).toBeNull();
    expect(parseZoneId('aab')).toBe(2);
  });
});

describe('import item', () => {
  it('menerima array biasa dan objek hasil export', () => {
    const row = { name: 'Kerang', category: 'junk', slot: 2, yield: { bio: 2 } };
    expect(parseItemsImport([row]).ok).toBe(true);
    expect(parseItemsImport({ items: [row] }).ok).toBe(true);
  });

  it('wondrous: slot dan yield dipaksa 0', () => {
    const r = parseItemsImport([{ name: 'Relik', category: 'wondrous', slot: 5, yield: { bio: 9 } }]);
    expect(r.ok && r.rows[0]).toMatchObject({ is_wondrous: true, slot_weight: 0, yield_bio: 0 });
  });

  it('crafted: slot dipertahankan, yield dipaksa 0, slot minimal 1', () => {
    const r = parseItemsImport([{ name: 'Pedang', category: 'crafted', slot: 3, yield: { bio: 9 } }]);
    expect(r.ok && r.rows[0]).toMatchObject({ is_crafted: true, is_wondrous: false, slot_weight: 3, yield_bio: 0 });
    expect(parseItemsImport([{ name: 'Pedang', category: 'crafted', slot: 0 }]).ok).toBe(false);
  });

  it('crafted ikut export dan import ulang', () => {
    const exported = buildItemsExport([
      { item_no: 1, name: 'Pedang', slot_weight: 2, is_wondrous: false, is_crafted: true, yield_bio: 0, yield_arcane: 0, yield_mech: 0, yield_ferrous: 0, description: null },
    ]);
    expect(exported.items[0]).toMatchObject({ category: 'crafted', slot: 2 });
    const back = parseItemsImport(JSON.parse(JSON.stringify(exported)));
    expect(back.ok && back.rows[0]).toMatchObject({ is_crafted: true, slot_weight: 2 });
  });

  it('junk tanpa yield ditolak', () => {
    const r = parseItemsImport([{ name: 'Batu', category: 'junk', slot: 1 }]);
    expect(r.ok).toBe(false);
  });

  it('id duplikat dalam file dan id tidak valid ditolak', () => {
    const base = { name: 'A', category: 'junk', yield: { bio: 1 } };
    expect(parseItemsImport([{ ...base, id: 1 }, { ...base, id: '001' }]).ok).toBe(false);
    expect(parseItemsImport([{ ...base, id: 'x' }]).ok).toBe(false);
  });

  it('id opsional, kategori wajib, nilai di luar batas ditolak', () => {
    const r = parseItemsImport([{ name: 'A', category: 'junk', yield: { bio: 1 } }]);
    expect(r.ok && r.rows[0].no).toBeNull();
    expect(parseItemsImport([{ name: 'A' }]).ok).toBe(false);
    expect(parseItemsImport([{ name: 'A', category: 'junk', yield: { bio: 500 } }]).ok).toBe(false);
  });

  it('semua error dikumpulkan, bukan berhenti di yang pertama', () => {
    const r = parseItemsImport([{ name: '', category: 'junk' }, { name: 'B' }]);
    expect(!r.ok && r.errors.length).toBe(2);
  });

  it('file kosong atau bukan array ditolak', () => {
    expect(parseItemsImport([]).ok).toBe(false);
    expect(parseItemsImport({ foo: 1 }).ok).toBe(false);
    expect(parseItemsImport(null).ok).toBe(false);
  });

  it('export lalu import memberi data yang sama', () => {
    const exported = buildItemsExport([
      { item_no: 2, name: 'Besi', slot_weight: 3, is_wondrous: false, yield_bio: 0, yield_arcane: 0, yield_mech: 1, yield_ferrous: 4, description: null },
      { item_no: 1, name: 'Relik', slot_weight: 0, is_wondrous: true, yield_bio: 0, yield_arcane: 0, yield_mech: 0, yield_ferrous: 0, description: 'Kuno' },
    ]);
    expect(exported.items.map((i) => i.id)).toEqual([1, 2]);
    const back = parseItemsImport(JSON.parse(JSON.stringify(exported)));
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(back.rows[1]).toMatchObject({ no: 2, name: 'Besi', slot_weight: 3, yield_mech: 1, yield_ferrous: 4 });
      expect(back.rows[0]).toMatchObject({ no: 1, is_wondrous: true, description: 'Kuno' });
    }
  });
});

describe('import zona', () => {
  it('mengacu item lewat ID, bobot default 10', () => {
    const r = parseZonesImport([{ id: 'AAA', name: 'Sea', dc: 12, junk: [{ item: 1 }, { item: '002', weight: 30 }], rare: [{ item: 10 }] }]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rows[0].no).toBe(1);
      expect(r.rows[0].junk).toEqual([{ itemNo: 1, weight: 10 }, { itemNo: 2, weight: 30 }]);
      expect(r.rows[0].rare).toEqual([{ itemNo: 10, weight: 10 }]);
    }
  });

  it('DC di luar 1-40, bobot 0, dan item ganda ditolak', () => {
    expect(parseZonesImport([{ name: 'A', dc: 0 }]).ok).toBe(false);
    expect(parseZonesImport([{ name: 'A', dc: 41 }]).ok).toBe(false);
    expect(parseZonesImport([{ name: 'A', dc: 10, junk: [{ item: 1, weight: 0 }] }]).ok).toBe(false);
    expect(parseZonesImport([{ name: 'A', dc: 10, junk: [{ item: 1 }, { item: 1 }] }]).ok).toBe(false);
  });

  it('id zona harus huruf, bukan angka', () => {
    expect(parseZonesImport([{ id: 'A1', name: 'A', dc: 10 }]).ok).toBe(false);
    expect(parseZonesImport([{ id: 'AAA', name: 'A', dc: 10 }, { id: 'aaa', name: 'B', dc: 10 }]).ok).toBe(false);
  });

  it('missingItemRefs menandai ID item yang tidak ada', () => {
    const r = parseZonesImport([{ name: 'Sea', dc: 12, junk: [{ item: 1 }, { item: 7 }], rare: [{ item: 9 }] }]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const errs = missingItemRefs(r.rows, new Set([1, 2, 3]));
      expect(errs).toHaveLength(1);
      expect(errs[0]).toContain('007');
      expect(errs[0]).toContain('009');
      expect(missingItemRefs(r.rows, new Set([1, 7, 9]))).toEqual([]);
    }
  });

  it('export zona memakai ID item, bukan uuid, dan bisa di-import ulang', () => {
    const exported = buildZonesExport(
      [{ id: 'uuid-z', zone_no: 3, name: 'Bastion', dc: 15 }],
      [
        { zone_id: 'uuid-z', weight: 20, is_rare: false, item_no: 5 },
        { zone_id: 'uuid-z', weight: 1, is_rare: true, item_no: 2 },
        { zone_id: 'other', weight: 9, is_rare: false, item_no: 8 },
      ],
    );
    expect(exported.zones[0]).toEqual({
      id: 'AAC',
      name: 'Bastion',
      dc: 15,
      junk: [{ item: 5, weight: 20 }],
      rare: [{ item: 2, weight: 1 }],
    });
    const back = parseZonesImport(JSON.parse(JSON.stringify(exported)));
    expect(back.ok && back.rows[0]).toMatchObject({ no: 3, dc: 15 });
  });
});
