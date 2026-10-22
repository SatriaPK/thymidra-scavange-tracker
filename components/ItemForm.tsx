'use client';

import { useState } from 'react';
import { saveItem } from '@/lib/actions/dm';
import type { ItemCategory } from '@/lib/item';

export interface ItemFormData {
  id?: string;
  name: string;
  category: ItemCategory;
  slot: string;
  arcane: string;
  bio: string;
  ferrous: string;
  mech: string;
  description: string;
}

export function ItemForm({ initial }: { initial: ItemFormData }) {
  const [category, setCategory] = useState<ItemCategory>(initial.category);
  const wondrous = category === 'wondrous';
  const junk = category === 'junk';

  return (
    <form action={saveItem} className="sec stack">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="category" value={category} />

      <div className="seg" role="group" aria-label="Item category">
        <button type="button" aria-pressed={junk} onClick={() => setCategory('junk')}>Junk Item</button>
        <button type="button" aria-pressed={wondrous} onClick={() => setCategory('wondrous')}>Wondrous Item</button>
        <button type="button" aria-pressed={category === 'crafted'} onClick={() => setCategory('crafted')}>Crafted Item</button>
      </div>

      <div className="cols">
        <label className="field">
          <span>Item Name<span className="req">*</span></span>
          <input name="name" defaultValue={initial.name} required maxLength={80} autoComplete="off" />
        </label>
        {!wondrous && (
          <label className="field narrow-col">
            <span>Slot<span className="req">*</span></span>
            <input name="slot_weight" type="number" min={category === 'crafted' ? 1 : 0} max={99} defaultValue={initial.slot} required />
          </label>
        )}
      </div>

      {junk && (
        <>
          <div className="grid4">
            <label>
              <span>Arcane<span className="req">*</span></span>
              <input name="yield_arcane" type="number" min={0} max={99} defaultValue={initial.arcane} required />
            </label>
            <label>
              <span>Bio<span className="req">*</span></span>
              <input name="yield_bio" type="number" min={0} max={99} defaultValue={initial.bio} required />
            </label>
            <label>
              <span>Ferrous<span className="req">*</span></span>
              <input name="yield_ferrous" type="number" min={0} max={99} defaultValue={initial.ferrous} required />
            </label>
            <label>
              <span>Mech<span className="req">*</span></span>
              <input name="yield_mech" type="number" min={0} max={99} defaultValue={initial.mech} required />
            </label>
          </div>
          <small className="hint">At least one yield must be above 0. 1 scrap unit = 0.25 slot.</small>
        </>
      )}
      {wondrous && (
        <small className="hint">Wondrous items have no slot weight and no yield.</small>
      )}
      {category === 'crafted' && (
        <small className="hint">
          Crafted items take slots but have no yield and cannot be broken down. Make them with a recipe, and optionally add them to a zone&apos;s Junk or Rare pool.
        </small>
      )}

      <label className="field">
        <span>Description (Optional)</span>
        <input name="description" defaultValue={initial.description} maxLength={500} autoComplete="off" />
      </label>

      <button className="btn" type="submit">Save Item</button>
    </form>
  );
}
