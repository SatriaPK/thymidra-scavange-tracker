'use client';

import { useState } from 'react';
import { abilityMod, investigationModifier, proficiencyBonus, slotCapacity } from '@/lib/core';
import { sign } from '@/lib/format';

export interface CharacterFormValues {
  name: string;
  class: string;
  level: string;
  str: string;
  dex: string;
  con: string;
  int_score: string;
  wis: string;
  cha: string;
  invest_proficient: boolean;
  invest_expertise: boolean;
  invest_bonus: string;
  slot_bonus: string;
}

const ABILITIES = [
  ['str', 'Strength'],
  ['dex', 'Dexterity'],
  ['con', 'Constitution'],
  ['int_score', 'Intelligence'],
  ['wis', 'Wisdom'],
  ['cha', 'Charisma'],
] as const;

const toInt = (s: string) => {
  const n = Math.trunc(Number(s));
  return Number.isFinite(n) ? n : 0;
};

/** Form karakter untuk DM (nama bisa diubah) dan pemain (nama terkunci). */
export function CharacterForm({
  action,
  id,
  initial,
  nameEditable,
  submitLabel,
  code,
}: {
  action: (formData: FormData) => Promise<void>;
  id?: string;
  initial: CharacterFormValues;
  nameEditable: boolean;
  submitLabel: string;
  /** Kode akses yang sudah dibuat (karakter baru). Dikirim bersama form. */
  code?: string;
}) {
  const [v, setV] = useState<CharacterFormValues>(initial);
  const text = (k: keyof CharacterFormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((p) => ({ ...p, [k]: e.target.value }));
  const flag = (k: 'invest_proficient' | 'invest_expertise') => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((p) => ({ ...p, [k]: e.target.checked }));

  const level = Math.min(20, Math.max(1, toInt(v.level) || 1));
  const proficient = v.invest_proficient;
  const expertise = proficient && v.invest_expertise;
  const invest = investigationModifier({
    level,
    intScore: toInt(v.int_score) || 10,
    proficient,
    expertise,
    bonus: toInt(v.invest_bonus),
  });
  const slots = slotCapacity({ strScore: toInt(v.str) || 10, slotBonus: toInt(v.slot_bonus) });

  return (
    <form action={action}>
      {id && <input type="hidden" name="id" value={id} />}
      {code && <input type="hidden" name="access_code" value={code} />}

      <div className="sec stack">
        <label className="field">
          <span>Character Name<span className="req">*</span></span>
          <input
            name="name"
            value={v.name}
            onChange={text('name')}
            required
            maxLength={40}
            readOnly={!nameEditable}
            autoComplete="off"
          />
        </label>
        <div className="cols">
          <label className="field">
            <span>Class<span className="req">*</span></span>
            <input name="class" value={v.class} onChange={text('class')} required maxLength={40} autoComplete="off" />
          </label>
          <label className="field narrow-col">
            <span>Level<span className="req">*</span></span>
            <input name="level" type="number" min={1} max={20} value={v.level} onChange={text('level')} required />
          </label>
        </div>
      </div>

      <div className="sec stack">
        <div className="grid3">
          {ABILITIES.map(([key, label]) => (
            <label key={key}>
              <span>{label}<span className="req">*</span></span>
              <input name={key} type="number" min={1} max={30} value={v[key]} onChange={text(key)} required />
            </label>
          ))}
        </div>
        <div className="checks">
          <label className="check">
            <span>Investigation Proficient?</span>
            <input name="invest_proficient" type="checkbox" checked={v.invest_proficient} onChange={flag('invest_proficient')} />
          </label>
          <span className="vbar" aria-hidden="true" />
          <label className="check">
            <span>Investigation Expertise?</span>
            <input
              name="invest_expertise"
              type="checkbox"
              checked={expertise}
              disabled={!v.invest_proficient}
              onChange={flag('invest_expertise')}
            />
          </label>
        </div>
      </div>

      <div className="sec stack">
        <label className="field">
          <span>Bonus Investigation Modifier <small>(Jack of All Trades, Item, etc.)</small></span>
          <input name="invest_bonus" type="number" min={-10} max={30} value={v.invest_bonus} onChange={text('invest_bonus')} />
        </label>
        <label className="field">
          <span>Bonus Inventory Slot <small>(Magical Item, Powerful Build, etc.)</small></span>
          <input name="slot_bonus" type="number" min={-20} max={100} value={v.slot_bonus} onChange={text('slot_bonus')} />
        </label>

        <div className="preview">
          <div className="kv"><span className="k">Proficiency Bonus</span><span className="v">{sign(proficiencyBonus(level))}</span></div>
          <div className="kv divide"><span className="k">Investigation Modifier</span><span className="v">{sign(invest)}</span></div>
          <div className="kv divide"><span className="k">Inventory Slot</span><span className="v">{slots}</span></div>
          <div className="kv divide"><span className="k">INT / STR modifier</span><span className="v">{sign(abilityMod(toInt(v.int_score) || 10))} / {sign(abilityMod(toInt(v.str) || 10))}</span></div>
        </div>
      </div>

      <div className="sec">
        <button className="btn" type="submit">{submitLabel}</button>
      </div>
    </form>
  );
}
