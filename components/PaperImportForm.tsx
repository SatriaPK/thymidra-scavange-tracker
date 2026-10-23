'use client';

import { useMemo, useState } from 'react';
import { importFromPaper } from '@/lib/actions/paper-import';
import { SCRAP_TYPES, emptyScrap, quartersToSlots, scrapQuarters, type Scrap, type ScrapType } from '@/lib/core';
import { formatItemId } from '@/lib/ids';
import { SearchIcon } from './Icons';
import { ConfirmSubmit } from './ConfirmSubmit';

export interface ImportItem {
  id: string;
  no: number;
  name: string;
  wondrous: boolean;
  /** Kuartal per buah (0 = tidak memakan slot). */
  quarters: number;
  yieldText: string;
}

type Loc = 'inventory' | 'storage';
interface Bag {
  qty: Record<string, number>;
  scrap: Scrap;
}

const MAX_QTY = 99;
const MAX_SCRAP = 999;
const cap = (t: string) => `${t[0].toUpperCase()}${t.slice(1)}`;
const clamp = (n: number, max: number) => Math.min(max, Math.max(0, Math.floor(Number.isFinite(n) ? n : 0)));

/** Impor satu kali dari catatan kertas: cari item, isi jumlah scrap, lalu kirim. */
export function PaperImportForm({ items, capacity, usedQ }: { items: ImportItem[]; capacity: number; usedQ: number }) {
  const [loc, setLoc] = useState<Loc>('inventory');
  const [query, setQuery] = useState('');
  const [bags, setBags] = useState<Record<Loc, Bag>>({
    inventory: { qty: {}, scrap: emptyScrap() },
    storage: { qty: {}, scrap: emptyScrap() },
  });

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const q = query.trim().toLowerCase();
  const results = q ? items.filter((i) => `${i.name} ${formatItemId(i.no)}`.toLowerCase().includes(q)).slice(0, 30) : [];

  const update = (l: Loc, fn: (b: Bag) => Bag) => setBags((p) => ({ ...p, [l]: fn(p[l]) }));
  const setQty = (l: Loc, id: string, n: number) =>
    update(l, (b) => {
      const qty = { ...b.qty };
      if (n <= 0) delete qty[id];
      else qty[id] = Math.min(MAX_QTY, n);
      return { ...b, qty };
    });
  const setScrap = (l: Loc, t: ScrapType, n: number) => update(l, (b) => ({ ...b, scrap: { ...b.scrap, [t]: clamp(n, MAX_SCRAP) } }));

  const quartersOf = (b: Bag) =>
    Object.entries(b.qty).reduce((s, [id, n]) => s + (byId.get(id)?.quarters ?? 0) * n, 0) + scrapQuarters(b.scrap);
  const addQ = quartersOf(bags.inventory);
  const over = usedQ + addQ > capacity * 4;
  const lineCount = (b: Bag) => Object.keys(b.qty).length;
  const isEmpty = (b: Bag) => lineCount(b) === 0 && scrapQuarters(b.scrap) === 0;
  const nothing = isEmpty(bags.inventory) && isEmpty(bags.storage);

  const payload = JSON.stringify(
    Object.fromEntries(
      (['inventory', 'storage'] as Loc[]).map((l) => [
        l,
        { items: Object.entries(bags[l].qty).map(([itemId, qty]) => ({ itemId, qty })), scrap: bags[l].scrap },
      ]),
    ),
  );

  const bag = bags[loc];

  return (
    <form action={importFromPaper}>
      <input type="hidden" name="payload" value={payload} />

      <section className="sec">
        <h2>Import from paper</h2>
        <p className="note">
          Enter what your paper sheet says. You can do this <strong>once</strong>; after you submit, it closes and only your DM can open it again.
        </p>
        <div className="chips" role="tablist" aria-label="Destination">
          {(['inventory', 'storage'] as Loc[]).map((l) => (
            <button key={l} type="button" role="tab" className="chip chip-toggle" aria-pressed={loc === l} onClick={() => setLoc(l)}>
              <span>{cap(l)}{!isEmpty(bags[l]) ? ' •' : ''}</span>
            </button>
          ))}
        </div>
        <p className="note">Adding to <strong>{cap(loc)}</strong>.</p>
      </section>

      <section className="sec">
        <h3>Scrap</h3>
        <div className="keep-grid">
          {SCRAP_TYPES.map((t) => (
            <label key={t}>
              <span>{cap(t)}</span>
              <input
                type="number"
                min={0}
                max={MAX_SCRAP}
                inputMode="numeric"
                value={bag.scrap[t] || ''}
                placeholder="0"
                onChange={(e) => setScrap(loc, t, Number(e.target.value))}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="sec">
        <h3>Items</h3>
        <label className="search">
          <SearchIcon />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search item to add..." aria-label="Search item" />
        </label>
        {q && (
          results.length === 0 ? (
            <p className="empty">No match. If the item is missing, ask your DM to create it.</p>
          ) : (
            <div className="list">
              {results.map((i) => (
                <button key={i.id} type="button" className="pick" onClick={() => setQty(loc, i.id, (bag.qty[i.id] ?? 0) + 1)}>
                  <div>
                    <span className="title">{i.name}</span>
                    <span className="tag">[ {i.wondrous ? 'Wondrous' : quartersToSlots(i.quarters)} ]</span>
                    {bag.qty[i.id] ? <span className="tag">added ×{bag.qty[i.id]}</span> : null}
                  </div>
                  <div className="subline">ID {formatItemId(i.no)}{i.yieldText ? ` · ${i.yieldText}` : ''} · tap to add</div>
                </button>
              ))}
            </div>
          )
        )}
      </section>

      {(['inventory', 'storage'] as Loc[]).map((l) =>
        lineCount(bags[l]) === 0 ? null : (
          <section key={l} className="sec">
            <h3>{cap(l)} items</h3>
            <div className="list">
              {Object.entries(bags[l].qty).map(([id, n]) => {
                const item = byId.get(id);
                return (
                  <div key={id} className="item-row">
                    <div className="main" style={{ cursor: 'default' }}>
                      <div><span className="title">{item?.name ?? '?'}</span></div>
                      <div className="subline">ID {item ? formatItemId(item.no) : '?'}</div>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={MAX_QTY}
                      value={n}
                      aria-label={`Quantity of ${item?.name ?? 'item'}`}
                      style={{ width: 64 }}
                      onChange={(e) => setQty(l, id, clamp(Number(e.target.value), MAX_QTY))}
                    />
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => setQty(l, id, 0)}>Remove</button>
                  </div>
                );
              })}
            </div>
          </section>
        ),
      )}

      <section className="sec">
        <p className="note" data-bad={over}>
          Inventory after import: {quartersToSlots(usedQ + addQ)} / {capacity} slots
          {over ? ` (${quartersToSlots(usedQ + addQ - capacity * 4)} too many: move some to Storage)` : ''}
        </p>
        <ConfirmSubmit
          className="btn"
          disabled={over || nothing}
          dialogTitle="Submit import?"
          confirmLabel="Import"
          message="You can only import once. After this it closes, and only your DM can open it again. Everything listed will be added to your Inventory and Storage."
        >
          Import
        </ConfirmSubmit>
      </section>
    </form>
  );
}
