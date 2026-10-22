// Format JSON untuk import/export item dan zona. Semua fungsi murni (tanpa database).
import { z } from 'zod';
import { formatItemId, formatZoneId, parseItemId, parseZoneId } from './ids';
import { itemCategory, type ItemCategory } from './item';

export const MAX_IMPORT_ROWS = 1000;

// ---------------- Item ----------------

export interface ItemExportRow {
  id: number;
  name: string;
  category: ItemCategory;
  slot: number;
  yield: { arcane: number; bio: number; ferrous: number; mech: number };
  description: string;
}

export interface ItemLike {
  item_no: number;
  name: string;
  slot_weight: number;
  is_wondrous: boolean;
  is_crafted?: boolean;
  yield_bio: number;
  yield_arcane: number;
  yield_mech: number;
  yield_ferrous: number;
  description: string | null;
}

export function buildItemsExport(items: ItemLike[]) {
  const rows: ItemExportRow[] = items
    .slice()
    .sort((a, b) => a.item_no - b.item_no)
    .map((i) => ({
      id: i.item_no,
      name: i.name,
      category: itemCategory(i),
      slot: i.is_wondrous ? 0 : i.slot_weight,
      yield: { arcane: i.yield_arcane, bio: i.yield_bio, ferrous: i.yield_ferrous, mech: i.yield_mech },
      description: i.description ?? '',
    }));
  return { type: 'scavenge-items', version: 1, items: rows };
}

const small = z.coerce.number().int().min(0).max(99);
const idField = z.union([z.number(), z.string()]);

const itemRowSchema = z.object({
  id: idField.optional(),
  name: z.string().trim().min(1, 'name is required').max(80),
  category: z.enum(['junk', 'wondrous', 'crafted']),
  slot: small.optional(),
  yield: z
    .object({ arcane: small.optional(), bio: small.optional(), ferrous: small.optional(), mech: small.optional() })
    .optional(),
  description: z.string().trim().max(500).nullish(),
});

export interface ItemImportRow {
  no: number | null;
  name: string;
  is_wondrous: boolean;
  is_crafted: boolean;
  slot_weight: number;
  yield_bio: number;
  yield_arcane: number;
  yield_mech: number;
  yield_ferrous: number;
  description: string | null;
}

export type ParseResult<T> = { ok: true; rows: T[] } | { ok: false; errors: string[] };

/** Menerima array item, atau objek { items: [...] } hasil export. */
export function parseItemsImport(raw: unknown): ParseResult<ItemImportRow> {
  const list = Array.isArray(raw) ? raw : (raw as { items?: unknown } | null)?.items;
  if (!Array.isArray(list)) return { ok: false, errors: ['File must contain an "items" array.'] };
  if (list.length === 0) return { ok: false, errors: ['File has no items.'] };
  if (list.length > MAX_IMPORT_ROWS) return { ok: false, errors: [`Too many items (max ${MAX_IMPORT_ROWS}).`] };

  const errors: string[] = [];
  const rows: ItemImportRow[] = [];
  const seen = new Set<number>();

  list.forEach((entry, idx) => {
    const label = `Item #${idx + 1}`;
    const parsed = itemRowSchema.safeParse(entry);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      errors.push(`${label}: ${issue.path.join('.') || 'row'} ${issue.message}`);
      return;
    }
    const d = parsed.data;

    let no: number | null = null;
    if (d.id !== undefined && d.id !== null && d.id !== '') {
      no = parseItemId(d.id);
      if (no === null) {
        errors.push(`${label}: invalid id "${String(d.id)}"`);
        return;
      }
      if (seen.has(no)) {
        errors.push(`${label}: duplicate id ${formatItemId(no)} in file`);
        return;
      }
      seen.add(no);
    }

    const wondrous = d.category === 'wondrous';
    const crafted = d.category === 'crafted';
    const junk = d.category === 'junk';
    const y = d.yield ?? {};
    const row: ItemImportRow = {
      no,
      name: d.name,
      is_wondrous: wondrous,
      is_crafted: crafted,
      slot_weight: wondrous ? 0 : (d.slot ?? 1),
      yield_bio: junk ? (y.bio ?? 0) : 0,
      yield_arcane: junk ? (y.arcane ?? 0) : 0,
      yield_mech: junk ? (y.mech ?? 0) : 0,
      yield_ferrous: junk ? (y.ferrous ?? 0) : 0,
      description: d.description || null,
    };
    if (crafted && row.slot_weight < 1) {
      errors.push(`${label} (${d.name}): crafted item needs a slot of at least 1`);
      return;
    }
    if (junk && row.yield_bio + row.yield_arcane + row.yield_mech + row.yield_ferrous === 0) {
      errors.push(`${label} (${d.name}): junk item needs at least 1 yield`);
      return;
    }
    rows.push(row);
  });

  return errors.length ? { ok: false, errors } : { ok: true, rows };
}

// ---------------- Zona ----------------

export interface ZoneExportRow {
  id: string;
  name: string;
  dc: number;
  junk: { item: number; weight: number }[];
  rare: { item: number; weight: number }[];
}

export function buildZonesExport(
  zones: { id: string; zone_no: number; name: string; dc: number }[],
  entries: { zone_id: string; weight: number; is_rare: boolean; item_no: number }[],
) {
  const rows: ZoneExportRow[] = zones
    .slice()
    .sort((a, b) => a.zone_no - b.zone_no)
    .map((z) => {
      const mine = entries.filter((e) => e.zone_id === z.id).sort((a, b) => a.item_no - b.item_no);
      return {
        id: formatZoneId(z.zone_no),
        name: z.name,
        dc: z.dc,
        junk: mine.filter((e) => !e.is_rare).map((e) => ({ item: e.item_no, weight: e.weight })),
        rare: mine.filter((e) => e.is_rare).map((e) => ({ item: e.item_no, weight: e.weight })),
      };
    });
  return { type: 'scavenge-zones', version: 1, zones: rows };
}

const weightField = z.coerce.number().int().min(1).max(9999);
const poolEntrySchema = z.object({ item: idField, weight: weightField.optional() });
const zoneRowSchema = z.object({
  id: idField.optional(),
  name: z.string().trim().min(1, 'name is required').max(60),
  dc: z.coerce.number().int().min(1).max(40),
  junk: z.array(poolEntrySchema).max(MAX_IMPORT_ROWS).optional(),
  rare: z.array(poolEntrySchema).max(MAX_IMPORT_ROWS).optional(),
});

export interface ZoneImportRow {
  no: number | null;
  name: string;
  dc: number;
  junk: { itemNo: number; weight: number }[];
  rare: { itemNo: number; weight: number }[];
}

export const DEFAULT_WEIGHT = 10;

/** Menerima array zona, atau objek { zones: [...] } hasil export. Item dirujuk lewat ID item. */
export function parseZonesImport(raw: unknown): ParseResult<ZoneImportRow> {
  const list = Array.isArray(raw) ? raw : (raw as { zones?: unknown } | null)?.zones;
  if (!Array.isArray(list)) return { ok: false, errors: ['File must contain a "zones" array.'] };
  if (list.length === 0) return { ok: false, errors: ['File has no zones.'] };
  if (list.length > MAX_IMPORT_ROWS) return { ok: false, errors: [`Too many zones (max ${MAX_IMPORT_ROWS}).`] };

  const errors: string[] = [];
  const rows: ZoneImportRow[] = [];
  const seen = new Set<number>();

  list.forEach((entry, idx) => {
    const label = `Zone #${idx + 1}`;
    const parsed = zoneRowSchema.safeParse(entry);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      errors.push(`${label}: ${issue.path.join('.') || 'row'} ${issue.message}`);
      return;
    }
    const d = parsed.data;

    let no: number | null = null;
    if (d.id !== undefined && d.id !== null && d.id !== '') {
      no = parseZoneId(d.id);
      if (no === null) {
        errors.push(`${label}: invalid id "${String(d.id)}" (expected letters like AAA)`);
        return;
      }
      if (seen.has(no)) {
        errors.push(`${label}: duplicate id ${formatZoneId(no)} in file`);
        return;
      }
      seen.add(no);
    }

    const pool = (entries: { item: string | number; weight?: number }[] | undefined, poolName: string) => {
      const out: { itemNo: number; weight: number }[] = [];
      const used = new Set<number>();
      for (const e of entries ?? []) {
        const itemNo = parseItemId(e.item);
        if (itemNo === null) {
          errors.push(`${label} ${poolName}: invalid item id "${String(e.item)}"`);
          continue;
        }
        if (used.has(itemNo)) {
          errors.push(`${label} ${poolName}: item ${formatItemId(itemNo)} listed twice`);
          continue;
        }
        used.add(itemNo);
        out.push({ itemNo, weight: e.weight ?? DEFAULT_WEIGHT });
      }
      return out;
    };

    rows.push({ no, name: d.name, dc: d.dc, junk: pool(d.junk, 'junk'), rare: pool(d.rare, 'rare') });
  });

  return errors.length ? { ok: false, errors } : { ok: true, rows };
}

/** ID item yang dirujuk zona tapi tidak ada di campaign. */
export function missingItemRefs(zones: ZoneImportRow[], knownItemNos: Set<number>): string[] {
  const errors: string[] = [];
  zones.forEach((z, idx) => {
    const missing = new Set<number>();
    for (const e of [...z.junk, ...z.rare]) if (!knownItemNos.has(e.itemNo)) missing.add(e.itemNo);
    if (missing.size) {
      const ids = [...missing].map(formatItemId).join(', ');
      errors.push(`Zone #${idx + 1} (${z.name}): unknown item id ${ids}`);
    }
  });
  return errors;
}
