import Link from 'next/link';
import { db } from '@/lib/db';
import { requireDm } from '@/lib/session';
import { deleteItems, importItems } from '@/lib/actions/dm';
import { formatItemId } from '@/lib/ids';
import { itemCategory } from '@/lib/item';
import { one, yieldAll, yieldNonZero, type SearchParams } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { Header } from '@/components/Header';
import { DownloadIcon, PlusIcon } from '@/components/Icons';
import { ImportButton } from '@/components/ImportButton';
import { SelectableList, type ListRow } from '@/components/SelectableList';
import type { Item } from '@/lib/types';

export default async function ItemsPage({ searchParams }: { searchParams: SearchParams }) {
  const campaign = await requireDm();
  const sp = await searchParams;
  const { data } = await db().from('item').select('*').eq('campaign_id', campaign.id).order('item_no');
  const items = (data ?? []) as Item[];

  const rows: ListRow[] = items.map((i) => {
    const category = itemCategory(i);
    return {
      id: i.id,
      title: i.name,
      tag: category === 'wondrous' ? 'Wondrous' : String(i.slot_weight),
      sub: category === 'wondrous' ? 'Wondrous Item' : category === 'crafted' ? 'Crafted Item' : yieldAll(i),
      idLabel: `ID: ${formatItemId(i.item_no)}`,
      editHref: `/dm/items/${i.id}`,
      description: i.description ?? '',
      details:
        category === 'wondrous'
          ? [['Category', 'Wondrous']]
          : category === 'crafted'
            ? [['Category', 'Crafted'], ['Slot', String(i.slot_weight)]]
            : [['Category', 'Junk'], ['Slot', String(i.slot_weight)], ['Yield', yieldNonZero(i)]],
    };
  });

  return (
    <>
      <Header title="Items" />
      <Flash error={one(sp.error)} ok={one(sp.ok)} />
      <section className="sec">
        <div className="sec-head">
          <h2>Item Database</h2>
          <span className="count">{items.length} Item</span>
        </div>
        <div className="toolbar">
          <Link className="btn" href="/dm/items/new"><PlusIcon /> New Item</Link>
          <ImportButton action={importItems} label="Import items (JSON)" />
          <a className="icon-btn" href="/dm/items/export" aria-label="Export all items" title="Export all items">
            <DownloadIcon />
          </a>
        </div>
        <SelectableList
          rows={rows}
          entity="Item"
          searchPlaceholder="Search item..."
          deleteAction={deleteItems}
          exportHref="/dm/items/export"
          emptyText="No items yet. Create one or import a JSON file."
        />
      </section>
    </>
  );
}
