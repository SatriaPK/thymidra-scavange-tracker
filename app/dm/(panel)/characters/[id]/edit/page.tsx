import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireDm } from '@/lib/session';
import { isUuid, one, type SearchParams } from '@/lib/format';
import { CharacterNameForm } from '@/components/CharacterNameForm';
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
      <CharacterNameForm id={c.id} name={c.name} submitLabel="Save Character" />
    </>
  );
}
