'use client';

import { useState } from 'react';
import { createTrade } from '@/lib/actions/barter';

export interface TradeItemOption {
  id: string;
  name: string;
  qty: number;
  slots: string; // teks slot per item, mis. "2" atau "Wondrous"
}

export type TradeScrapOption = Record<'bio' | 'arcane' | 'mech' | 'ferrous', number>;

interface Props {
  toId: string;
  toName: string;
  mine: { items: TradeItemOption[]; scrap: TradeScrapOption; freeSlots: string };
  theirs: { items: TradeItemOption[]; scrap: TradeScrapOption; freeSlots: string };
}

const SCRAP_ROWS: [keyof TradeScrapOption, string][] = [
  ['bio', 'Bio'],
  ['arcane', 'Arcane'],
  ['mech', 'Mech'],
  ['ferrous', 'Ferrous'],
];

function Picker({ prefix, items, scrap, empty }: { prefix: 'o_' | 'r_'; items: TradeItemOption[]; scrap: TradeScrapOption; empty: string }) {
  const hasScrap = SCRAP_ROWS.some(([k]) => scrap[k] > 0);
  if (items.length === 0 && !hasScrap) return <p className="hint">{empty}</p>;
  return (
    <div className="trade-list">
      {items.map((i) => (
        <label key={i.id} className="trade-row">
          <span className="trade-name">
            {i.name} <span className="tag">[ {i.slots} ]</span>
            <span className="subline">have {i.qty}</span>
          </span>
          <input type="number" name={`${prefix}item_${i.id}`} min={0} max={i.qty} defaultValue={0} inputMode="numeric" aria-label={`${i.name} amount`} />
        </label>
      ))}
      {SCRAP_ROWS.filter(([k]) => scrap[k] > 0).map(([k, label]) => (
        <label key={k} className="trade-row">
          <span className="trade-name">
            {label} scrap
            <span className="subline">have {scrap[k]}</span>
          </span>
          <input type="number" name={`${prefix}scrap_${k}`} min={0} max={scrap[k]} defaultValue={0} inputMode="numeric" aria-label={`${label} scrap amount`} />
        </label>
      ))}
    </div>
  );
}

/** Form tawaran: Kasih (sepihak) atau Tukar (tawarkan X, minta Y). Hanya isi Inventory yang bisa dibarter. */
export function TradeForm({ toId, toName, mine, theirs }: Props) {
  const [mode, setMode] = useState<'give' | 'swap'>('give');

  return (
    <form action={createTrade} className="stack">
      <input type="hidden" name="to" value={toId} />
      <input type="hidden" name="mode" value={mode} />

      <div className="chips" role="group" aria-label="Trade mode">
        <button type="button" className="chip chip-toggle" aria-pressed={mode === 'give'} onClick={() => setMode('give')}>
          <span>Give</span>
        </button>
        <button type="button" className="chip chip-toggle" aria-pressed={mode === 'swap'} onClick={() => setMode('swap')}>
          <span>Swap</span>
        </button>
      </div>
      <p className="hint">
        {mode === 'give'
          ? `${toName} receives your items and gives nothing back.`
          : `You give your items and get the items you pick from ${toName}.`}{' '}
        Only items in an Inventory can be traded. The trade happens only if {toName} accepts.
      </p>

      <section className="sec">
        <div className="sec-head"><h2>You offer</h2><span className="count">{mine.freeSlots} slots free</span></div>
        <Picker prefix="o_" items={mine.items} scrap={mine.scrap} empty="Your Inventory is empty." />
      </section>

      {mode === 'swap' && (
        <section className="sec">
          <div className="sec-head"><h2>You ask {toName} for</h2><span className="count">{theirs.freeSlots} slots free</span></div>
          <Picker prefix="r_" items={theirs.items} scrap={theirs.scrap} empty={`${toName}'s Inventory is empty.`} />
        </section>
      )}

      <button type="submit" className="btn">Send offer</button>
    </form>
  );
}
