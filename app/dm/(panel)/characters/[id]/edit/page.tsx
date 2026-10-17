import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireDm } from '@/lib/session';
import { saveCharacterDm } from '@/lib/actions/dm';
import { isUuid, one, type SearchParams } from '@/lib/format';
import { CharacterForm } from '@/components/CharacterForm';
import { Flash } from '@/components/Flash';
import { Header, SubHeader } from '@/components/Header';
import type { Character } from '@/lib/types';

export default async function EditCharacterPage({
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

  return (
    <>
      <Header title="Characters" />
      <SubHeader back={`/dm/characters/${c.id}`} title="Edit Character" right={c.access_code} rightClass="code" />
      <Flash error={one(sp.error)} ok={one(sp.ok)} />
      <CharacterForm
        action={saveCharacterDm}
        id={c.id}
        nameEditable
        submitLabel="Save Character"
        initial={{
          name: c.name,
          class: c.class,
          level: String(c.level),
          str: String(c.str),
          dex: String(c.dex),
          con: String(c.con),
          int_score: String(c.int_score),
          wis: String(c.wis),
          cha: String(c.cha),
          invest_proficient: c.invest_proficient,
          invest_expertise: c.invest_expertise,
          invest_bonus: String(c.invest_bonus),
          slot_bonus: String(c.slot_bonus),
        }}
      />
    </>
  );
}
