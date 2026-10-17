'use client';

import { useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { rollMode, type OutcomeKind, type RollMode } from '@/lib/core';
import { Dice } from './Dice';

interface RollResult {
  d20Rolls: number[];
  d20: number;
  guidanceRoll: number;
  total: number;
  nat1: boolean;
  nat20: boolean;
  success: boolean;
  mode: RollMode;
  kind: OutcomeKind;
}

function verdict(result: RollResult): string {
  if (result.nat20) return 'Critical Success';
  if (result.nat1) return 'Critical Fail';
  if (!result.success) return 'Fail';
  if (result.kind === 'low_success') return 'Low Success';
  if (result.kind === 'high_success') return 'High Success';
  return 'Success'; // log lama sebelum ada Low/High Success
}

export function RollControls({ result }: { result?: RollResult | null }) {
  const { pending } = useFormStatus();
  const [advantage, setAdvantage] = useState(result?.mode === 'advantage');
  const [disadvantage, setDisadvantage] = useState(result?.mode === 'disadvantage');
  const [guidance, setGuidance] = useState((result?.guidanceRoll ?? 0) > 0);
  const mode = rollMode(advantage, disadvantage);
  const diceCount = mode === 'normal' ? 1 : 2;
  const [faces, setFaces] = useState(result?.d20Rolls ?? [20]);
  const [guidanceFace, setGuidanceFace] = useState<number | string>(result?.guidanceRoll || '?');
  const hasResult = !!result
    && !pending
    && result.mode === mode
    && (result.guidanceRoll > 0) === guidance;

  useEffect(() => {
    if (!pending) {
      setFaces(hasResult ? result.d20Rolls : (diceCount === 2 ? [20, 20] : [20]));
      setGuidanceFace(hasResult ? result.guidanceRoll : '?');
      return;
    }
    const timer = setInterval(() => {
      setFaces([1 + Math.floor(Math.random() * 20), 1 + Math.floor(Math.random() * 20)]);
      if (guidance) setGuidanceFace(1 + Math.floor(Math.random() * 4));
    }, 70);
    return () => clearInterval(timer);
  }, [diceCount, guidance, hasResult, pending, result]);

  const displayFaces = hasResult ? result.d20Rolls : faces;
  const displayGuidanceFace = hasResult ? result.guidanceRoll : guidanceFace;
  const isChosen = (index: number) => !!result
    && result.d20Rolls[index] === result.d20
    && result.d20Rolls.findIndex((roll) => roll === result.d20) === index;

  return (
    <>
      <div className="scavenge-dice">
        <div className="dice-row result-dice">
          {displayFaces.slice(0, hasResult ? result.d20Rolls.length : diceCount).map((face, index) => {
            const isSelected = hasResult && result.d20Rolls.length > 1 && isChosen(index);
            const className = pending
              ? 'tumble'
              : hasResult && result.d20Rolls.length > 1
                ? (isSelected ? (result.nat20 ? 'nat20' : result.nat1 ? 'nat1' : 'picked') : 'dim')
                : hasResult && result.nat20
                  ? 'nat20'
                  : hasResult && result.nat1
                    ? 'nat1'
                    : '';
            return <Dice key={index} value={face} className={className} />;
          })}
          {guidance && (
            <>
              <span className="guidance-die-plus" aria-hidden="true">+</span>
              <Dice value={displayGuidanceFace} sides={4} className={`d4 ${pending ? 'tumble' : hasResult ? 'land' : ''}`} />
            </>
          )}
        </div>
        {hasResult && (
          <div className={`result ${result.success ? (result.nat20 ? 'crit' : 'success') : 'fail'}`}>
            <div className="verdict">{verdict(result)}</div>
            <div className="total">{result.total}</div>
            {result.kind === 'rare' && <div className="subline">Rare Find</div>}
            {result.kind === 'jackpot' && <div className="subline">Jackpot</div>}
          </div>
        )}
      </div>
      <div className="chips">
        <input type="checkbox" name="advantage" checked={advantage} readOnly hidden />
        <button
          type="button"
          className="chip chip-toggle"
          aria-pressed={advantage}
          disabled={pending}
          onClick={() => setAdvantage((value) => !value)}
        >
          <span>Advantage</span>
        </button>
        <input type="checkbox" name="disadvantage" checked={disadvantage} readOnly hidden />
        <button
          type="button"
          className="chip chip-toggle"
          aria-pressed={disadvantage}
          disabled={pending}
          onClick={() => setDisadvantage((value) => !value)}
        >
          <span>Disadvantage</span>
        </button>
        <input type="checkbox" name="guidance" checked={guidance} readOnly hidden />
        <button
          type="button"
          className="chip chip-toggle"
          aria-pressed={guidance}
          disabled={pending}
          onClick={() => setGuidance((value) => !value)}
        >
          <span>Guidance</span>
        </button>
      </div>
    </>
  );
}

/** Tombol roll menampilkan status saat server memproses hasil. */
export function RollButton({ disabled, label }: { disabled: boolean; label: string }) {
  const { pending } = useFormStatus();

  return (
    <button className="btn" type="submit" disabled={disabled || pending}>
      {pending ? 'Rolling...' : label}
    </button>
  );
}
