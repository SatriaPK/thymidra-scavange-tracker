import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requirePlayer } from '@/lib/session';
import { loadInventory } from '@/lib/inventory';
import { one, yieldText, type SearchParams } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { PlayShell } from '@/components/PlayShell';
import { PaperImportForm, type ImportItem } from '@/components/PaperImportForm';
import type { Item } from '@/lib/types';

export default async function ImportPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requirePlayer();
  if (!me.setup_done) redirect('/play/setup');
  const sp = await searchParams;

  if (!me.import_allowed) {
    return (
      <PlayShell title={me.name} active="/play/inventory">
        <Flash error={one(sp.error)} ok={one(sp.ok)} />
        <section className="sec">
          <h2>Import from paper</h2>
          <p className="empty">Not open. Your DM has to allow it first, and it can only be used once.</p>
        </section>
      </PlayShell>
    );
  }

  const [inv, itemsRes] = await Promise.all([
    loadInventory(me),
    db().from('item').select('*').eq('campaign_id', me.campaign_id).order('item_no'),
  ]);
  const items: ImportItem[] = ((itemsRes.data ?? []) as Item[]).map((i) => {
    const y = i.yield_bio + i.yield_arcane + i.yield_mech + i.yield_ferrous;
    return {
      id: i.id,
      no: i.item_no,
      name: i.name,
      wondrous: i.is_wondrous,
      quarters: y > 0 ? i.slot_weight * 4 : 0,
      yieldText: yieldText(i),
    };
  });

  return (
    <PlayShell title={me.name} active="/play/inventory">
      <Flash error={one(sp.error)} ok={one(sp.ok)} />
      <PaperImportForm items={items} capacity={inv.capacity} usedQ={inv.usedQ} />
    </PlayShell>
  );
}
