'use client';

import { useMemo, useState } from 'react';
import { saveRecipe } from '@/lib/actions/recipes';
import { emptyScrap, type ItemDef, type Scrap } from '@/lib/core';
import { breakdownLoopWarning, MAX_INGREDIENT_QTY, MAX_OUTPUT_QTY } from '@/lib/crafting';
import { formatItemId } from '@/lib/ids';
import { CATEGORY_LABEL, type ItemCategory } from '@/lib/item';

export interface RecipePickerItem {
  id: string;
  no: number;
  name: string;
  category: ItemCategory;
  slot: number; // 0 = tanpa slot
  yield: Scrap;
}

export interface RecipeFormInitial {
  id?: string;
  name: string;
  description: string;
  level: string;
  enabled: boolean;
  outputItemId: string;
  outputQty: string;
  scrap: { arcane: string; bio: string; ferrous: string; mech: string };
  items: { item_id: string; qty: string }[];
}

const SCRAP_FIELDS = [
  ['arcane', 'Arcane'],
  ['bio', 'Bio'],
  ['ferrous', 'Ferrous'],
  ['mech', 'Mech'],
] as const;

const num = (v: string): number => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function RecipeForm({ items, initial }: { items: RecipePickerItem[]; initial: RecipeFormInitial }) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [level, setLevel] = useState(initial.level);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [outputId, setOutputId] = useState(initial.outputItemId || items[0]?.id || '');
  const [outputQty, setOutputQty] = useState(initial.outputQty);
  const [scrap, setScrap] = useState(initial.scrap);
  const [lines, setLines] = useState(initial.items);

  const label = (i: RecipePickerItem) => `${formatItemId(i.no)} · ${i.name} (${CATEGORY_LABEL[i.category]})`;
  const used = new Set(lines.map((l) => l.item_id));

  const payload = JSON.stringify({
    id: initial.id,
    name,
    description,
    level,
    enabled,
    output_item_id: outputId,
    output_qty: outputQty,
    scrap,
    items: lines.filter((l) => l.item_id).map((l) => ({ item_id: l.item_id, qty: l.qty })),
  });

  // Peringatan loop breakdown: hasil Junk bisa di-breakdown jadi scrap lebih banyak dari bahannya.
  const warning = useMemo(() => {
    const defs = new Map<string, ItemDef>(
      items.map((i) => [i.id, { id: i.id, name: i.name, slotWeight: i.slot, yield: i.yield, crafted: i.category === 'crafted' }]),
    );
    const s = emptyScrap();
    for (const [k] of SCRAP_FIELDS) s[k] = num(scrap[k]);
    return breakdownLoopWarning(
      {
        ingredients: { items: lines.filter((l) => l.item_id).map((l) => ({ itemId: l.item_id, qty: Math.max(1, num(l.qty)) })), scrap: s },
        outputItemId: outputId,
        outputQty: Math.max(1, num(outputQty)),
      },
      defs,
    );
  }, [items, lines, scrap, outputId, outputQty]);

  if (items.length === 0) {
    return <p className="empty">Create some items first. A recipe needs an item as its result.</p>;
  }

  return (
    <form action={saveRecipe} className="sec stack">
      <input type="hidden" name="payload" value={payload} />

      <div className="cols">
        <label className="field">
          <span>Recipe Name<span className="req">*</span></span>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="off" />
        </label>
        <label className="field narrow-col">
          <span>Level<span className="req">*</span></span>
          <input type="number" min={1} max={20} value={level} onChange={(e) => setLevel(e.target.value)} required />
        </label>
      </div>
      <small className="hint">
        Players see this recipe only once their character reaches this level. Below it, the recipe is hidden completely.
      </small>

      <div className="cols">
        <label className="field">
          <span>Result Item<span className="req">*</span></span>
          <select value={outputId} onChange={(e) => setOutputId(e.target.value)} required>
            {items.map((i) => <option key={i.id} value={i.id}>{label(i)}</option>)}
          </select>
        </label>
        <label className="field narrow-col">
          <span>Amount<span className="req">*</span></span>
          <input type="number" min={1} max={MAX_OUTPUT_QTY} value={outputQty} onChange={(e) => setOutputQty(e.target.value)} required />
        </label>
      </div>

      <div>
        <div className="sec-head"><h2>Ingredients</h2></div>
        <p className="hint" style={{ marginTop: 0 }}>Scrap and items can be combined. Ingredients come from the player&apos;s Inventory.</p>

        <div className="grid4">
          {SCRAP_FIELDS.map(([k, text]) => (
            <label key={k}>
              <span>{text} scrap</span>
              <input
                type="number"
                min={0}
                max={999}
                value={scrap[k]}
                onChange={(e) => setScrap((s) => ({ ...s, [k]: e.target.value }))}
              />
            </label>
          ))}
        </div>

        <div className="stack" style={{ marginTop: 12 }}>
          {lines.map((l, idx) => (
            <div key={idx} className="trade-row" style={{ border: '1px solid var(--ink)' }}>
              <select
                aria-label="Ingredient item"
                value={l.item_id}
                onChange={(e) => setLines((all) => all.map((x, i) => (i === idx ? { ...x, item_id: e.target.value } : x)))}
                required
              >
                <option value="">Choose item…</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id} disabled={used.has(i.id) && i.id !== l.item_id}>{label(i)}</option>
                ))}
              </select>
              <input
                type="number"
                aria-label="Ingredient amount"
                min={1}
                max={MAX_INGREDIENT_QTY}
                value={l.qty}
                onChange={(e) => setLines((all) => all.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x)))}
                required
              />
              <button type="button" className="icon-plain" aria-label="Remove ingredient" onClick={() => setLines((all) => all.filter((_, i) => i !== idx))}>
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={lines.length >= 50 || lines.length >= items.length}
            onClick={() => setLines((all) => [...all, { item_id: '', qty: '1' }])}
          >
            + Add ingredient item
          </button>
        </div>
      </div>

      {warning && <p className="hint" role="alert" style={{ color: 'var(--red)' }}>{warning}</p>}

      <label className="field">
        <span>Description (Optional)</span>
        <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} autoComplete="off" />
      </label>

      <label className="qty-field">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span>Enabled (visible to players who reach the level)</span>
      </label>

      <button className="btn" type="submit">Save Recipe</button>
    </form>
  );
}
