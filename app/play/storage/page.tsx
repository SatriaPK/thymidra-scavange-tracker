import { redirect } from 'next/navigation';
import { requirePlayer } from '@/lib/session';
import { loadInventory } from '@/lib/inventory';
import { one, type SearchParams } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { InventoryView } from '@/components/InventoryView';
import { PlayShell } from '@/components/PlayShell';

export default async function StoragePage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requirePlayer();
  if (!me.setup_done) redirect('/play/setup');
  const sp = await searchParams;
  const inv = await loadInventory(me);

  return (
    <PlayShell title={me.name} active="/play/storage">
      <Flash error={one(sp.error)} ok={one(sp.ok)} />
      <InventoryView inv={inv} loc="storage" selected={one(sp.scrap)} />
    </PlayShell>
  );
}