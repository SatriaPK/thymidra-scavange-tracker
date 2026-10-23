import { describe, expect, it } from 'vitest';
import { parsePaperImport } from './paper-import';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const bag = { items: [], scrap: {} };
const make = (o: object) => JSON.stringify({ inventory: bag, storage: bag, ...o });

describe('parsePaperImport', () => {
  it('accepts items and scrap, filling missing scrap types with 0', () => {
    const r = parsePaperImport(make({ inventory: { items: [{ itemId: A, qty: 2 }], scrap: { bio: 3 } } }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.inventory.items).toEqual([{ itemId: A, qty: 2 }]);
      expect(r.data.inventory.scrap).toEqual({ bio: 3, arcane: 0, mech: 0, ferrous: 0 });
    }
  });

  it('merges duplicate lines of the same item', () => {
    const r = parsePaperImport(make({ storage: { items: [{ itemId: A, qty: 2 }, { itemId: A, qty: 3 }, { itemId: B, qty: 1 }] } }));
    expect(r.ok && r.data.storage.items).toEqual([{ itemId: A, qty: 5 }, { itemId: B, qty: 1 }]);
  });

  it('rejects empty imports', () => {
    expect(parsePaperImport(make({})).ok).toBe(false);
  });

  it('rejects bad quantities, scrap and ids', () => {
    expect(parsePaperImport(make({ inventory: { items: [{ itemId: A, qty: 0 }] } })).ok).toBe(false);
    expect(parsePaperImport(make({ inventory: { items: [{ itemId: A, qty: 1.5 }] } })).ok).toBe(false);
    expect(parsePaperImport(make({ inventory: { items: [{ itemId: A, qty: 100 }] } })).ok).toBe(false);
    expect(parsePaperImport(make({ inventory: { items: [{ itemId: A, qty: 60 }, { itemId: A, qty: 60 }] } })).ok).toBe(false);
    expect(parsePaperImport(make({ inventory: { items: [{ itemId: 'x', qty: 1 }] } })).ok).toBe(false);
    expect(parsePaperImport(make({ storage: { scrap: { bio: -1 } } })).ok).toBe(false);
    expect(parsePaperImport(make({ storage: { scrap: { bio: 1000 } } })).ok).toBe(false);
  });

  it('rejects malformed JSON', () => {
    expect(parsePaperImport('{oops').ok).toBe(false);
    expect(parsePaperImport('[]').ok).toBe(false);
  });
});
