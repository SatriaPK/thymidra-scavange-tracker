import { db } from '@/lib/db';
import { requireDm } from '@/lib/session';
import { formatItemId } from '@/lib/ids';
import { one, type SearchParams } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { Header, SubHeader } from '@/components/Header';
import { ItemForm } from '@/components/ItemForm';

export default async function NewItemPage({ searchParams }: { searchParams: SearchParams }) {
  const campaign = await requireDm();
  const sp = await searchParams;

  // Perkiraan ID berikutnya; nomor pastinya diberikan database saat disimpan.
  const { data } = await db()
    .from('item')
    .select('item_no')
    .eq('campaign_id', campaign.id)
    .order('item_no', { ascending: false })
    .limit(1);
  const next = ((data?.[0]?.item_no as number | undefined) ?? 0) + 1;

  return (
    <>
      <Header title="Items" />
      <SubHeader back="/dm/items" title="New Item" right={`ID: ${formatItemId(next)}`} />
      <Flash error={one(sp.error)} ok={one(sp.ok)} />
      <ItemForm
        initial={{ name: '', category: 'junk', slot: '', arcane: '', bio: '', ferrous: '', mech: '', description: '' }}
      />
    </>
  );
}
