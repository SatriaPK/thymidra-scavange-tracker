import { itemAction, scrapAction } from '@/lib/actions/inventory';
import { canBreakdown, itemQuarters, quartersToSlots, scrapTotal } from '@/lib/core';
import { yieldText } from '@/lib/format';
import { formatItemId } from '@/lib/ids';
import type { Inventory, Location } from '@/lib/inventory';
import Link from 'next/link';
import { ConfirmSubmit } from './ConfirmSubmit';

const SCRAP: [keyof Inventory['inventory']['scrap'], string][] = [
  ['bio', 'Bio'],
  ['arcane', 'Arcane'],
  ['mech', 'Mech'],
  ['ferrous', 'Ferrous'],
];

const slots = (q: number) => String(quartersToSlots(q));

/** Isi satu tas (Inventory atau Storage): item, scrap, dan aksinya. */
export function InventoryView({ inv, loc, selected }: { inv: Inventory; loc: Location; selected?: string }) {
  const bag = inv[loc];
  const other = loc === 'inventory' ? 'Storage' : 'Inventory';
  const scrapQ = scrapTotal(bag.scrap);
  const over = inv.usedQ > inv.capacity * 4;
  const pick = SCRAP.find(([k]) => k === selected && bag.scrap[k] > 0) ?? null;
  const junk = bag.items.filter((h) => !h.item.is_wondrous);
  const wondrous = bag.items.filter((h) => h.item.is_wondrous);

  const renderRows = (list: typeof bag.items) =>
            list.map((h) => {
              const q = itemQuarters(h.def);
              return (
                <details key={h.holdingId} className="hold">
                  <summary>
                    <div className="top">
                      <span className="title">{h.item.name}</span>
                      <span className="tag">[ {h.item.is_wondrous ? 'Wondrous' : slots(q)} ]</span>
                      <span className="qty">x{h.quantity}</span>
                    </div>
                    <div className="subline">
                      ID {formatItemId(h.item.item_no)}{canBreakdown(h.def) ? ` · ${yieldText(h.item)}` : ''}
                    </div>
                  </summary>
                  <form className="acts">
                    {h.item.description && <p className="hint" style={{ margin: '0 0 10px' }}>{h.item.description}</p>}
                    <input type="hidden" name="item_id" value={h.item.id} />
                    <input type="hidden" name="from" value={loc} />
                    <label className="qty-field">
                      <span>Amount</span>
                      <input type="number" name="qty" min={1} max={h.quantity} defaultValue={1} inputMode="numeric" />
                    </label>
                    <div className="btns">
                      <button type="submit" formAction={itemAction.bind(null, 'move')} className="btn btn-sm">To {other}</button>
                      {canBreakdown(h.def) && (
                        <button type="submit" formAction={itemAction.bind(null, 'breakdown')} className="btn btn-sm">Breakdown</button>
                      )}
                      <ConfirmSubmit
                        formAction={itemAction.bind(null, 'discard')}
                        className="btn btn-sm btn-red"
                        message={`Discard ${h.item.name}? This cannot be undone.`}
                      >
                        Discard
                      </ConfirmSubmit>
                    </div>
                  </form>
                </details>
              );
            });

  return (
    <>
      {loc === 'inventory' ? (
        <section className="sec">
          <div className="sec-head">
            <h2>Slots</h2>
            <span className="count">{slots(inv.usedQ)} / {inv.capacity}</span>
          </div>
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={inv.capacity} aria-valuenow={quartersToSlots(inv.usedQ)}>
            <div style={{ width: `${Math.min(100, (inv.usedQ / (inv.capacity * 4)) * 100)}%` }} data-over={over} />
          </div>
          {over && <p className="hint" style={{ marginTop: 8 }}>Over capacity. Move or discard something to make room.</p>}
        </section>
      ) : (
        <section className="sec">
          <p className="muted" style={{ margin: 0 }}>Storage has no slot limit. Items here do not count toward your inventory.</p>
        </section>
      )}

      <section className="sec">
        <div className="sec-head"><h2>Scrap <span className="count">({scrapQ} units)</span></h2></div>
        <div className="scrap-grid">
          {SCRAP.map(([k, label]) => {
            const n = bag.scrap[k];
            const inner = (
              <>
                <span className="k">{label}</span>
                <span className="v">{n}</span>
              </>
            );
            return n > 0 ? (
              <Link key={k} href={`?scrap=${k}`} scroll={false} className="scrap-box" aria-current={pick?.[0] === k ? 'true' : undefined}>{inner}</Link>
            ) : (
              <div key={k} className="scrap-box empty">{inner}</div>
            );
          })}
        </div>
        {pick ? (
          <form className="acts scrap-acts">
            <p className="hint" style={{ margin: '0 0 10px' }}>{pick[1]} scrap · {slots(bag.scrap[pick[0]])} slot in total</p>
            <input type="hidden" name="type" value={pick[0]} />
            <input type="hidden" name="from" value={loc} />
            <label className="qty-field">
              <span>Amount</span>
              <input type="number" name="qty" min={1} max={bag.scrap[pick[0]]} defaultValue={1} inputMode="numeric" />
            </label>
            <div className="btns">
              <button type="submit" formAction={scrapAction.bind(null, 'move')} className="btn btn-sm">To {other}</button>
              <ConfirmSubmit
                formAction={scrapAction.bind(null, 'discard')}
                className="btn btn-sm btn-red"
                message={`Discard ${pick[1]} scrap? This cannot be undone.`}
              >
                Discard
              </ConfirmSubmit>
            </div>
          </form>
        ) : (
          <p className="hint" style={{ marginTop: 10 }}>1 scrap unit takes 0.25 slot. Tap a scrap type to move or discard it.</p>
        )}
      </section>

      <section className="sec">
        <div className="sec-head"><h2>Items <span className="count">({junk.length})</span></h2></div>
        {junk.length === 0 ? <p className="empty">No items.</p> : <div className="list">{renderRows(junk)}</div>}
      </section>

      <section className="sec">
        <div className="sec-head"><h2>Wondrous <span className="count">({wondrous.length})</span></h2></div>
        {wondrous.length === 0 ? <p className="empty">No wondrous items.</p> : <div className="list wondrous">{renderRows(wondrous)}</div>}
      </section>
    </>
  );
}