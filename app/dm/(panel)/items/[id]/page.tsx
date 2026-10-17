import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireDm } from '@/lib/session';
import { formatItemId } from '@/lib/ids';
import { isUuid, one, type SearchParams } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { Header, SubHeader } from '@/components/Header';
import { ItemForm } from '@/components/ItemForm';
import type { Item } from '@/lib/types';

export default async function EditItemPage({
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

  const { data } = await db().from('item').select('*').eq('id', id).eq('campaign_id', campaign.id).maybeSingle();
  if (!data) notFound();
  const item = data as Item;

  return (
    <>
      <Header title="Items" />
      <SubHeader back="/dm/items" title="Edit Item" right={`ID: ${formatItemId(item.item_no)}`} />
      <Flash error={one(sp.error)} ok={one(sp.ok)} />
      <ItemForm
        initial={{
          id: item.id,
          name: item.name,
          category: item.is_wondrous ? 'wondrous' : 'junk',
          slot: item.is_wondrous ? '' : String(item.slot_weight),
          arcane: item.is_wondrous ? '' : String(item.yield_arcane),
          bio: item.is_wondrous ? '' : String(item.yield_bio),
          ferrous: item.is_wondrous ? '' : String(item.yield_ferrous),
          mech: item.is_wondrous ? '' : String(item.yield_mech),
          description: item.description ?? '',
        }}
      />
    </>
  );
}
