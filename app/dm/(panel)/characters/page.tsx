import Link from 'next/link';
import { db } from '@/lib/db';
import { requireDm } from '@/lib/session';
import { deleteCharacters } from '@/lib/actions/dm';
import { investigationModifier, MAX_SCAVENGES_PER_DAY, remainingScavenges, wibDay } from '@/lib/core';
import { formatCharId } from '@/lib/ids';
import { one, sign, type SearchParams } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { Header } from '@/components/Header';
import { PlusIcon } from '@/components/Icons';
import { SelectableList, type ListRow } from '@/components/SelectableList';
import type { Character } from '@/lib/types';

export default async function CharactersPage({ searchParams }: { searchParams: SearchParams }) {
  const campaign = await requireDm();
  const sp = await searchParams;

  const { data } = await db().from('character').select('*').eq('campaign_id', campaign.id).order('char_no');
  const characters = (data ?? []) as Character[];

  const used = new Map<string, number>();
  if (characters.length) {
    const { data: days } = await db()
      .from('scavenge_day')
      .select('character_id, used')
      .eq('day', wibDay(new Date()))
      .in('character_id', characters.map((c) => c.id));
    for (const d of days ?? []) used.set(d.character_id as string, d.used as number);
  }

  const rows: ListRow[] = characters.map((c) => {
    const left = `${remainingScavenges(used.get(c.id) ?? 0)}/${MAX_SCAVENGES_PER_DAY}`;
    return {
      id: c.id,
      title: c.name,
      tag: left,
      sub: (c.setup_done ? `${c.class || '-'} Lv. ${c.level}` : 'Waiting for the player to fill in the character') + (c.pending_exhaustion > 0 ? ` · Exhaustion ×${c.pending_exhaustion}` : ''),
      idLabel: `ID: ${formatCharId(c.char_no)}`,
      editHref: `/dm/characters/${c.id}/edit`,
      viewHref: `/dm/characters/${c.id}`,
      details: [
        ['Code', c.access_code],
        ['Class', c.setup_done ? c.class || '-' : 'Not filled in yet'],
        ['Level', c.setup_done ? String(c.level) : '-'],
        [
          'Investigation Modifier',
          c.setup_done
            ? sign(
                investigationModifier({
                  level: c.level,
                  intScore: c.int_score,
                  proficient: c.invest_proficient,
                  expertise: c.invest_expertise,
                  bonus: c.invest_bonus,
                }),
              )
            : '-',
        ],
        ['Daily Scavenge', left],
        ['Exhaustion', c.pending_exhaustion > 0 ? `×${c.pending_exhaustion}` : 'None'],
      ],
    };
  });

  return (
    <>
      <Header title="Characters" />
      <Flash error={one(sp.error)} ok={one(sp.ok)} />
      <section className="sec">
        <div className="sec-head">
          <h2>Character Database</h2>
          <span className="count">{characters.length} Character</span>
        </div>
        <div className="toolbar">
          <Link className="btn" href="/dm/characters/new"><PlusIcon /> Register New Character</Link>
        </div>
        <SelectableList
          rows={rows}
          entity="Character"
          searchPlaceholder="Search character..."
          deleteAction={deleteCharacters}
          exportHref="/dm/characters/export"
          emptyText="No characters yet."
        />
      </section>
    </>
  );
}
