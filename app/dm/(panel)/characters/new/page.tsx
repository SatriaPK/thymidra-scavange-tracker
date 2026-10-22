import { requireDm } from '@/lib/session';
import { one, type SearchParams } from '@/lib/format';
import { generateAccessCode } from '@/lib/codes';
import { CharacterNameForm } from '@/components/CharacterNameForm';
import { Flash } from '@/components/Flash';
import { Header, SubHeader } from '@/components/Header';

export default async function NewCharacterPage({ searchParams }: { searchParams: SearchParams }) {
  await requireDm();
  const sp = await searchParams;
  const code = generateAccessCode();

  return (
    <>
      <Header title="Characters" />
      <SubHeader back="/dm/characters" title="New Character" right={code} rightClass="code" />
      <Flash error={one(sp.error)} ok={one(sp.ok)} />
      <CharacterNameForm name="" code={code} submitLabel="Save Character" />
    </>
  );
}
