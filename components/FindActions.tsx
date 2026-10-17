'use client';

import { useState } from 'react';
import { decideFind } from '@/lib/actions/scavenge';
import { SCRAP_QUARTERS, SCRAP_TYPES, quartersToSlots, scrapTotal, suggestKeepScrap, type Scrap, type ScrapType } from '@/lib/core';
import { ConfirmSubmit } from './ConfirmSubmit';
import { ModalShell } from './ConfirmDialog';

type Mode = 'keep' | 'breakdown';

interface Props {
  findId: string;
  name: string;
  /** Loose scrap (bukan barang). */
  isScrap: boolean;
  /** Ruang (kuartal) yang dibutuhkan untuk Keep. */
  keepQ: number;
  canBreakdown: boolean;
  /** Ruang (kuartal) yang dibutuhkan untuk Breakdown. */
  breakQ: number;
  /** Sisa ruang inventori (kuartal). */
  freeQ: number;
  /** Isi loose scrap (bila isScrap). */
  scrap: Scrap | null;
  /** Scrap hasil Breakdown (bila canBreakdown). */
  yieldScrap: Scrap | null;
}

const cap = (t: string) => `${t[0].toUpperCase()}${t.slice(1)}`;

/** Tombol keputusan atas satu temuan. Bila tidak muat di inventori, membuka modal pilihan. */
export function FindActions({ findId, name, isScrap, keepQ, canBreakdown, breakQ, freeQ, scrap, yieldScrap }: Props) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [keep, setKeep] = useState<Scrap | null>(null);

  const keepFits = keepQ <= freeQ;
  const breakFits = breakQ <= freeQ;
  const act = (choice: string) => decideFind.bind(null, findId, choice);

  const open = (m: Mode) => {
    const source = m === 'breakdown' ? yieldScrap : scrap;
    setKeep(source ? suggestKeepScrap(source, freeQ) : null);
    setMode(m);
  };

  const source = mode === 'breakdown' ? yieldScrap : mode === 'keep' && isScrap ? scrap : null;
  const needQ = mode === 'breakdown' ? breakQ : keepQ;
  const freeUnits = Math.floor(freeQ / SCRAP_QUARTERS);
  const keptUnits = keep ? scrapTotal(keep) : 0;
  const tooMany = keptUnits > freeUnits;
  const canPartial = !!source && !!keep && freeUnits > 0;
  const types = source ? SCRAP_TYPES.filter((t) => source[t] > 0) : [];

  return (
    <>
      {(!keepFits || (canBreakdown && !breakFits)) && (
        <div className="warn">Inventory full. You can choose what to do when you pick an action.</div>
      )}
      <form className="btns">
        {keepFits ? (
          <button type="submit" formAction={act('keep:inventory')} className="btn btn-sm">Keep</button>
        ) : (
          <button type="button" className="btn btn-sm" onClick={() => open('keep')}>Keep</button>
        )}
        {canBreakdown &&
          (breakFits ? (
            <button type="submit" formAction={act('breakdown:inventory')} className="btn btn-sm">Breakdown</button>
          ) : (
            <button type="button" className="btn btn-sm" onClick={() => open('breakdown')}>Breakdown</button>
          ))}
        <ConfirmSubmit
          formAction={act('discard')}
          className="btn btn-sm btn-red"
          dialogTitle="Discard find?"
          confirmLabel="Discard"
          message={`Discard ${name}? This cannot be undone.`}
        >
          Discard
        </ConfirmSubmit>
      </form>

      <ModalShell open={mode !== null} title="Inventory full" onClose={() => setMode(null)}>
        {mode && (
          <form>
            <div className="opts">
              <p className="note" style={{ color: 'var(--ink)' }}>
                {mode === 'breakdown' ? `Breaking down ${name} gives scrap that needs` : `${name} needs`}{' '}
                {quartersToSlots(needQ)} slot{quartersToSlots(needQ) === 1 ? '' : 's'}, but only {quartersToSlots(freeQ)} free in your Inventory.
              </p>
              <button type="submit" formAction={act(`${mode}:storage`)} className="btn">
                {mode === 'breakdown' ? 'Breakdown to Storage' : 'Keep in Storage'}
              </button>
            </div>

            {canPartial && source && keep && (
              <div className="opts">
                <p className="note">Or keep only part of the scrap in Inventory and discard the rest.</p>
                <div className="keep-grid">
                  {types.map((t: ScrapType) => (
                    <label key={t}>
                      <span>{cap(t)} (of {source[t]})</span>
                      <input
                        type="number"
                        name={`keep_${t}`}
                        min={0}
                        max={source[t]}
                        value={keep[t]}
                        inputMode="numeric"
                        onChange={(e) => {
                          const n = Math.min(source[t], Math.max(0, Math.floor(Number(e.target.value) || 0)));
                          setKeep({ ...keep, [t]: n });
                        }}
                      />
                    </label>
                  ))}
                </div>
                <p className="note" data-bad={tooMany}>
                  Keeping {keptUnits} of {scrapTotal(source)} · room for {freeUnits}
                  {tooMany ? ` (drop ${keptUnits - freeUnits} more)` : ''}
                </p>
                <button
                  type="submit"
                  formAction={act(`${mode}-partial:inventory`)}
                  className="btn"
                  disabled={tooMany || keptUnits === 0}
                >
                  Keep selected, discard the rest
                </button>
              </div>
            )}

            <div className="opts">
              <button type="submit" formAction={act('discard')} className="btn btn-red">Discard {name}</button>
            </div>
          </form>
        )}
      </ModalShell>
    </>
  );
}
