'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { saveZone } from '@/lib/actions/dm';
import { dropChances } from '@/lib/core';
import { formatItemId } from '@/lib/ids';
import { ChevronLeftIcon, SearchIcon } from './Icons';
import { PoolTable, type PoolRow } from './PoolTable';

export interface PickerItem {
  id: string;
  no: number;
  name: string;
  slot: number; // 0 = tanpa slot
  wondrous: boolean;
  yieldText: string;
}

export interface ZoneEditorInitial {
  id?: string;
  idLabel: string;
  name: string;
  dc: string;
  junk: { item_id: string; weight: number }[];
  rare: { item_id: string; weight: number }[];
}

type View = 'form' | 'junk' | 'rare';
type Pool = Record<string, number>;

const DEFAULT_WEIGHT = 10;
/** Junk pool hanya berisi item Junk, Rare pool hanya berisi Wondrous. */
const toPool = (list: { item_id: string; weight: number }[], items: PickerItem[], rare: boolean): Pool => {
  const ok = new Set(items.filter((i) => i.wondrous === rare).map((i) => i.id));
  return Object.fromEntries(list.filter((e) => ok.has(e.item_id)).map((e) => [e.item_id, e.weight]));
};

export function ZoneEditor({ items, initial }: { items: PickerItem[]; initial: ZoneEditorInitial }) {
  const [view, setView] = useState<View>('form');
  const [name, setName] = useState(initial.name);
  const [dc, setDc] = useState(initial.dc);
  const [junk, setJunk] = useState<Pool>(() => toPool(initial.junk, items, false));
  const [rare, setRare] = useState<Pool>(() => toPool(initial.rare, items, true));
  const [query, setQuery] = useState('');

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const rowsOf = (pool: Pool): PoolRow[] => {
    const entries = Object.entries(pool)
      .filter(([id]) => byId.has(id))
      .map(([id, weight]) => ({ id, weight, item: byId.get(id)! }))
      .sort((a, b) => a.item.no - b.item.no);
    const chances = new Map(dropChances(entries.map((e) => ({ itemId: e.id, weight: e.weight }))).map((c) => [c.itemId, c.percent]));
    return entries.map((e) => ({
      id: e.id,
      no: formatItemId(e.item.no),
      name: e.item.name,
      slot: e.item.slot > 0 ? String(e.item.slot) : '-',
      weight: e.weight,
      chance: chances.get(e.id) ?? 0,
    }));
  };

  const payload = JSON.stringify({
    id: initial.id,
    name,
    dc,
    junk: Object.entries(junk).filter(([id]) => byId.has(id)).map(([item_id, weight]) => ({ item_id, weight })),
    rare: Object.entries(rare).filter(([id]) => byId.has(id)).map(([item_id, weight]) => ({ item_id, weight })),
  });

  // ---------------- Picker ("Manage item") ----------------
  if (view !== 'form') {
    const isRare = view === 'rare';
    const pool = isRare ? rare : junk;
    const setPool = isRare ? setRare : setJunk;
    const q = query.trim().toLowerCase();
    // Junk pool otomatis tanpa Wondrous; Rare pool otomatis hanya Wondrous.
    const eligible = items.filter((i) => i.wondrous === isRare);
    const list = q
      ? eligible.filter((i) => `${i.name} ${formatItemId(i.no)}`.toLowerCase().includes(q))
      : eligible;
    const count = Object.keys(pool).filter((id) => byId.has(id)).length;

    const toggle = (id: string) =>
      setPool((prev) => {
        const next = { ...prev };
        if (id in next) delete next[id];
        else next[id] = DEFAULT_WEIGHT;
        return next;
      });

    // Select All / Deselect All berlaku untuk item yang sedang tampil (hasil pencarian ikut dihitung).
    const allSelected = list.length > 0 && list.every((i) => i.id in pool);
    const toggleAll = () =>
      setPool((prev) => {
        const next = { ...prev };
        for (const i of list) {
          if (allSelected) delete next[i.id];
          else if (!(i.id in next)) next[i.id] = DEFAULT_WEIGHT; // bobot item yang sudah dipilih tidak diubah
        }
        return next;
      });

    return (
      <>
        <div className="sub rule">
          <button type="button" className="back" onClick={() => { setView('form'); setQuery(''); }}>
            <ChevronLeftIcon />
            <span>{isRare ? 'Rare Item' : 'Junk Item'}</span>
          </button>
          <span className="right">{count} Selected</span>
        </div>
        <div className="sec">
          <label className="search">
            <SearchIcon />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search item..." aria-label="Search item" />
          </label>
          {list.length > 0 && (
            <div className="actions-row" style={{ justifyContent: 'flex-start', margin: '8px 0' }}>
              <button type="button" className="btn btn-sm btn-ghost" onClick={toggleAll}>
                {allSelected ? 'Deselect All' : 'Select All'}{q ? ' (shown)' : ''}
              </button>
            </div>
          )}
          {list.length === 0 ? (
            <p className="empty">{eligible.length === 0 ? `No ${isRare ? 'Wondrous' : 'Junk'} items yet. Create some first.` : 'No match.'}</p>
          ) : (
            <div className="list">
              {list.map((i) => (
                <button key={i.id} type="button" className="pick" aria-pressed={i.id in pool} onClick={() => toggle(i.id)}>
                  <div>
                    <span className="title">{i.name}</span>
                    <span className="tag">[ {i.wondrous ? 'Wondrous' : i.slot} ]</span>
                  </div>
                  <div className="subline">{i.wondrous ? `ID ${formatItemId(i.no)} · Wondrous` : `ID ${formatItemId(i.no)} · ${i.yieldText}`}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </>
    );
  }

  // ---------------- Form zona ----------------
  const junkRows = rowsOf(junk);
  const rareRows = rowsOf(rare);

  return (
    <form action={saveZone}>
      <input type="hidden" name="payload" value={payload} />

      <div className="sub rule">
        <Link href="/dm/zones" className="back" aria-label="Back">
          <ChevronLeftIcon />
          <span>{initial.id ? 'Edit Zone' : 'New Zone'}</span>
        </Link>
        <span className="right">{initial.idLabel}</span>
      </div>

      <div className="sec cols">
        <label className="field">
          <span>Zone Name<span className="req">*</span></span>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} autoComplete="off" />
        </label>
        <label className="field narrow-col">
          <span>DC<span className="req">*</span></span>
          <input type="number" min={1} max={40} value={dc} onChange={(e) => setDc(e.target.value)} required />
        </label>
      </div>

      <section className="sec">
        <div className="sec-head">
          <h2>Junk Item <span className="count">({junkRows.length} Item)</span></h2>
          <button type="button" className="link-green" onClick={() => setView('junk')}>Manage item</button>
        </div>
        <PoolTable
          rows={junkRows}
          emptyText="No items. Until this has items, a successful scavenge finds nothing."
          onWeightChange={(id, w) => setJunk((p) => ({ ...p, [id]: w }))}
        />
      </section>

      <section className="sec">
        <div className="sec-head">
          <h2>Rare Item <span className="count">({rareRows.length} Item)</span></h2>
          <button type="button" className="link-green" onClick={() => setView('rare')}>Manage item</button>
        </div>
        <PoolTable
          rows={rareRows}
          emptyText="No items. Until this has items, a Nat 20 is always a Jackpot."
          onWeightChange={(id, w) => setRare((p) => ({ ...p, [id]: w }))}
        />
      </section>

      <div className="sec">
        <button className="btn" type="submit">Save Zone</button>
      </div>
    </form>
  );
}
