'use client';

import { useState } from 'react';
import { saveItem } from '@/lib/actions/dm';

export interface ItemFormData {
  id?: string;
  name: string;
  category: 'junk' | 'wondrous';
  slot: string;
  arcane: string;
  bio: string;
  ferrous: string;
  mech: string;
  description: string;
}

export function ItemForm({ initial }: { initial: ItemFormData }) {
  const [category, setCategory] = useState<'junk' | 'wondrous'>(initial.category);
  const wondrous = category === 'wondrous';

  return (
    <form action={saveItem} className="sec stack">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="category" value={category} />

      <div className="seg" role="group" aria-label="Item category">
        <button type="button" aria-pressed={!wondrous} onClick={() => setCategory('junk')}>Junk Item</button>
        <button type="button" aria-pressed={wondrous} onClick={() => setCategory('wondrous')}>Wondrous Item</button>
      </div>

      <div className="cols">
        <label className="field">
          <span>Item Name<span className="req">*</span></span>
          <input name="name" defaultValue={initial.name} required maxLength={80} autoComplete="off" />
        </label>
        {!wondrous && (
          <label className="field narrow-col">
            <span>Slot<span className="req">*</span></span>
            <input name="slot_weight" type="number" min={0} max={99} defaultValue={initial.slot} required />
          </label>
        )}
      </div>

      {!wondrous && (
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

      <label className="field">
        <span>Description (Optional)</span>
        <input name="description" defaultValue={initial.description} maxLength={500} autoComplete="off" />
      </label>

      <button className="btn" type="submit">Save Item</button>
    </form>
  );
}
