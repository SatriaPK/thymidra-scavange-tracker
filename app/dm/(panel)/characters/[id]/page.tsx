import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireDm } from '@/lib/session';
import { resetCharacterCode } from '@/lib/actions/dm';
import { setPaperImport } from '@/lib/actions/paper-import';
import { abilityMod, slotCapacity } from '@/lib/core';
import { isUuid, one, sign, type SearchParams } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { Header, SubHeader } from '@/components/Header';
import type { Character } from '@/lib/types';

export default async function CharacterViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const campaign = await requireDm();
  const { id } = await params;
  const sp = await searchParams;
  if (!isUuid(id)) notFound();

  const { data } = await db().from('character').select('*').eq('id', id).eq('campaign_id', campaign.id).maybeSingle();
  if (!data) notFound();
  const c = data as Character;

  const abilities: [string, number][] = [
    ['Strength', c.str],
    ['Dexterity', c.dex],
    ['Constitution', c.con],
    ['Intelligence', c.int_score],
    ['Wisdom', c.wis],
    ['Charisma', c.cha],
  ];
  const yes = (b: boolean) => (b ? 'TRUE' : 'FALSE');

  return (
    <>
      <Header title="Characters" />
      <SubHeader back="/dm/characters" title={c.name} right={c.access_code} rightClass="code" />
      <Flash error={one(sp.error)} ok={one(sp.ok)} />

      {!c.setup_done && (
        <p className="hint" style={{ margin: '12px 16px' }}>
          The player has not filled in this character yet, so the values below are placeholders.
        </p>
      )}

      <div className="rows">
        <div className="kv rule"><span className="k">Class</span><span className="v">{c.class || '-'}</span></div>
        <div className="kv"><span className="k">Character Level</span><span className="v">{c.level}</span></div>
        <div className="kv"><span className="k">Inventory Slot</span><span className="v">{slotCapacity({ strScore: c.str, slotBonus: c.slot_bonus, doubleBase: c.feature_double_slots })}</span></div>
      </div>

      <div className="abil">
        {abilities.map(([label, score]) => (
          <div key={label}>
            <b>{label}</b>
            {sign(abilityMod(score))} ({score})
          </div>
        ))}
      </div>

      <div className="rows">
        <div className="kv"><span className="k">Investigation Proficient?</span><span className="v">{yes(c.invest_proficient)}</span></div>
        <div className="kv"><span className="k">Investigation Expert?</span><span className="v">{yes(c.invest_expertise)}</span></div>
      </div>
      <div className="rows rule">
        <div className="kv"><span className="k">Bonus Investigation Modifier</span><span className="v">{sign(c.invest_bonus)}</span></div>
        <div className="kv"><span className="k">Bonus Inventory Slot</span><span className="v">{sign(c.slot_bonus)}</span></div>
        <div className="kv"><span className="k">Class Features</span><span className="v">{[c.feature_double_slots && 'Double base slots', c.feature_reroll_nat1 && 'Reroll Nat 1'].filter(Boolean).join(' · ') || 'None'}</span></div>
      </div>

      <div className="rows rule">
        <div className="kv">
          <span className="k">Paper import</span>
          <span className="v">{c.import_allowed ? 'Open (one use)' : 'Closed'}</span>
        </div>
      </div>
      <div className="sec">
        <form action={setPaperImport}>
          <input type="hidden" name="id" value={c.id} />
          <input type="hidden" name="allow" value={c.import_allowed ? '0' : '1'} />
          <button type="submit" className="btn btn-ghost">{c.import_allowed ? 'Close paper import' : 'Open paper import (one use)'}</button>
        </form>
      </div>

      <div className="sec rule actions">
        <Link href={`/dm/characters/${c.id}/edit`} className="btn">Edit</Link>
        <form action={resetCharacterCode} style={{ flex: 1 }}>
          <input type="hidden" name="id" value={c.id} />
          <button type="submit" className="btn btn-ghost">New Code</button>
        </form>
      </div>
    </>
  );
}
